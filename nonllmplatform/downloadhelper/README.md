# SWEfficiency Helper (macOS)

A small local service that securely bridges the browser (the website) and your machine so you can run the Non‑LLM benchmark (in future: LLM benchmark) with Docker from the web UI—without uploading any local files or credentials.

## What is it?
- A FastAPI server listening on `127.0.0.1:5050` (HTTPS preferred)
- Installed under `~/.SWEfficiency/helper` (code + Python venv)
- Auto‑started at login via a LaunchAgent `com.SWEfficiency.helper`
- Only accepts requests from allowed web origins (CORS)
- Runs Docker jobs with restricted options (reduced privileges)

## What does it help with?
- 🧐 Health detection for the Non‑LLM Bench page
- 🏆 Contribute to SWEfficienct testing journey
- 🔍 Local Docker availability checks
- 🚀 Prepare and run benchmark jobs (Before/After) with your workload code
- 🔝 Optional upload to a public data repo (via GitHub Device Flow) only if you opt‑in

## Quick install (recommended)
Run this in Terminal (macOS 11+):
```bash
/bin/bash -lc 'curl -fsSL https://LichanghengXJTU.github.io/SWEfficiency/nonllmplatform/downloadhelper/install_helper.sh | bash'
```
The installer will:
- Generate and trust a localhost TLS certificate (`~/.SWEfficiency/certs/`)
- Create/update a Python virtual environment in `~/.SWEfficiency/helper/.venv`
- Install dependencies
- Write a LaunchAgent to auto‑start the Helper on login
- Start the Helper immediately and open the health endpoint once

## Restart / Uninstall
- Restart (stop then start):
```bash
launchctl bootout gui/$(id -u)/com.SWEfficiency.helper || true; \
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.SWEfficiency.helper.plist; \
launchctl enable gui/$(id -u)/com.sSWEfficiency.helper; \
launchctl kickstart -k gui/$(id -u)/com.SWEfficiency.helper
```
- Uninstall:
```bash
launchctl bootout gui/$(id -u)/com.SWEfficiency.helper || true; \
rm -f ~/Library/LaunchAgents/com.SWEfficiency.helper.plist; \
rm -rf ~/.SWEfficiency ~/SWEfficiencyWork
```

## Verify
```bash
curl -sk https://127.0.0.1:5050/api/health | cat
```
If you see JSON like:
```json
{"ok":true,"server":"SWEfficiency-helper","docker_sock":true}
```
you are ready to go. Then open the Non‑LLM Bench page on the website and click Retry.

## Privacy & Security
- Local‑only: all sensitive actions run on your machine. No inbound ports are exposed to the network; it only listens on `127.0.0.1`.
- HTTPS by default: a self‑signed certificate for localhost is generated and trusted locally.
- CORS allowlist: by default only allows `https://LichanghengXJTU.github.io` and `http://localhost:8000`. You can override via environment variables.
- Docker runs with reduced privileges (no new privileges, with limited CPU/mem usage).
- Helper do need network, but this is only for pulling docker images, which has limited actions.
- No data is uploaded unless you explicitly opt‑in on the page. Even then, only the benchmark record (workload text and metrics) is submitted to the public repository, and only if the improvement is above the threshold (15%).

## HTTP API (for reference)
The website calls the following endpoints:
- `GET /api/health` – helper health info
- `GET /api/docker/check` – check Docker availability
- `POST /api/bench/prepare` – create a job and write your workload code
- `POST /api/bench/run` – run Before/After and parse Mean/Std
- `POST /api/submit` – record a local submission (JSONL under `~/SWEfficiencyWork`)
- `POST /api/upload_run` – optional upload to the data repo via PR (if you opt‑in)
- `POST /api/upload/start` – start GitHub Device Flow auth and get a user code
- `POST /api/upload/token` – provide a personal token (fallback; not recommended, we have tried our best to avoid calling this method)

## Configuration
Environment variables (set them before starting or in the LaunchAgent):
- `SWEF_ALLOWED_ORIGINS` – comma‑separated CORS origins (default includes `https://LichanghengXJTU.github.io`)
- `SWEF_WORK_ROOT` – sandbox root (default `~/SWEfficiencyWork`)
- `SWEF_DATA_REPO` – GitHub repo to push PRs to (default `LichanghengXJTU/SWEf-data`)
- `SWEF_DATA_PATH` – path inside the repo (default `Non_LLM_user_data`, just for current version)
- `SWEF_GH_CLIENT_ID` / `SWEF_GH_CLIENT_SECRET` – GitHub Device Flow app creds (if not set, you may be asked to provide a token via `/api/upload/token`, but we have tested many times to make sure our oAuth App client id and client screte work)

## Logs
- Service stdout: `~/Library/Logs/SWEfficiency-helper.log`
- Service stderr: `~/Library/Logs/SWEfficiency-helper.err`
- Follow logs:
```bash
tail -f ~/Library/Logs/SWEfficiency-helper.log ~/Library/Logs/SWEfficiency-helper.err
```

## Requirements
- macOS 11+
- Python 3.12 preferred (the installer will create a venv)
- Docker Desktop (for running benchmarks)

## Troubleshooting
- Browser says certificate is not trusted
  - Visit `https://127.0.0.1:5050/api/health` once and accept the local certificate.
- CORS blocked
  - Ensure the page origin is in `SWEF_ALLOWED_ORIGINS` (default includes `https://LichanghengXJTU.github.io`). Restart the helper after changes.
- GitHub upload requires token
  - Set `SWEF_GH_CLIENT_ID/SECRET` for Device Flow, or provide a PAT to `/api/upload/token` as a fallback (outdated method).

## FAQ
- Q: Does the website upload my local files?
  - A: No. Only the workload code you paste, metadata, and metrics are used. Actual execution happens locally in Docker.
- Q: Can I disable uploads entirely?
  - A: Yes. Do not check the “I agree to upload” option; the page will only record locally. 
- Q: Can I uninstall helper anytime?
  - A: Anytime if you want! But when if you are running a benchmark testing, we will never get result of that task.
- Q: If I met some weird ocassions?
  - A: Feel free to contact with us with sufficient description!