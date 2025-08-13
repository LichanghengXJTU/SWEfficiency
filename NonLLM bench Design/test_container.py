#!/usr/bin/env python3
"""
Test Docker container startup
"""

import subprocess
import tempfile
import os

def test_container_startup():
    """Test if container can start normally"""
    image_tag = "sweperf/sweperf_annotate:astropy__astropy-6940"
    
    print(f"🔍 Testing container startup: {image_tag}")
    
    # Create temporary file
    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".py") as f:
        workload_path = f.name
        f.write("print('Hello World')")
    
    try:
        # Test 1: Simple run
        print("1. Testing simple run...")
        cmd = [
            "docker", "run", "--rm", 
            "--platform", "linux/amd64",
            "--mount", f"type=bind,src={workload_path},dst=/tmp/workload.py",
            image_tag, "echo", "test"
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode == 0:
            print("✅ Simple run successful")
            print(f"Output: {result.stdout}")
        else:
            print(f"❌ Simple run failed: {result.stderr}")
            return False
        
        # Test 2: Check container contents
        print("2. Checking container contents...")
        cmd = [
            "docker", "run", "--rm", 
            "--platform", "linux/amd64",
            image_tag, "ls", "-la", "/"
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode == 0:
            print("✅ Container content check successful")
            print(f"Root directory contents:\n{result.stdout}")
        else:
            print(f"❌ Container content check failed: {result.stderr}")
        
        # Test 3: Check perf.sh
        print("3. Checking perf.sh script...")
        cmd = [
            "docker", "run", "--rm", 
            "--platform", "linux/amd64",
            image_tag, "ls", "-la", "/perf.sh"
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode == 0:
            print("✅ perf.sh script exists")
            print(f"Script info:\n{result.stdout}")
        else:
            print(f"❌ perf.sh script does not exist: {result.stderr}")
        
        # Test 4: Check bash
        print("4. Checking bash...")
        cmd = [
            "docker", "run", "--rm", 
            "--platform", "linux/amd64",
            image_tag, "which", "bash"
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode == 0:
            print("✅ bash exists")
            print(f"bash path: {result.stdout.strip()}")
        else:
            print(f"❌ bash does not exist: {result.stderr}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during testing: {e}")
        return False
    finally:
        # Clean up temporary file
        os.unlink(workload_path)

def test_interactive_bash():
    """Test interactive bash"""
    image_tag = "sweperf/sweperf_annotate:astropy__astropy-6940"
    
    print(f"\n🔍 Testing interactive bash: {image_tag}")
    
    try:
        # Use subprocess to test bash startup
        cmd = [
            "docker", "run", "-it", "--rm", 
            "--platform", "linux/amd64",
            image_tag, "bash", "-c", "echo 'Bash is working'; pwd; whoami"
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode == 0:
            print("✅ Interactive bash test successful")
            print(f"Output:\n{result.stdout}")
        else:
            print(f"❌ Interactive bash test failed: {result.stderr}")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Error during testing: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Starting container startup test...\n")
    
    if test_container_startup():
        print("\n✅ Container startup test successful")
    else:
        print("\n❌ Container startup test failed")
    
    if test_interactive_bash():
        print("\n✅ Interactive bash test successful")
    else:
        print("\n❌ Interactive bash test failed")
    
    print("\n🎉 Test completed!") 