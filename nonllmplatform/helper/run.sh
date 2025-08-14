#!/usr/bin/env bash
set -euo pipefail

# 配置
PORT="${PORT:-5050}"
HOST="127.0.0.1"
ROOT="${SWEP_WORK_ROOT:-$HOME/SweperfWork}"
ALLOWED="${SWEP_ALLOWED_ORIGINS:-https://lichanghengxjtu.github.io,http://localhost:8000}"
CERT="$HOME/.sweperf/certs/localhost.pem"
KEY="$HOME/.sweperf/certs/localhost-key.pem"

# SWEf-data 上传相关（可在外部覆写）
export SWEF_DATA_REPO="${SWEF_DATA_REPO:-lichanghengxjtu/SWEf-data}"
export SWEF_DATA_PATH="${SWEF_DATA_PATH:-Non_LLM_user_data}"
export SWEF_GH_CLIENT_ID="Ov23liNsCTJnDfTRPe4X"
# 若使用 GitHub Device Flow，建议另外设置 SWEF_GH_CLIENT_SECRET；
# 如未设置，将要求用户提供 PAT 通过 /api/upload/token 注入。

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
export SWEF_GH_CLIENT_SECRET="b9f13e8adbfe9612301ee0cff243a04f6d98b8ce"
