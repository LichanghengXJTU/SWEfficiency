#!/usr/bin/env bash
set -euo pipefail

# install_helper.sh — macOS one-click installer for local helper
# - Checks/installs Python venv deps (prefers python3.12; fallbacks with ABI3 for 3.13)
# - Generates and trusts localhost TLS cert (no Homebrew needed)
# - Creates/updates venv and installs requirements
# - Configures LaunchAgent to autostart helper on login
# - Idempotent: skips steps when already satisfied

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
HELPER_DIR="$ROOT_DIR/nonllmplatform/helper"
LAUNCH_PLIST="$HOME/Library/LaunchAgents/com.sweperf.helper.plist"
CERT_DIR="$HOME/.sweperf/certs"
CERT_PEM="$CERT_DIR/localhost.pem"
KEY_PEM="$CERT_DIR/localhost-key.pem"
PORT="${PORT:-5050}"
ALLOWED_ORIGINS_DEFAULT="https://lichanghengxjtu.github.io,http://localhost:8000"

log(){ printf "[install] %s\n" "$*"; }
warn(){ printf "[warn] %s\n" "$*"; }
err(){ printf "[error] %s\n" "$*" 1>&2; }

require_macos(){
  if [[ "$(uname -s)" != "Darwin" ]]; then err "This installer supports macOS only"; exit 1; fi
}

ensure_helper_layout(){
  if [[ ! -d "$HELPER_DIR" ]]; then
    err "Helper directory not found: $HELPER_DIR"; exit 1
  fi
  if [[ ! -f "$HELPER_DIR/run.sh" ]]; then
    err "Missing $HELPER_DIR/run.sh"; exit 1
  fi
  if [[ ! -f "$HELPER_DIR/requirements.txt" ]]; then
    err "Missing $HELPER_DIR/requirements.txt"; exit 1
  fi
}

choose_python(){
  # Prefer python3.12, fallback to python3
  local py_bin=""
  if command -v python3.12 >/dev/null 2>&1; then py_bin="$(command -v python3.12)"; fi
  if [[ -z "$py_bin" ]] && command -v /opt/homebrew/bin/python3.12 >/dev/null 2>&1; then py_bin="/opt/homebrew/bin/python3.12"; fi
  if [[ -z "$py_bin" ]] && command -v python3 >/dev/null 2>&1; then py_bin="$(command -v python3)"; fi
  if [[ -z "$py_bin" ]]; then
    warn "python3 not found. Attempting to install Command Line Tools (may prompt)…"
    xcode-select --install || true
    sleep 2
    if command -v python3 >/dev/null 2>&1; then py_bin="$(command -v python3)"; fi
  fi
  if [[ -z "$py_bin" ]]; then err "No python3 available. Please install Python 3.12 (brew install python@3.12) and re-run."; exit 1; fi
  echo "$py_bin"
}

ensure_tls_cert(){
  mkdir -p "$CERT_DIR"
  if [[ -f "$CERT_PEM" && -f "$KEY_PEM" ]]; then
    log "TLS cert already exists: $CERT_PEM"
  else
    log "Generating self-signed TLS cert for localhost (openssl)…"
    openssl req -x509 -newkey rsa:2048 -sha256 -days 825 -nodes \
      -keyout "$KEY_PEM" -out "$CERT_PEM" \
      -subj "/CN=localhost" \
      -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1"
  fi
  # Trust the cert in login keychain (may prompt for password)
  if security find-certificate -c "localhost" "$HOME/Library/Keychains/login.keychain-db" >/dev/null 2>&1; then
    log "Certificate already in login keychain"
  else
    log "Trusting certificate in login keychain (may prompt)…"
    sudo security add-trusted-cert -d -r trustRoot -k "$HOME/Library/Keychains/login.keychain-db" "$CERT_PEM" || {
      warn "Failed to add trusted cert automatically. You may need to open Keychain Access and trust $CERT_PEM manually.";
    }
  fi
}

setup_venv(){
  local py_bin="$1"
  cd "$HELPER_DIR"
  if [[ ! -d .venv ]]; then
    log "Creating venv with $py_bin"
    "$py_bin" -m venv .venv
  else
    log "venv already exists"
  fi
  # Activate and install deps
  # shellcheck source=/dev/null
  source .venv/bin/activate
  python -V
  pip install --upgrade pip
  # Handle Python 3.13 fallback for pydantic-core
  local ver
  ver="$(python -c 'import sys; print("%d.%d"%sys.version_info[:2])')"
  if [[ "$ver" == "3.13" ]]; then
    export PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1
    warn "Using Python 3.13; enabling ABI3 forward compat for pydantic-core (build may take longer)."
  fi
  pip install -r requirements.txt
}

write_launchagent(){
  local plist_tmp
  plist_tmp="$(mktemp)"
  cat > "$plist_tmp" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.sweperf.helper</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>-lc</string>
    <string>cd "$HELPER_DIR" && PORT=$PORT SWEP_ALLOWED_ORIGINS="${SWEP_ALLOWED_ORIGINS:-$ALLOWED_ORIGINS_DEFAULT}" ./run.sh</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/sweperf-helper.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/sweperf-helper.err</string>
</dict></plist>
PLIST
  mkdir -p "$(dirname "$LAUNCH_PLIST")"
  cp "$plist_tmp" "$LAUNCH_PLIST"
  rm -f "$plist_tmp"
  log "LaunchAgent written: $LAUNCH_PLIST"
}

reload_launchagent(){
  # Unload if exists
  launchctl bootout "gui/$(id -u)/com.sweperf.helper" >/dev/null 2>&1 || true
  # Load
  launchctl bootstrap "gui/$(id -u)" "$LAUNCH_PLIST"
  launchctl enable "gui/$(id -u)/com.sweperf.helper"
  launchctl kickstart -k "gui/$(id -u)/com.sweperf.helper"
  log "Helper service started on https://127.0.0.1:$PORT"
}

verify(){
  log "Verifying /api/health…"
  curl -s -D - -o /dev/null "https://127.0.0.1:$PORT/api/health" || true
  curl -s "https://127.0.0.1:$PORT/api/health" | cat || true
}

main(){
  require_macos
  ensure_helper_layout
  ensure_tls_cert
  local PY
  PY="$(choose_python)"
  setup_venv "$PY"
  write_launchagent
  reload_launchagent
  verify
  log "Done. If the browser warns about certificate, visit https://127.0.0.1:$PORT/api/health once to establish trust."
}

main "$@" 