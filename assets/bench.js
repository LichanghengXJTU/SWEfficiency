/* assets/bench.js */
(() => {
  "use strict";

  const ENDPOINT = 'https://127.0.0.1:5050';
  const $ = (id) => document.getElementById(id);
  const log = (el, msg) => { if (el) el.textContent = String(msg); };
  const setStatus = (el, text, cls=[]) => { if (!el) return; el.textContent = text; el.classList.remove('ok','fail'); cls.forEach(c => el.classList.add(c)); };

  const copyText = (txt) => { try { navigator.clipboard.writeText(txt); } catch(e){} };

  // Helper health & docker check (unchanged)
  async function getJSON(path, opts={}){
    const res = await fetch(`${ENDPOINT}${path}`, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers||{}) } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const txt = await res.text(); try { return JSON.parse(txt); } catch { return { raw: txt }; }
  }
  async function health(){ const s=$('helper-status'), h=$('health-log'); try{ setStatus(s,'Checking...',[]); const data=await getJSON('/api/health'); setStatus(s,'Connected',['ok']); log(h, JSON.stringify(data,null,2)); }catch(e){ setStatus(s,'Offline',['fail']); log(h,String(e)); } }
  async function dockerCheck(){ const s=$('docker-status'), d=$('docker-log'); try{ setStatus(s,'Checking...',[]); const data=await getJSON('/api/docker/check'); const ok = !!(data && (data.ok || data.available)); setStatus(s, ok ? 'Available' : 'Unavailable', ok?['ok']:['fail']); log(d, JSON.stringify(data, null, 2)); }catch(e){ setStatus(s,'Error',['fail']); log(d,String(e)); } }

  // New: inference & code lint
  const isGithub = (s) => /^https?:\/\/github\.com\//i.test(s.trim());
  const isDocker = (s) => /^(docker\.|ghcr\.|quay\.|[\w.-]+\/)\S+:/.test(s.trim());
  const isInstance = (s) => /^[\w.-]+__[^\s:]+-\d+$/i.test(s.trim());

  function parseInstanceId(input){
    const s = input.trim();
    if (isGithub(s)){
      // https://github.com/<org>/<repo>/pull/<pr>
      const m = s.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/i);
      if (m) return `${m[1]}__${m[2]}-${m[3]}`;
    } else if (isDocker(s)){
      // docker.io/sweperf/sweperf_annotate:<instance>
      const mm = s.split(':'); const tag = mm[1]||''; if (isInstance(tag)) return tag;
    } else if (isInstance(s)){
      return s;
    }
    return null;
  }

  function imageFromInstance(instance){
    return `docker.io/sweperf/sweperf_annotate:${instance}`;
  }

  function genDockerCmd(hostPath, image){
    const src = hostPath ? JSON.stringify(hostPath) : '<REPLACE_ME>'; // quote when known
    return `docker run -it --rm --cpus=1 --memory=1g --pids-limit=256 --network=none --cap-drop=ALL --security-opt no-new-privileges --mount type=bind,src=${src},dst=/tmp/workload.py ${image} /bin/bash`;
  }

  function lintCode(code){
    const hints = [];
    const needImports = [/\bimport\s+timeit\b/, /\bimport\s+statistics\b/];
    needImports.forEach(r=>{ if(!r.test(code)) hints.push('Missing required import: ' + r.source.replace(/\\b/g,'')); });
    if (!/Mean\s*:/.test(code)) hints.push('Expected print("Mean:", value)');
    if (!/(Std\s*Dev|Std)\s*:/.test(code)) hints.push('Expected print("Std Dev:", value)');
    // Light weight sanity: ensure not empty and has some numeric usage
    if (code.trim().length < 20) hints.push('Code seems too short');
    return hints;
  }

  // New pipeline
  let runAbort = null;
  async function runBenchmark(){
    const idInput = $('bench-id').value;
    const code = $('bench-code').value;
    const hints = lintCode(code);
    const hintBox = $('bench-hints');
    if (hints.length){ hintBox.style.display='block'; hintBox.textContent = 'Hints: ' + hints.join(' · '); } else { hintBox.style.display='none'; }
    if (!idInput.trim()) { log($('run-log'), 'Please input Link/Image/Instance ID'); return; }
    const inst = parseInstanceId(idInput);
    if (!inst){ log($('run-log'), 'Cannot infer instance id from input'); return; }
    const image = imageFromInstance(inst);
    $('bench-image').textContent = image;

    // Prepare (server writes code to a temp file and returns host path + command)
    let prep;
    try{
      prep = await getJSON('/api/bench/prepare', { method:'POST', body: JSON.stringify({ instance: inst, image, code }) });
    }catch(e){ log($('run-log'), String(e)); return; }
    const cmd = genDockerCmd(prep.hostWorkloadPath, image);
    log($('bench-cmd'), cmd);

    // Run (before/after)
    if (runAbort){ runAbort.abort(); runAbort = null; }
    runAbort = new AbortController();
    log($('run-log'), 'running benchmark...');
    try{
      const data = await getJSON('/api/bench/run', { method:'POST', signal: runAbort.signal, body: JSON.stringify({ jobId: prep.jobId }) });
      // Render before
      $('before-mean').textContent = data.before?.mean ?? '—';
      $('before-std').textContent = data.before?.std ?? '—';
      log($('before-log'), data.before?.error || data.before?.raw || '');
      // Render after
      $('after-mean').textContent = data.after?.mean ?? '—';
      $('after-std').textContent = data.after?.std ?? '—';
      log($('after-log'), data.after?.error || data.after?.raw || '');
      // Improvement
      const bm = parseFloat(data.before?.mean); const am = parseFloat(data.after?.mean);
      if (isFinite(bm) && isFinite(am)){
        const diff = ((bm - am)/bm)*100; const tag = diff>=0 ? 'faster' : 'slower';
        $('bench-diff').textContent = `Improvement: ${tag} ${Math.abs(diff).toFixed(2)}%`;
      } else {
        $('bench-diff').textContent = 'Improvement: —';
      }
    }catch(e){ log($('run-log'), String(e)); }
  }

  function cancelRun(){ if (runAbort){ runAbort.abort(); runAbort=null; } log($('run-log'), 'canceled'); }

  document.addEventListener('DOMContentLoaded', () => {
    $('helper-endpoint') && ($('helper-endpoint').textContent = ENDPOINT);
    $('btn-retry')?.addEventListener('click', health);
    $('btn-docker')?.addEventListener('click', dockerCheck);
    $('btn-lint')?.addEventListener('click', () => {
      const hints = lintCode(($('bench-code')?.value)||'');
      const box = $('bench-hints');
      if (hints.length){ box.style.display='block'; box.textContent = 'Hints: ' + hints.join(' · '); } else { box.style.display='none'; }
    });
    $('btn-bench-run')?.addEventListener('click', runBenchmark);
    $('btn-bench-cancel')?.addEventListener('click', cancelRun);
    $('copy-before')?.addEventListener('click', () => copyText(`Mean: ${$('before-mean').textContent} | Std: ${$('before-std').textContent}`));
    $('copy-after')?.addEventListener('click', () => copyText(`Mean: ${$('after-mean').textContent} | Std: ${$('after-std').textContent}`));
    // auto ping health once
    health();
  });
})(); 