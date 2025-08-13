#!/usr/bin/env python3
"""
检查Docker容器的资源限制设置
"""

import subprocess
import json
import sys

def check_docker_limits():
    """检查Docker容器的资源限制"""
    print("🔍 检查Docker容器资源限制...")
    
    # 测试镜像
    image_tag = "sweperf/sweperf_annotate:astropy__astropy-6940"
    
    # 1. 检查Docker默认资源限制
    print("\n1. 检查Docker默认资源限制...")
    try:
        result = subprocess.run(['docker', 'info'], capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ Docker信息获取成功")
            # 查找内存和CPU信息
            for line in result.stdout.split('\n'):
                if 'Memory' in line or 'CPU' in line:
                    print(f"   {line.strip()}")
        else:
            print(f"❌ Docker信息获取失败: {result.stderr}")
    except Exception as e:
        print(f"❌ Docker信息检查失败: {e}")
    
    # 2. 检查容器内的资源限制
    print("\n2. 检查容器内资源限制...")
    try:
        # 运行容器并检查资源限制
        cmd = [
            'docker', 'run', '--rm', '--platform', 'linux/amd64',
            image_tag, 'bash', '-c', 
            'echo "=== 内存限制 ===" && cat /proc/meminfo | grep -E "(MemTotal|MemAvailable|MemFree)" && echo "=== CPU限制 ===" && cat /proc/cpuinfo | grep -E "(processor|model name)" | head -5 && echo "=== 进程限制 ===" && ulimit -a'
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        if result.returncode == 0:
            print("✅ 容器资源检查成功")
            print(result.stdout)
        else:
            print(f"❌ 容器资源检查失败: {result.stderr}")
    except Exception as e:
        print(f"❌ 容器资源检查失败: {e}")
    
    # 3. 检查Docker Desktop资源设置
    print("\n3. 检查Docker Desktop资源设置...")
    try:
        # 在macOS上检查Docker Desktop设置
        result = subprocess.run(['defaults', 'read', 'com.docker.docker'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ Docker Desktop设置获取成功")
            # 查找资源相关设置
            for line in result.stdout.split('\n'):
                if 'memory' in line.lower() or 'cpu' in line.lower():
                    print(f"   {line.strip()}")
        else:
            print("⚠️ 无法读取Docker Desktop设置")
    except Exception as e:
        print(f"⚠️ Docker Desktop设置检查失败: {e}")
    
    # 4. 测试无限制运行
    print("\n4. 测试无限制运行...")
    try:
        # 运行一个简单的测试，看看是否有超时
        cmd = [
            'docker', 'run', '--rm', '--platform', 'linux/amd64',
            '--memory', '4g',  # 设置4GB内存限制
            '--cpus', '2',     # 设置2个CPU核心
            image_tag, 'bash', '-c', 
            'echo "开始测试..." && sleep 5 && echo "测试完成"'
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            print("✅ 无限制运行测试成功")
            print(result.stdout)
        else:
            print(f"❌ 无限制运行测试失败: {result.stderr}")
    except Exception as e:
        print(f"❌ 无限制运行测试失败: {e}")

if __name__ == "__main__":
    check_docker_limits() 