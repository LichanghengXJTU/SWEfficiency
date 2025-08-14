# nonllmplatform/helper/helper_server.py
import os, json, pathlib, subprocess, shlex, time
from typing import Optional, List
from fastapi import FastAPI, Request, Body, HTTPException
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import re, secrets
from datetime import datetime

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
        cp = run_cmd("docker version --format '{{json .}}'", timeout=20)
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

class BenchPrepareReq(BaseModel):
    instance: str
    image: str
    code: str

class BenchPrepareResp(BaseModel):
    ok: bool
    jobId: str
    hostWorkloadPath: str

@app.post("/api/bench/prepare")
def bench_prepare(req: BenchPrepareReq, request: Request):
    check_origin(request)
    os.makedirs(ROOT_DIR, exist_ok=True)
    job_id = f"job-{int(time.time())}-{secrets.token_hex(4)}"
    job_dir = ensure_sandbox(os.path.join(ROOT_DIR, job_id))
    os.makedirs(job_dir, exist_ok=True)
    workload_path = os.path.join(job_dir, "workload.py")
    with open(workload_path, "w", encoding="utf-8") as f:
        f.write(req.code)
    meta = {"instance": req.instance, "image": req.image, "created": int(time.time())}
    with open(os.path.join(job_dir, "meta.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f)
    return JSONResponse({"ok": True, "jobId": job_id, "hostWorkloadPath": workload_path})

class BenchRunReq(BaseModel):
    jobId: str

# Simple log parser for PERF_START/END and Mean/Std extraction
MEAN_RE = re.compile(r"Mean\s*:\s*([0-9.+-Ee]+)")
STD_RE = re.compile(r"(?:Std\s*Dev|Std)\s*:\s*([0-9.+-Ee]+)")

def parse_perf_core(txt: str):
    core = ""
    try:
        start = txt.index("PERF_START:")
        end = txt.index("PERF_END:", start)
        segment = txt[start:end]
        # Remove boilerplate markers
        segment = re.sub(r"\+\s*python\s+/tmp/workload\.py\s*", "", segment)
        segment = re.sub(r"\+\s*echo\s+PERF_START:\s*", "", segment)
        core = segment.strip()
    except ValueError:
        core = txt  # fallback to entire log
    mean = None; std = None
    m = MEAN_RE.search(core)
    if m: 
        try: mean = float(m.group(1))
        except: pass
    s = STD_RE.search(core)
    if s:
        try: std = float(s.group(1))
        except: pass
    # Remove lines that contain Mean/Std for error-only view
    err = re.sub(MEAN_RE, "", core)
    err = re.sub(STD_RE, "", err)
    err = err.strip()
    return {"core": core, "mean": mean, "std": std, "error": (err if err else None)}

@app.post("/api/bench/run")
def bench_run(req: BenchRunReq, request: Request):
    check_origin(request)
    os.makedirs(ROOT_DIR, exist_ok=True)
    job_dir = ensure_sandbox(os.path.join(ROOT_DIR, req.jobId))
    meta_path = os.path.join(job_dir, "meta.json")
    workload_path = os.path.join(job_dir, "workload.py")
    if not (os.path.exists(meta_path) and os.path.exists(workload_path)):
        raise HTTPException(400, "invalid jobId")
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
    image = meta.get("image")

    # Pull image (best-effort)
    try:
        run_cmd(f"docker pull {image}", timeout=240)
    except Exception:
        pass

    # Helper to exec inside container and collect logs
    def exec_phase(phase: str):
        # Mount workload.py into /tmp/workload.py and run /perf.sh
        cmd = (
            f"docker run -it --rm "
            f"--mount type=bind,src={shlex.quote(workload_path)},dst=/tmp/workload.py "
            f"{image} /bin/bash -lc "
            f"\"set +e; echo PERF_START:; python /tmp/workload.py; echo PERF_END:; "
            f"if [ -f /perf.sh ]; then chmod +x /perf.sh; /perf.sh || true; fi\""
        )
        try:
            cp = run_cmd(cmd, timeout=1800)
            out = cp.stdout.decode("utf-8", "ignore")
            core = parse_perf_core(out)
            # Attach raw if needed
            core["raw"] = out
            return core
        except Exception as e:
            return {"error": str(e)}

    before = exec_phase("before")

    # Apply patch if present
    patch_path = os.path.join(job_dir, "patch.diff")
    if os.path.exists(patch_path):
        # Run an ephemeral container just to apply patch to repo inside image if required; skipped here
        pass

    after = exec_phase("after")

    return JSONResponse({"ok": True, "before": before, "after": after})
