#!/usr/bin/env python3
"""
测试新的资源限制设置
"""

import subprocess
import tempfile
import os

def test_resource_limits():
    """测试新的资源限制设置"""
    print("🔍 测试新的资源限制设置...")
    
    # 测试镜像
    image_tag = "sweperf/sweperf_annotate:astropy__astropy-6940"
    
    # 创建临时工作负载文件
    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".py") as f:
        workload_path = f.name
        f.write("""
import timeit
import statistics

# 测试代码
def test_workload():
    return sum(range(1000))

# 运行测试
times = timeit.repeat(test_workload, number=1000, repeat=5)
mean_time = statistics.mean(times)
std_time = statistics.stdev(times)

print(f"Mean: {mean_time}")
print(f"Std Dev: {std_time}")
""")
    
    try:
        # 构建Docker命令，使用新的资源限制
        resource_args = [
            "--memory", "6g",
            "--cpus", "4", 
            "--shm-size", "2g",
            "--ulimit", "nofile=65536:65536",
            "--ulimit", "nproc=32768:32768",
            "--ulimit", "memlock=-1:-1",
            "--ulimit", "stack=-1:-1",
            "--ulimit", "data=-1:-1",
            "--ulimit", "fsize=-1:-1",
            "--ulimit", "cpu=-1:-1",
            "--ulimit", "rss=-1:-1",
        ]
        
        mount_arg = f"--mount type=bind,src={workload_path},dst=/tmp/workload.py"
        platform_arg = "--platform linux/amd64"
        
        docker_cmd = [
            "docker", "run", "--rm", "-it",
            platform_arg
        ] + resource_args + [
            mount_arg,
            image_tag,
            "/bin/bash", "-c",
            "chmod +x /perf.sh && /perf.sh"
        ]
        
        print("🚀 运行测试容器...")
        print(f"命令: {' '.join(docker_cmd)}")
        
        # 运行容器
        result = subprocess.run(docker_cmd, capture_output=True, text=True, timeout=300)
        
        if result.returncode == 0:
            print("✅ 测试成功完成")
            print("输出:")
            print(result.stdout)
            
            # 检查是否包含性能数据
            if "Mean:" in result.stdout and "Std Dev:" in result.stdout:
                print("✅ 性能数据提取成功")
            else:
                print("⚠️ 未找到性能数据")
        else:
            print(f"❌ 测试失败: {result.stderr}")
            
    except subprocess.TimeoutExpired:
        print("❌ 测试超时（5分钟）")
    except Exception as e:
        print(f"❌ 测试出错: {e}")
    finally:
        # 清理临时文件
        os.unlink(workload_path)

def test_ulimits():
    """测试ulimit设置"""
    print("\n🔍 测试ulimit设置...")
    
    image_tag = "sweperf/sweperf_annotate:astropy__astropy-6940"
    
    resource_args = [
        "--memory", "6g",
        "--cpus", "4",
        "--ulimit", "nofile=65536:65536",
        "--ulimit", "nproc=32768:32768",
        "--ulimit", "memlock=-1:-1",
        "--ulimit", "stack=-1:-1",
        "--ulimit", "data=-1:-1",
        "--ulimit", "fsize=-1:-1",
        "--ulimit", "cpu=-1:-1",
        "--ulimit", "rss=-1:-1",
    ]
    
    docker_cmd = [
        "docker", "run", "--rm",
        "--platform", "linux/amd64"
    ] + resource_args + [
        image_tag,
        "bash", "-c",
        "echo '=== 资源限制检查 ===' && ulimit -a && echo '=== 内存信息 ===' && free -h && echo '=== CPU信息 ===' && nproc"
    ]
    
    try:
        result = subprocess.run(docker_cmd, capture_output=True, text=True, timeout=60)
        
        if result.returncode == 0:
            print("✅ ulimit测试成功")
            print(result.stdout)
        else:
            print(f"❌ ulimit测试失败: {result.stderr}")
            
    except Exception as e:
        print(f"❌ ulimit测试出错: {e}")

if __name__ == "__main__":
    test_resource_limits()
    test_ulimits() 