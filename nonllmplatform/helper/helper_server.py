# nonllmplatform/helper/helper_server.py
# It is used to run the non-LLM benchmark and upload the results to the public repository.
# TODO: We will update this script to be more applicable to other platforms later.  
# TODO: We will update this script to be more applicable to other operating systems later.

import os, json, pathlib, subprocess, shlex, time
from typing import Optional, List
from fastapi import FastAPI, Request, Body, HTTPException
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import re, secrets
from datetime import datetime
import hashlib
import base64, requests

def env_list(name: str, default: List[str], fallback_names: List[str] = []) -> List[str]:
    v = os.environ.get(name, "")
    if not v:
        for alt in fallback_names:
            v = os.environ.get(alt, "")
            if v:
                break
        if not v:
            return default
    return [s.strip() for s in v.split(",") if s.strip()]

ALLOWED_ORIGINS = env_list(
    "SWEF_ALLOWED_ORIGINS",
    [
        "https://LichanghengXJTU.github.io",   # Pages origin (no path)
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    fallback_names=["SWEP_ALLOWED_ORIGINS"],
)

ROOT_DIR = os.environ.get("SWEF_WORK_ROOT", os.environ.get("SWEP_WORK_ROOT", str(pathlib.Path.home() / "SWEfficiencyWork")))
SUBMIT_FILE = os.path.join(ROOT_DIR, "submissions.jsonl")
TOKEN_DIR = os.path.join(pathlib.Path.home(), ".SWEfficiency")
TOKEN_FILE = os.path.join(TOKEN_DIR, "github_token")
DATA_REPO = os.environ.get("SWEF_DATA_REPO", "lichanghengxjtu/SWEf-data")
DATA_PATH = os.environ.get("SWEF_DATA_PATH", "Non_LLM_user_data")
GH_CLIENT_ID = os.environ.get("SWEF_GH_CLIENT_ID")
GH_CLIENT_SECRET = os.environ.get("SWEF_GH_CLIENT_SECRET")

app = FastAPI(title="SWEfficiency Non-LLM helper")

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
        "server": "swefficiency-helper",
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

# Parse BEFORE/AFTER two segments of output
def parse_perf_two(txt: str):
    def extract(tag: str):
        start_tag = f"PERF_START:{tag}"
        end_tag = f"PERF_END:{tag}"
        try:
            s = txt.index(start_tag)
            e = txt.index(end_tag, s)
            seg = txt[s:e]
        except ValueError:
            return {"core": "", "mean": None, "std": None, "error": None}
        # Prefer inner markers (from workload), anchored by shell trace + echo and Python run
        inner_core = None
        # Pattern 1: '+ echo PERF_START:' then '+ python ...' then a lone 'PERF_START:' line
        m1 = re.search(r"(?ms)^\+\s+echo\s+PERF_START:\s*\n^PERF_START:\s*\n^\+\s+python\s+.*\n", seg)
        # Pattern 2: fallback to a lone 'PERF_START:' line
        m2 = re.search(r"(?m)^PERF_START:\s*$", seg)
        start_idx = None
        if m1:
            start_idx = m1.end()
        elif m2:
            start_idx = m2.end()
        # Pattern end: a lone 'PERF_END:' line, ideally before '+ echo PERF_END:'
        m3 = re.search(r"(?ms)^PERF_END:\s*\n^\+\s+echo\s+PERF_END:\s*", seg)
        m4 = re.search(r"(?m)^PERF_END:\s*$", seg)
        end_idx = None
        if m3:
            end_idx = m3.start()
        elif m4:
            end_idx = m4.start()
        if start_idx is not None and end_idx is not None and end_idx > start_idx:
            inner_core = seg[start_idx:end_idx]
        else:
            # Last resort: simple inner between first PERF_START: and next PERF_END:
            try:
                i_s = seg.index("PERF_START:")
                i_e = seg.index("PERF_END:", i_s)
                inner_core = seg[i_s + len("PERF_START:"): i_e]
            except ValueError:
                inner_core = None
        core = (inner_core if inner_core is not None else seg).strip()
        m = MEAN_RE.search(core)
        mean = float(m.group(1)) if m else None
        sdev = STD_RE.search(core)
        std = float(sdev.group(1)) if sdev else None
        # error = core content minus Mean/Std lines
        err = re.sub(MEAN_RE, "", core)
        err = re.sub(STD_RE, "", err)
        # remove empty lines and shell trace lines
        err_lines = [ln for ln in (err.splitlines()) if ln.strip() and not ln.lstrip().startswith('+')]
        err = "\n".join(err_lines).strip()
        return {"core": core, "mean": mean, "std": std, "error": (err if err else None)}
    return {"before": extract("BEFORE"), "after": extract("AFTER")}

@app.post("/api/bench/run")
def bench_run(req: BenchRunReq, request: Request):
    check_origin(request)
    os.makedirs(ROOT_DIR, exist_ok=True)
    job_dir = ensure_sandbox(os.path.join(ROOT_DIR, req.jobId))
    meta_path = os.path.join(job_dir, "meta.json")
    workload_path = os.path.join(job_dir, "workload.py")
    patch_path = os.path.join(job_dir, "patch.diff")
    if not (os.path.exists(meta_path) and os.path.exists(workload_path)):
        raise HTTPException(400, "invalid jobId")
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
    image = meta.get("image")

    # Pull image (try our best)
    try:
        run_cmd(f"docker pull {image}", timeout=240)
    except Exception:
        pass

    # Only one entry into the container: BEFORE, git apply, AFTER
    mounts = [f"--mount type=bind,src={shlex.quote(workload_path)},dst=/tmp/workload.py"]
    if os.path.exists(patch_path):
        mounts.append(f"--mount type=bind,src={shlex.quote(patch_path)},dst=/tmp/patch.diff")
    mounts_str = " ".join(mounts)

    cmd = (
        f"docker run --rm {mounts_str} {image} /bin/bash -lc "
        f"\"set +e; "
        f"if [ -f /perf.sh ]; then chmod +x /perf.sh; fi; "
        f"echo PERF_START:BEFORE; /perf.sh || true; echo PERF_END:BEFORE; "
        f"if [ ! -f /tmp/patch.diff ]; then echo 'ERROR: docker内部不完全，没有/tmp/patch.diff'; exit 2; fi; "
        f"cd /testbed 2>/dev/null || true; git apply /tmp/patch.diff || true; cd - >/dev/null 2>&1 || true; "
        f"echo PERF_START:AFTER; /perf.sh || true; echo PERF_END:AFTER\""
    )
    try:
        cp = run_cmd(cmd, timeout=1800)
        out = cp.stdout.decode("utf-8", "ignore")
        parsed = parse_perf_two(out)
        parsed["before"]["raw"] = out
        parsed["after"]["raw"] = out
        return JSONResponse({"ok": True, "before": parsed["before"], "after": parsed["after"]})
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)

