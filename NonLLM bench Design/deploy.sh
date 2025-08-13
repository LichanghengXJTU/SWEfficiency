#!/bin/bash

echo "🚀 启动性能基准测试Web应用..."

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "❌ Node.js未安装，请先安装Node.js"
    echo "访问: https://nodejs.org/"
    exit 1
fi

# 检查Python是否安装
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3未安装，请先安装Python3"
    exit 1
fi

# 安装前端依赖
echo "📦 安装前端依赖..."
npm install

# 安装后端依赖
echo "📦 安装后端依赖..."
pip3 install flask flask-cors pexpect

# 启动后端服务
echo "🔧 启动后端服务 (端口5678)..."
python3 backend.py &
BACKEND_PID=$!

# 启动Docker权限检查服务
echo "🔧 启动Docker权限检查服务 (端口5679)..."
python3 docker_permission_check.py &
DOCKER_CHECK_PID=$!

# 等待服务启动
sleep 3

# 启动前端服务
echo "🌐 启动前端服务 (端口3000)..."
npm start &
FRONTEND_PID=$!

echo ""
echo "✅ 所有服务已启动!"
echo "📱 前端地址: http://localhost:3000"
echo "🔧 后端API: http://localhost:5678"
echo "🔍 Docker检查: http://localhost:5679"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 等待用户中断
trap "echo '🛑 正在停止服务...'; kill $BACKEND_PID $DOCKER_CHECK_PID $FRONTEND_PID 2>/dev/null; exit" INT

wait 