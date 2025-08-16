#!/usr/bin/env bash
set -euo pipefail

# Configuration
PORT="${PORT:-5050}"
HOST="127.0.0.1"
ROOT="${SWEF_WORK_ROOT:-$HOME/SWEfficiencyWork}"
ALLOWED="${SWEF_ALLOWED_ORIGINS:-https://LichanghengXJTU.github.io,http://localhost:8000}"
CERT="$HOME/.SWEfficiency/certs/localhost.pem"
KEY="$HOME/.SWEfficiency/certs/localhost-key.pem"

# SWEf-data repo, the one to upload to
export SWEF_DATA_REPO="${SWEF_DATA_REPO:-LichanghengXJTU/SWEf-data}"
export SWEF_DATA_PATH="${SWEF_DATA_PATH:-Non_LLM_user_data}"
# NOTE: this is my own oauth app creds, we can decide to use a new one or just mine
export SWEF_GH_CLIENT_ID="Ov23liNsCTJnDfTRPe4X"
export SWEF_GH_CLIENT_SECRET="b9f13e8adbfe9612301ee0cff243a04f6d98b8ce"

cd "$(dirname "$0")"

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

export SWEF_WORK_ROOT="$ROOT"
export SWEF_ALLOWED_ORIGINS="$ALLOWED"

if [ -f "$CERT" ] && [ -f "$KEY" ]; then
  exec uvicorn helper_server:app --host "$HOST" --port "$PORT" \
    --ssl-keyfile "$KEY" --ssl-certfile "$CERT"
else
  exec uvicorn helper_server:app --host "$HOST" --port "$PORT"
fi