class UploadReq(BaseModel):
    image: str
    instanceId: Optional[str] = None
    githubUrl: Optional[str] = None
    workload_b64: str
    before: dict
    after: dict
    improvement: float
    notes: Optional[str] = None
    ts: Optional[int] = None

class TokenReq(BaseModel):
    token: str

@app.post("/api/upload/token")
def save_token(req: TokenReq, request: Request):
    check_origin(request)
    os.makedirs(TOKEN_DIR, exist_ok=True)
    with open(TOKEN_FILE, "w", encoding="utf-8") as f:
        f.write(req.token.strip())
    return ok()

GITHUB_API = "https://api.github.com"
DEVICE_FLOW_FILE = os.path.join(TOKEN_DIR, "device_flow.json")

def gh_headers(token: str):
    return {"Authorization": f"token {token}", "Accept": "application/vnd.github+json"}

def parse_instance_from_github(url: str) -> Optional[str]:
    m = re.search(r"github\.com/([^/]+)/([^/]+)/pull/(\d+)", url)
    if not m: return None
    return f"{m.group(1)}__{m.group(2)}-{m.group(3)}"

@app.post("/api/upload/start")
def upload_start(request: Request):
    check_origin(request)
    if not (GH_CLIENT_ID and GH_CLIENT_SECRET):
        return JSONResponse({"ok": False, "needToken": True, "message": "GitHub token required. Configure device flow secrets or use /api/upload/token."}, status_code=400)
    # Reuse pending code if exists and fresh
    if os.path.exists(DEVICE_FLOW_FILE):
        try:
            with open(DEVICE_FLOW_FILE, "r", encoding="utf-8") as f:
                st = json.load(f)
            user_code = st.get("user_code") or st.get("userCode")
            verify_uri = st.get("verify_uri") or st.get("verifyUri") or "https://github.com/login/device"
            created = int(st.get("created", 0))
            if user_code and int(time.time()) - created < 600:
                return JSONResponse({"ok": True, "needDevice": True, "verifyUri": verify_uri, "userCode": user_code})
        except Exception:
            pass
    try:
        resp = requests.post(
            "https://github.com/login/device/code",
            data={"client_id": GH_CLIENT_ID, "scope": "repo"},
            headers={"Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded"},
        )
        if resp.status_code == 429 or (resp.headers.get("Content-Type","" ).find("application/json") == -1):
            return JSONResponse({"ok": False, "message": "GitHub rate-limited. Please wait a few minutes and try again."}, status_code=429)
        dc = resp.json()
        verify_uri = dc.get("verification_uri") or "https://github.com/login/device"
        user_code = dc.get("user_code"); device_code = dc.get("device_code"); interval = int(dc.get("interval", 5))
        os.makedirs(TOKEN_DIR, exist_ok=True)
        with open(DEVICE_FLOW_FILE, "w", encoding="utf-8") as f:
            json.dump({
                "device_code": device_code,
                "interval": interval,
                "created": int(time.time()),
                "user_code": user_code,
                "verify_uri": verify_uri
            }, f)
        return JSONResponse({"ok": True, "needDevice": True, "verifyUri": verify_uri, "userCode": user_code})
    except Exception as e:
        return JSONResponse({"ok": False, "message": f"Device flow init failed: {e}"}, status_code=500)

