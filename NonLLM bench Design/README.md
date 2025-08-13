# GitHub PR性能基准测试Web应用

一个用于自动测试GitHub Pull Request性能影响的Web应用。

## 🚀 快速开始

### 前置要求

1. **Node.js** (版本14或更高)
   - 下载地址: https://nodejs.org/

2. **Python 3** (版本3.7或更高)
   - 通常macOS已预装

3. **Docker Desktop for Mac**
   - 下载地址: https://www.docker.com/products/docker-desktop

### 一键启动

```bash
# 克隆项目后，在项目目录下运行
./deploy.sh
```

### 手动启动

1. **安装依赖**
```bash
# 前端依赖
npm install

# 后端依赖
pip3 install flask flask-cors pexpect
```

2. **启动服务**
```bash
# 终端1: 启动后端服务
python3 backend.py

# 终端2: 启动Docker权限检查服务
python3 docker_permission_check.py

# 终端3: 启动前端服务
npm start
```

3. **访问应用**
- 前端界面: http://localhost:3000
- 后端API: http://localhost:5678
- Docker检查: http://localhost:5679

## 🔧 Docker权限配置

### macOS权限设置

1. **安装Docker Desktop**
   - 从官网下载并安装Docker Desktop for Mac

2. **启动Docker Desktop**
   - 在应用程序中找到并启动Docker Desktop
   - 等待Docker引擎完全启动

3. **授予系统权限**
   - 打开"系统偏好设置" > "安全性与隐私"
   - 在"隐私"标签页中找到"完全磁盘访问权限"
   - 点击锁图标解锁设置
   - 添加Docker Desktop到允许列表
   - 重启Docker Desktop

4. **验证权限**
   - 在Web界面点击"检查Docker状态"
   - 确认状态显示为"✅ 正常"

## 📖 使用说明

1. **输入GitHub PR地址**
   - 格式: `https://github.com/用户名/仓库名/pull/PR号`

2. **配置测试代码**
   - **Imports**: 导入所需的Python模块
   - **Setup**: 初始化代码，在每次测试前运行
   - **Workload**: 实际性能测试代码

3. **设置测试参数**
   - **Number**: 每次测试的重复次数
   - **Repeat**: 测试的总轮数

4. **运行测试**
   - 点击"运行"按钮开始性能测试
   - 系统会自动比较PR应用前后的性能差异

## 🎯 功能特性

- ✅ **自动化测试**: 自动应用PR并运行性能测试
- ✅ **智能diff处理**: 自动跳过冗长的git diff输出
- ✅ **可视化结果**: 颜色编码显示性能变化
- ✅ **Docker权限检查**: 自动检测和指导Docker配置
- ✅ **统计信息**: 提供均值、标准差等统计指标

## 🔍 技术架构

- **前端**: React + TypeScript
- **后端**: Flask + Python
- **容器化**: Docker
- **权限管理**: macOS系统权限 + 自定义检查服务

## 🛠️ 开发

### 项目结构
```
├── src/                    # React前端源码
│   ├── App.jsx            # 主应用组件
│   └── index.js           # 应用入口
├── public/                # 静态资源
├── backend.py             # Flask后端服务
├── docker_permission_check.py  # Docker权限检查服务
├── deploy.sh              # 一键部署脚本
└── package.json           # 前端依赖配置
```

### 自定义开发
- 修改前端界面: 编辑 `src/App.jsx`
- 修改后端逻辑: 编辑 `backend.py`
- 修改权限检查: 编辑 `docker_permission_check.py`

## 📝 注意事项

1. **首次使用**: 需要配置Docker权限，按照Web界面的指导步骤操作
2. **网络要求**: 需要网络连接来拉取Docker镜像
3. **系统资源**: Docker容器会消耗一定的CPU和内存资源
4. **测试时间**: 复杂测试可能需要几分钟时间

## 🤝 贡献

欢迎提交Issue和Pull Request来改进这个项目！

## �� 许可证

MIT License 