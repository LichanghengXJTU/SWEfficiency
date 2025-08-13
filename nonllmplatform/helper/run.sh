#!/usr/bin/env bash
set -euo pipefail

# 配置
PORT="${PORT:-5050}"
HOST="127.0.0.1"
ROOT="${SWEP_WORK_ROOT:-$HOME/SweperfWork}"
ALLOWED="${SWEP_ALLOWED_ORIGINS:-https://lichanghengxjtu.github.io,http://localhost:8000}"
CERT="$HOME/.sweperf/certs/localhost.pem"
KEY="$HOME/.sweperf/certs/localhost-key.pem"

# 进入脚本所在目录
cd "$(dirname "$0")"

# 虚拟环境（可选）
if [ ! -d ".venv" ]; then
  PY_BIN="$(command -v python3.12 || command -v python3)"
  "$PY_BIN" -m venv .venv
  . .venv/bin/activate
  pip install --upgrade pip
  pip install -r requirements.txt
else
  . .venv/bin/activate
fi

mkdir -p "$ROOT"

export SWEP_WORK_ROOT="$ROOT"
export SWEP_ALLOWED_ORIGINS="$ALLOWED"

# HTTPS（推荐，避免混合内容）
if [ -f "$CERT" ] && [ -f "$KEY" ]; then
  exec uvicorn helper_server:app --host "$HOST" --port "$PORT" \
    --ssl-keyfile "$KEY" --ssl-certfile "$CERT"
else
  # 开发模式（HTTP）
  exec uvicorn helper_server:app --host "$HOST" --port "$PORT"
fi