@app.post("/api/upload_run")
def upload_run(req: UploadReq, request: Request):
    check_origin(request)
    os.makedirs(ROOT_DIR, exist_ok=True)

    # Normalize instance/image
    instance = req.instanceId or (parse_instance_from_github(req.githubUrl or "") or "")
    image = req.image or (f"docker.io/sweperf/sweperf_annotate:{instance}" if instance else req.image)

    # Local audit
    # Normalize timestamp to seconds (handle ms and string inputs)
    try:
        _ts_raw = req.ts if (req.ts is not None) else int(time.time())
        _ts_float = float(_ts_raw)
        if _ts_float > 1e12:  # likely milliseconds
            _ts_float = _ts_float / 1000.0
        _ts_norm = int(_ts_float)
    except Exception:
        _ts_norm = int(time.time())

    # Decode workload_b64 into UTF-8 string for human-readable storage
    workload_str = None
    try:
        workload_str = base64.b64decode(req.workload_b64).decode("utf-8", "replace") if req.workload_b64 else None
    except Exception:
        workload_str = None

    record = {
        "id": f"job-{int(time.time())}-{secrets.token_hex(4)}",
        "ts": _ts_norm,
        "image": image,
        "instanceId": instance,
        "githubUrl": req.githubUrl,
        "workload": workload_str,
        "before": req.before,
        "after": req.after,
        "improvement": req.improvement,
        "notes": req.notes,
        "client": {"helper_version": "1.0"}
    }
    with open(SUBMIT_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")

    # Threshold check
    if not isinstance(req.improvement, (int, float)) or req.improvement <= 15:
        return JSONResponse({"ok": True, "uploaded": False, "message": "Thanks! Recorded locally (improvement ≤ 15%, not uploaded)."})

    # Need token
    token = None
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, "r", encoding="utf-8") as f:
            token = f.read().strip()
    # If have pending device flow, try a quick poll
    if not token and os.path.exists(DEVICE_FLOW_FILE) and GH_CLIENT_ID and GH_CLIENT_SECRET:
        try:
            with open(DEVICE_FLOW_FILE, "r", encoding="utf-8") as f:
                st = json.load(f)
            device_code = st.get("device_code"); interval = int(st.get("interval", 5))
            resp = requests.post(
                "https://github.com/login/oauth/access_token",
                data={
                    "client_id": GH_CLIENT_ID,
                    "device_code": device_code,
                    "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                    "client_secret": GH_CLIENT_SECRET,
                },
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )
            try:
                tok = resp.json()
            except Exception:
                return JSONResponse({"ok": False, "uploaded": False, "message": resp.text or "Device token polling returned non-JSON"}, status_code=502)
            if tok.get("access_token"):
                token = tok["access_token"]
                os.makedirs(TOKEN_DIR, exist_ok=True)
                with open(TOKEN_FILE, "w", encoding="utf-8") as f:
                    f.write(token)
                try: os.remove(DEVICE_FLOW_FILE)
                except Exception: pass
        except Exception as e:
            return JSONResponse({"ok": False, "uploaded": False, "message": f"Device token polling failed: {e}"}, status_code=502)

    if not token:
        if not (GH_CLIENT_ID and GH_CLIENT_SECRET):
            return JSONResponse({"ok": True, "uploaded": False, "needToken": True, "message": "GitHub token required. Please create a PAT with repo scope and POST it to /api/upload/token."})
        # If there is a pending device authorization, reuse it, do not re-initialize to avoid rate limiting
        if os.path.exists(DEVICE_FLOW_FILE):
            try:
                with open(DEVICE_FLOW_FILE, "r", encoding="utf-8") as f:
                    st = json.load(f)
                verify_uri = st.get("verify_uri") or st.get("verifyUri") or "https://github.com/login/device"
                user_code = st.get("user_code") or st.get("userCode")
                created = int(st.get("created", 0))
                # Simple cooling: do not request new code within 60 seconds
                if user_code and (int(time.time()) - created < 60):
                    return JSONResponse({
                        "ok": True,
                        "uploaded": False,
                        "needDevice": True,
                        "verifyUri": verify_uri,
                        "userCode": user_code,
                        "message": "Please open the verification URL and enter the code, then click Submit & Upload again."
                    })
            except Exception:
                pass
        try:
            resp = requests.post(
                "https://github.com/login/device/code",
                data={"client_id": GH_CLIENT_ID, "scope": "repo"},
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )
            # 429 or HTML etc. non-JSON: return hint, avoid throwing exception
            if resp.status_code == 429 or (resp.headers.get("Content-Type","" ).find("application/json") == -1):
                # If there is a history code, return it first
                if os.path.exists(DEVICE_FLOW_FILE):
                    try:
                        with open(DEVICE_FLOW_FILE, "r", encoding="utf-8") as f:
                            st = json.load(f)
                        return JSONResponse({
                            "ok": True,
                            "uploaded": False,
                            "needDevice": True,
                            "verifyUri": st.get("verify_uri") or st.get("verifyUri") or "https://github.com/login/device",
                            "userCode": st.get("user_code") or st.get("userCode"),
                            "message": "GitHub rate-limited. Please use the existing code, wait a minute, then click Submit & Upload again."
                        })
                    except Exception:
                        pass
                return JSONResponse({"ok": False, "uploaded": False, "message": "GitHub rate-limited. Please wait 1–5 minutes and try again."}, status_code=429)
            try:
                dc = resp.json()
            except Exception:
                return JSONResponse({"ok": False, "uploaded": False, "message": resp.text or "Device code init returned non-JSON"}, status_code=502)
            verify_uri = dc.get("verification_uri") or "https://github.com/login/device"
            user_code = dc.get("user_code"); device_code = dc.get("device_code"); interval = int(dc.get("interval", 5))
            os.makedirs(TOKEN_DIR, exist_ok=True)
            with open(DEVICE_FLOW_FILE, "w", encoding="utf-8") as f:
                json.dump({
                    "device_code": device_code,
                    "interval": interval,
                    "created": int(time.time()),
                    "user_code": user_code,
                    "verify_uri": verify_uri
                }, f)
            return JSONResponse({
                "ok": True,
                "uploaded": False,
                "needDevice": True,
                "verifyUri": verify_uri,
                "userCode": user_code,
                "message": "Please open the verification URL and enter the code, then click Submit & Upload again."
            })
        except Exception as e:
            return JSONResponse({"ok": False, "uploaded": False, "message": f"Device flow init failed: {e}"}, status_code=500)

    # Build path Non_LLM_user_data/<instance>/<YYYYMMDD>.json
    if not instance:
        return JSONResponse({"ok": False, "uploaded": False, "message": "instanceId missing; cannot determine upload path."}, status_code=400)
    # Compute per-minute path and content fingerprint (dedup within the same day)
    _dt = datetime.utcfromtimestamp(record["ts"])
    date_str = _dt.strftime("%Y%m%d")
    hhmm = _dt.strftime("%H%M")
    # fingerprint over key fields
    _dedup_key = json.dumps({
        "instanceId": instance,
        "workload": record.get("workload"),
        "before": record.get("before"),
        "after": record.get("after"),
        "improvement": record.get("improvement"),
        "notes": record.get("notes")
    }, ensure_ascii=False, sort_keys=True)
    _hash8 = hashlib.sha256(_dedup_key.encode("utf-8")).hexdigest()[:8]
    rel_path = f"{DATA_PATH}/{instance}/{date_str}/{hhmm}-{_hash8}.json"

    # Create branch and PR
    try:
        # Get repo info
        repo = DATA_REPO
        s_resp = requests.get(f"{GITHUB_API}/repos/{repo}", headers=gh_headers(token))
        s_resp.raise_for_status()
        s = s_resp.json()
        default_branch = s.get("default_branch", "main")
 
        # Resolve base sha of default branch (try git/ref, fallback to branches API)
        base_sha = None
        ref_resp = requests.get(f"{GITHUB_API}/repos/{repo}/git/ref/heads/{default_branch}", headers=gh_headers(token))
        if ref_resp.ok:
            try:
                base_sha = (ref_resp.json().get("object") or {}).get("sha")
            except Exception:
                base_sha = None
        if not base_sha:
            br_resp = requests.get(f"{GITHUB_API}/repos/{repo}/branches/{default_branch}", headers=gh_headers(token))
            if br_resp.ok:
                try:
                    base_sha = (br_resp.json().get("commit") or {}).get("sha")
                except Exception:
                    base_sha = None
        if not base_sha or not isinstance(base_sha, str) or len(base_sha) < 7:
            return JSONResponse({
                "ok": False,
                "uploaded": False,
                "message": f"Cannot resolve base SHA for {repo}@{default_branch}."
            }, status_code=502)
 
        # Deterministic branch per instance-minute to reduce duplicates
        minute_str = _dt.strftime("%Y%m%d-%H%M")
        branch = f"submission-{instance}-{minute_str}"

        # Dedup against default branch within the same day by content hash
        dir_on_default = f"{DATA_PATH}/{instance}/{date_str}"
        list_resp = requests.get(f"{GITHUB_API}/repos/{repo}/contents/{dir_on_default}", headers=gh_headers(token), params={"ref": default_branch})
        if list_resp.ok and isinstance(list_resp.json(), list):
            try:
                names = [it.get("name","") for it in list_resp.json() if isinstance(it, dict)]
            except Exception:
                names = []
            if any(name.endswith(f"-{_hash8}.json") for name in names):
                return JSONResponse({
                    "ok": True,
                    "uploaded": False,
                    "message": "Identical submission exists today; skipped.",
                    "path": f"{dir_on_default}/*-{_hash8}.json"
                })

        # Ensure branch exists (idempotent)
        ref_check = requests.get(f"{GITHUB_API}/repos/{repo}/git/ref/heads/{branch}", headers=gh_headers(token))
        if ref_check.status_code == 404:
            create_payload = {"ref": f"refs/heads/{branch}", "sha": base_sha}
            create_resp = requests.post(f"{GITHUB_API}/repos/{repo}/git/refs", headers=gh_headers(token), json=create_payload)
            if not create_resp.ok:
                try:
                    detail = create_resp.json()
                except Exception:
                    detail = {"message": create_resp.text}
                return JSONResponse({
                    "ok": False,
                    "uploaded": False,
                    "message": f"Create ref failed: {detail.get('message','') or create_resp.text}",
                    "detail": detail
                }, status_code=create_resp.status_code or 500)

        # Ensure content exists on the branch at rel_path (create if missing)
        getc = requests.get(f"{GITHUB_API}/repos/{repo}/contents/{rel_path}?ref={branch}", headers=gh_headers(token))
        if getc.status_code == 404:
            content_b64 = base64.b64encode(json.dumps(record, ensure_ascii=False, indent=2).encode("utf-8")).decode("utf-8")
            put = requests.put(f"{GITHUB_API}/repos/{repo}/contents/{rel_path}", headers=gh_headers(token), json={
                "message": f"add Non-LLM user data {instance} {date_str} {hhmm}",
                "content": content_b64,
                "branch": branch
            })
            if not put.ok:
                try:
                    detail = put.json()
                except Exception:
                    detail = {"message": put.text}
                return JSONResponse({
                    "ok": False,
                    "uploaded": False,
                    "message": f"Put content failed: {detail.get('message','') or put.text}",
                    "detail": detail
                }, status_code=put.status_code or 500)

        # If a PR already exists for this branch, return it (idempotent)
        owner = repo.split('/')[0] if '/' in repo else repo
        prs = requests.get(f"{GITHUB_API}/repos/{repo}/pulls", headers=gh_headers(token), params={"state": "open", "head": f"{owner}:{branch}"})
        if prs.ok:
            lst = prs.json() if isinstance(prs.json(), list) else []
            if lst:
                pr_url = lst[0].get("html_url")
                return JSONResponse({"ok": True, "uploaded": True, "prUrl": pr_url, "path": rel_path})

        # Otherwise create a new PR
        pr = requests.post(f"{GITHUB_API}/repos/{repo}/pulls", headers=gh_headers(token), json={
            "title": f"Non-LLM user data: {instance}/{date_str}/{hhmm}-{_hash8}.json",
            "head": branch,
            "base": default_branch,
            "body": "Automated submission from SWEf Helper"
        })
        pr.raise_for_status()
        pr_url = pr.json().get("html_url")
        return JSONResponse({"ok": True, "uploaded": True, "prUrl": pr_url, "path": rel_path})
    except Exception as e:
        return JSONResponse({"ok": False, "uploaded": False, "message": f"Upload failed: {e}"}, status_code=500)
