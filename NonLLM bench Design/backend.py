import os
import tempfile
import re
import time
import shutil
import subprocess
import pexpect
import threading
import json
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Global variables to track running processes
current_process = None
current_pexpect_child = None
process_lock = threading.Lock()

# 结果保存目录
RESULTS_DIR = "benchmark_results"
if not os.path.exists(RESULTS_DIR):
    os.makedirs(RESULTS_DIR)

def save_result_to_file(result_data, image_tag):
    """保存结果到本地文件"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_image_tag = image_tag.replace("/", "_").replace(":", "_")
    filename = f"{RESULTS_DIR}/result_{safe_image_tag}_{timestamp}.json"
    
    try:
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(result_data, f, indent=2, ensure_ascii=False)
        print(f"✅ 结果已保存到: {filename}")
        return filename
    except Exception as e:
        print(f"❌ 保存结果失败: {e}")
        return None

def get_latest_result(image_tag):
    """获取最新的结果文件"""
    if not os.path.exists(RESULTS_DIR):
        return None
    
    safe_image_tag = image_tag.replace("/", "_").replace(":", "_")
    pattern = f"result_{safe_image_tag}_*.json"
    
    try:
        files = [f for f in os.listdir(RESULTS_DIR) if f.startswith(f"result_{safe_image_tag}_")]
        if not files:
            return None
        
        # 按修改时间排序，获取最新的
        latest_file = max(files, key=lambda f: os.path.getmtime(os.path.join(RESULTS_DIR, f)))
        filepath = os.path.join(RESULTS_DIR, latest_file)
        
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ 读取最新结果失败: {e}")
        return None

# PR URL -> Docker image tag
def github_to_docker_tag(url):
    m = re.match(r'https://github.com/([^/]+)/([^/]+)/pull/(\d+)', url)
    if m:
        org, repo, pr = m.groups()
        return f'sweperf/sweperf_annotate:{org}__{repo}-{pr}'
    else:
        raise ValueError("URL format is incorrect")

def check_image_availability(image_tag):
    """Check if Docker image is available"""
    try:
        result = subprocess.run(['docker', 'images', image_tag], 
                              capture_output=True, text=True)
        if result.returncode == 0 and image_tag in result.stdout:
            return True, "Image already exists", None
        
        # Try to pull the image
        print(f"Pulling image: {image_tag}")
        print("⚠️  Note: Image pull may take a long time. Please be patient...")
        result = subprocess.run(['docker', 'pull', '--platform', 'linux/amd64', image_tag], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            return True, "Image pulled successfully", result.stdout
        else:
            return False, result.stderr, None
    except Exception as e:
        return False, f"Image check failed: {e}", None

def run_in_docker(image_tag, workload_path):
    """
    Intelligently control container access
    """
    global current_pexpect_child
    
    # 1. Create a temporary result directory
    temp_dir = tempfile.mkdtemp()
    result_file_before = os.path.join(temp_dir, "result_before.txt")
    result_file_after = os.path.join(temp_dir, "result_after.txt")

    mount_arg = f"--mount type=bind,src={workload_path},dst=/tmp/workload.py"
    # Add platform compatibility parameters, support ARM64 and x86_64
    platform_arg = "--platform linux/amd64"  # Force use x86_64 platform
    
    # 放宽资源限制 - 增加内存和CPU限制，移除超时限制
    resource_args = [
        "--memory", "6g",           # 设置6GB内存限制（系统总内存约7.6GB）
        "--cpus", "4",              # 设置4个CPU核心
        "--shm-size", "2g",         # 增加共享内存大小
        "--ulimit", "nofile=65536:65536",  # 增加文件描述符限制
        "--ulimit", "nproc=32768:32768",   # 增加进程数限制
        "--ulimit", "memlock=-1:-1",       # 移除内存锁定限制
        "--ulimit", "stack=-1:-1",         # 移除栈大小限制
        "--ulimit", "data=-1:-1",          # 移除数据段大小限制
        "--ulimit", "fsize=-1:-1",         # 移除文件大小限制
        "--ulimit", "cpu=-1:-1",           # 移除CPU时间限制
        "--ulimit", "rss=-1:-1",           # 移除常驻集大小限制
    ]
    
    # Add interactive parameters to ensure bash starts normally
    docker_cmd = f"docker run -it --rm {platform_arg} {' '.join(resource_args)} {mount_arg} {image_tag} /bin/bash"
    # We use pexpect to handle interaction
    child = pexpect.spawn(docker_cmd, encoding='utf-8', timeout=None)
    # Set up logging for debugging
    child.logfile = open('/tmp/docker_debug.log', 'w')
    
    # Store the child process globally so it can be stopped
    with process_lock:
        current_pexpect_child = child

    # Record executed commands
    executed_commands = []

    try:
        # Wait for bash prompt, support multiple possible prompts
        print("⏳ Waiting for bash shell to be ready...")
        child.expect([r"#\s*$", r"\$\s*$", r">\s*$", r"bash-[0-9.]+#\s*$"])
        print(f"Bash shell ready, prompt: {child.after}")
        
        # Check if perf.sh exists
        cmd = 'ls -la /perf.sh'
        executed_commands.append(cmd)
        child.sendline(cmd)
        child.expect([r"#\s*$", r"\$\s*$", r">\s*$"])
        perf_output = child.before
        
        if "No such file" in perf_output or "perf.sh" not in perf_output:
            raise Exception("perf.sh script does not exist, please check if the image is correct")
        
        cmd = 'chmod +x /perf.sh'
        executed_commands.append(cmd)
        child.sendline(cmd)
        child.expect([r"#\s*$", r"\$\s*$", r">\s*$"])
        
        # Use path inside container - no timeout for perf.sh execution
        print("⏳ Running performance test before patch (this may take a long time)...")
        cmd = '/perf.sh > /tmp/result_before.txt 2>&1'
        executed_commands.append(cmd)
        child.sendline(cmd)
        child.expect([r"#\s*$", r"\$\s*$", r">\s*$"])
        
        cmd = "git apply /tmp/patch.diff"
        executed_commands.append(cmd)
        child.sendline(cmd)
        child.expect([r"#\s*$", r"\$\s*$", r">\s*$"])
        
        print("⏳ Running performance test after patch (this may take a long time)...")
        cmd = '/perf.sh > /tmp/result_after.txt 2>&1'
        executed_commands.append(cmd)
        child.sendline(cmd)
        child.expect([r"#\s*$", r"\$\s*$", r">\s*$"])
        
        cmd = "cat /tmp/result_before.txt"
        executed_commands.append(cmd)
        child.sendline(cmd)
        child.expect([r"#\s*$", r"\$\s*$", r">\s*$"])
        result_before = child.before
        
        cmd = "cat /tmp/result_after.txt"
        executed_commands.append(cmd)
        child.sendline(cmd)
        child.expect([r"#\s*$", r"\$\s*$", r">\s*$"])
        result_after = child.before
    except Exception as e:
        error_msg = str(e)
        if "platform" in error_msg.lower():
            result_before = f"Platform compatibility error: {error_msg}\n\nSolutions:\n1. Ensure Docker Desktop is running\n2. Try manually pulling the image: docker pull {image_tag}\n3. Check if the image supports the current platform"
        else:
            result_before = f"Error before running: {error_msg}"
        result_after = ""
    finally:
        child.close()
        if child.logfile:
            child.logfile.close()
        shutil.rmtree(temp_dir)
        # Clear the global reference
        with process_lock:
            current_pexpect_child = None
    return result_before, result_after, executed_commands

def extract_mean_std(output):
    import re
    try:
        # First try to extract content between PERF_START and PERF_END
        perf_match = re.search(r'PERF_START:(.*?)PERF_END:', output, re.DOTALL)
        if perf_match:
            perf_output = perf_match.group(1).strip()
            print(f"Extracted performance output: {perf_output}")
            
            # Extract Mean and Std Dev from performance output
            mean_match = re.search(r'Mean:\s*([0-9.eE+-]+)', perf_output)
            std_match = re.search(r'Std Dev:\s*([0-9.eE+-]+)', perf_output)
            
            if mean_match and std_match:
                mean = float(mean_match.group(1))
                std = float(std_match.group(1))
                return mean, std, perf_output
            else:
                # If Mean and Std Dev are not found, return complete performance output
                return None, None, perf_output
        
        # If no PERF_START/PERF_END markers, try to extract Mean and Std Dev directly
        mean = float(re.search(r'Mean:\s*([0-9.eE+-]+)', output).group(1))
        std = float(re.search(r'Std Dev:\s*([0-9.eE+-]+)', output).group(1))
        return mean, std, output
    except Exception as e:
        print(f"Failed to extract performance data: {e}")
        return None, None, output

@app.route("/run_benchmark", methods=["POST"])
def run_benchmark():
    data = request.json
    input_value = data["pr_url"]
    workload_code = data["workload_code"]

    # Determine if input is a GitHub URL or direct image name
    if input_value.startswith('http'):
        # GitHub PR URL - use existing logic
        image_tag = github_to_docker_tag(input_value)
        is_direct_image = False
    else:
        # Direct image name - check if it needs prefix
        if ':' in input_value:
            # Already has repository prefix, use as is
            image_tag = input_value
        else:
            # Add sweperf/sweperf_annotate prefix
            image_tag = f'sweperf/sweperf_annotate:{input_value}'
        is_direct_image = True

    # Check image availability
    image_available, image_msg, download_info = check_image_availability(image_tag)
    if not image_available:
        result = {
            "image_tag": image_tag,
            "before": f"Image unavailable: {image_msg}",
            "after": "",
            "mean_before": None,
            "std_before": None,
            "mean_after": None,
            "std_after": None,
            "ratio": None,
            "error": f"Cannot get Docker image: {image_msg}",
            "download_info": download_info
        }
        return jsonify(result)

    # Save workload.py to temporary path
    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".py") as f:
        workload_path = f.name
        f.write(workload_code)

    before, after, executed_commands = run_in_docker(image_tag, workload_path)
    m1, s1, perf_output1 = extract_mean_std(before)
    m2, s2, perf_output2 = extract_mean_std(after)

    if m1 and m2:
        ratio = m2 / m1
    else:
        ratio = None

    result = {
        "image_tag": image_tag,
        "is_direct_image": is_direct_image,
        "before": before,
        "after": after,
        "mean_before": m1,
        "std_before": s1,
        "mean_after": m2,
        "std_after": s2,
        "ratio": ratio,
        "error": None if (m1 and m2) else "Performance extraction failed, please check original output",
        "perf_output_before": perf_output1,
        "perf_output_after": perf_output2,
        "docker_command": f"docker run --rm --platform linux/amd64 --memory 6g --cpus 4 --shm-size 2g --ulimit nofile=65536:65536 --ulimit nproc=32768:32768 --ulimit memlock=-1:-1 --ulimit stack=-1:-1 --ulimit data=-1:-1 --ulimit fsize=-1:-1 --ulimit cpu=-1:-1 --ulimit rss=-1:-1 --mount type=bind,src=<REPLACE_ME>,dst=/tmp/workload.py {image_tag} /bin/bash -c 'chmod +x /perf.sh && /perf.sh && git apply -q /tmp/patch.diff && /perf.sh' 2>&1 | grep -v '^+' | awk '/PERF_START:/ {{inblock=1; next}} /PERF_END:/ {{inblock=0}} inblock'",
        "download_info": download_info
    }
    os.remove(workload_path)
    return jsonify(result)

@app.route("/stop_benchmark", methods=["POST"])
def stop_benchmark():
    """Stop the currently running benchmark"""
    global current_pexpect_child
    
    with process_lock:
        if current_pexpect_child is not None:
            try:
                # Send SIGTERM to the pexpect child
                current_pexpect_child.close(force=True)
                current_pexpect_child = None
                return jsonify({"status": "success", "message": "Benchmark stopped successfully"})
            except Exception as e:
                return jsonify({"status": "error", "message": f"Failed to stop benchmark: {str(e)}"})
        else:
            return jsonify({"status": "error", "message": "No benchmark currently running"})

if __name__ == "__main__":
    app.run(debug=False, port=5678, use_reloader=False)

