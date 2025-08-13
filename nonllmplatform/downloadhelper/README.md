# Sweperf Helper 安装说明（macOS）

目标
- 一键在本机安装并常驻运行本地 Helper（127.0.0.1:5050，HTTPS），用于在浏览器端安全地触发本地 Docker 与文件操作。
- 所有敏感操作均在本机完成；网页仅作为“遥控器”。

我们不会做的事
- 不会上传你的仓库或文件内容到远端服务器。
- 不会开启入站端口（仅本机 127.0.0.1）。
- 不会持久化任何凭据（除非你明确在 helper 的工作目录中保存）。

安装准备
- 操作系统：macOS 11+（Apple Silicon 或 Intel）
- 需要网络下载 Python 依赖；若本机已具备 python3.12 会更快。
- 可选：Docker Desktop（用于 docker 检查与管线运行）。

快速开始（推荐）
1. 打开“终端”，执行：
```
cd "$(dirname "$0")"
bash install_helper.sh
```
2. 完成后访问：
```
https://127.0.0.1:5050/api/health
```
若首次访问提示证书不受信任，根据浏览器提示信任自签证书即可。

工作原理（概述）
- 安装脚本会：
  - 生成并信任仅用于 localhost 的自签 TLS 证书（存于 `~/.sweperf/certs/`）。
  - 在 `nonllmplatform/helper` 下创建 Python 虚拟环境并安装依赖。
  - 写入并启用 LaunchAgent（`~/Library/LaunchAgents/com.sweperf.helper.plist`），实现登录自动启动与后台运行。
  - 默认允许的跨域来源为 `https://lichanghengxjtu.github.io` 与 `http://localhost:8000`；可通过环境变量覆盖。

安全性
- 仅监听 `127.0.0.1:5050`；外部网络不可访问。
- Docker 运行使用受限参数（CPU/内存/PIDs/无网络/降权）。
- 沙箱目录默认为 `~/SweperfWork`，避免路径逃逸。

常用命令
- 立即重启 helper：
```
launchctl kickstart -k gui/$(id -u)/com.sweperf.helper
```
- 查看日志：
```
tail -f ~/Library/Logs/sweperf-helper.log
```
- 本地验证：
```
curl -s https://127.0.0.1:5050/api/health | cat
curl -s https://127.0.0.1:5050/api/docker/check | cat
```

自定义（可选）
- 修改允许跨域来源：
  - 运行前设置 `SWEP_ALLOWED_ORIGINS` 环境变量，或安装后编辑 `~/Library/LaunchAgents/com.sweperf.helper.plist`。
- 修改端口：
  - 运行前设置 `PORT` 环境变量。

卸载
```
launchctl bootout gui/$(id -u)/com.sweperf.helper || true
rm -f ~/Library/LaunchAgents/com.sweperf.helper.plist
rm -rf ~/.sweperf ~/SweperfWork
rm -rf "$(cd .. && pwd)/helper/.venv"
```

常见问题
- 浏览器提示证书不安全？
  - 这是自签本地证书，确保仅用于 `127.0.0.1/localhost`。你可以在“钥匙串访问”中将其设为“始终信任”。
- Pages 页面连接失败（CORS）？
  - 确保 `install_helper.sh` 执行时的默认域与你的 Pages 源一致（`https://lichanghengxjtu.github.io`）。
- Docker 检查失败？
  - 打开 Docker Desktop，确认 `docker version` 正常返回；稍后在页面重试。 