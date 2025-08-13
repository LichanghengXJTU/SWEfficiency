#!/bin/bash
# Double-clickable macOS installer wrapper
DIR="$(cd "$(dirname "$0")" && pwd)"
LOG="$DIR/install.log"
: > "$LOG"
(
  echo "[launcher] starting installer..."
  cd "$DIR"
  chmod +x ./install_helper.sh || true
  # 允许来源可按需在此写死；如留空则 install_helper.sh 使用默认值
  ./install_helper.sh 2>&1 | tee -a "$LOG"
  echo "[launcher] finished. Log: $LOG"
) &
# 打开一个终端窗口显示日志（可选）
open -a Terminal "$LOG" 2>/dev/null || true 