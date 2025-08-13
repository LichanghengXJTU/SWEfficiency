#!/usr/bin/env python3
"""
Test Docker platform compatibility fix
"""

import subprocess
import sys

def test_docker_compatibility():
    """Test Docker platform compatibility"""
    print("🔍 Checking Docker platform compatibility...")
    
    # Test image
    image_tag = "sweperf/sweperf_annotate:astropy__astropy-6940"
    
    # 1. Check if Docker is running
    print("1. Checking Docker status...")
    try:
        result = subprocess.run(['docker', 'info'], capture_output=True, text=True, timeout=10)
        if result.returncode != 0:
            print("❌ Docker not running or not installed")
            return False
        print("✅ Docker is running")
    except Exception as e:
        print(f"❌ Docker check failed: {e}")
        return False
    
    # 2. Test native run
    print("2. Testing native Docker run...")
    try:
        result = subprocess.run(['docker', 'run', '--rm', image_tag, 'echo', 'test'], 
                              capture_output=True, text=True, timeout=60)
        if result.returncode == 0:
            print("✅ Native Docker run successful")
        else:
            print(f"⚠️ Native run failed: {result.stderr}")
    except Exception as e:
        print(f"⚠️ Native run failed: {e}")
    
    # 3. Test platform-specific run
    print("3. Testing platform-specific Docker run...")
    try:
        result = subprocess.run(['docker', 'run', '--rm', '--platform', 'linux/amd64', 
                               image_tag, 'echo', 'test'], 
                              capture_output=True, text=True, timeout=60)
        if result.returncode == 0:
            print("✅ Platform-specific Docker run successful")
            return True
        else:
            print(f"❌ Platform-specific run failed: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ Platform-specific run failed: {e}")
        return False

if __name__ == "__main__":
    if test_docker_compatibility():
        print("\n🎉 Docker compatibility test passed!")
        sys.exit(0)
    else:
        print("\n❌ Docker compatibility test failed!")
        sys.exit(1) 