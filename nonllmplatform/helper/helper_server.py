# nonllmplatform/helper/helper_server.py
import os, json, pathlib, subprocess, shlex, time
from typing import Optional, List
from fastapi import FastAPI, Request, Body, HTTPException
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

def env_list(name: str, default: List[str]) -> List[str]:
    v = os.environ.get(name, "")
    if not v:
        return default
    return [s.strip() for s in v.split(",") if s.strip()]

ALLOWED_ORIGINS = env_list("SWEP_ALLOWED_ORIGINS", [
    "https://lichanghengxjtu.github.io",   # Pages 域（不含路径）
    "http://localhost:8000",
    "http://127.0.0.1:8000",
])

ROOT_DIR = os.environ.get("SWEP_WORK_ROOT", str(pathlib.Path.home() / "SweperfWork"))
SUBMIT_FILE = os.path.join(ROOT_DIR, "submissions.jsonl")

app = FastAPI(title="Sweperf Non-LLM helper")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def ensure_sandbox(path: str) -> str:
    p = pathlib.Path(path).resolve()
    root = pathlib.Path(ROOT_DIR).resolve()
    if not str(p).startswith(str(root)):
        raise HTTPException(403, "path escapes sandbox")
    return str(p)

def run_cmd(cmd: str, timeout: int = 240) -> subprocess.CompletedProcess:
    return subprocess.run(shlex.split(cmd), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=timeout)

def ok():
    return JSONResponse({"ok": True, "ts": int(time.time())})

def check_origin(request: Request):
    origin = request.headers.get("origin") or request.headers.get("referer", "")
    if origin and not any(origin.startswith(o) for o in ALLOWED_ORIGINS):
        raise HTTPException(403, "origin not allowed")

@app.get("/api/health")
def health(request: Request):
    check_origin(request)
    os.makedirs(ROOT_DIR, exist_ok=True)
    return {
        "ok": True,
        "root": ROOT_DIR,
        "server": "sweperf-helper",
        "docker_sock": os.path.exists("/var/run/docker.sock"),
        "allowed_origins": ALLOWED_ORIGINS,
    }

@app.get("/api/docker/check")
def docker_check(request: Request):
    check_origin(request)
    try:
        cp = run_cmd("docker version --format {{json .}}", timeout=20)
        out = cp.stdout.decode("utf-8", "ignore")
        available = (cp.returncode == 0)
        return {"available": available, "output": out}
    except Exception as e:
        return {"available": False, "error": str(e)}

class RunReq(BaseModel):
    repo: str
    commit: Optional[str] = None
    test: Optional[str] = None
    image: Optional[str] = "ubuntu:22.04"
    subdir: Optional[str] = "job"

@app.post("/api/run")
def run_pipeline(req: RunReq, request: Request):
    check_origin(request)
    os.makedirs(ROOT_DIR, exist_ok=True)
    job_dir = ensure_sandbox(os.path.join(ROOT_DIR, req.subdir or "job"))
    os.makedirs(job_dir, exist_ok=True)

    pull = run_cmd(f"docker pull {req.image}", timeout=180)

    cmd = (
        f"docker run --rm --cpus=1 --memory=1g --pids-limit=256 "
        f"--network=none --cap-drop=ALL --security-opt no-new-privileges "
        f"-v {shlex.quote(job_dir)}:/work "
        f"{req.image} /bin/bash -lc "
        f"\"set -e; echo 'repo={req.repo}'; echo 'commit={req.commit or ''}'; "
        f"echo 'test={req.test or ''}'; echo 'working in /work'; ls -la /work; \""
    )
    try:
        runp = run_cmd(cmd, timeout=180)
        combined = (pull.stdout + b'\n---\n' + runp.stdout).decode("utf-8","ignore")
        return PlainTextResponse(combined, media_type="text/plain")
    except Exception as e:
        return PlainTextResponse(f"error: {e}", status_code=500)

class SubmitReq(BaseModel):
    email: Optional[str] = None
    notes: Optional[str] = None
    meta: Optional[dict] = None

@app.post("/api/submit")
def submit(req: SubmitReq, request: Request):
    check_origin(request)
    os.makedirs(ROOT_DIR, exist_ok=True)
    rec = {"ts": int(time.time()), "email": req.email, "notes": req.notes, "meta": req.meta or {}}
    with open(SUBMIT_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    return ok()
