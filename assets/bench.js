/* assets/bench.js */
(() => {
  "use strict";

  const ENDPOINT = 'https://127.0.0.1:5050';
  const $ = (id) => document.getElementById(id);
  const log = (el, msg) => { if (el) el.textContent = String(msg); };
  const setStatus = (el, text, cls=[]) => {
    if (!el) return; el.textContent = text; el.classList.remove('ok','fail'); cls.forEach(c => el.classList.add(c));
  };

  async function getJSON(path, opts={}){
    const res = await fetch(`${ENDPOINT}${path}`, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers||{}) } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const txt = await res.text();
    try { return JSON.parse(txt); } catch { return { raw: txt }; }
  }

  async function health(){
    const s = $('helper-status'); const hlog = $('health-log');
    try{
      setStatus(s, 'Checking...', []);
      const data = await getJSON('/api/health');
      setStatus(s, 'Connected', ['ok']);
      log(hlog, JSON.stringify(data, null, 2));
    }catch(e){ setStatus(s, 'Offline', ['fail']); log(hlog, String(e)); }
  }

  async function dockerCheck(){
    const s = $('docker-status'); const dlog = $('docker-log');
    try{
      setStatus(s, 'Checking...', []);
      const data = await getJSON('/api/docker/check');
      const ok = !!(data && (data.ok || data.available));
      setStatus(s, ok ? 'Available' : 'Unavailable', ok ? ['ok'] : ['fail']);
      log(dlog, JSON.stringify(data, null, 2));
    }catch(e){ setStatus(s, 'Error', ['fail']); log(dlog, String(e)); }
  }

  let runAbort = null;
  async function runPipeline(){
    const rlog = $('run-log');
    const repo = $('repo-url').value.trim();
    const commit = $('commit-sha').value.trim();
    const test = $('test-cmd').value.trim();
    if (!repo){ log(rlog, 'Please input repository URL'); return; }
    if (runAbort){ runAbort.abort(); runAbort = null; }
    runAbort = new AbortController();
    log(rlog, 'starting...');
    try{
      const body = { repo, commit: commit||undefined, test: test||undefined };
      const res = await fetch(`${ENDPOINT}/api/run`, { method:'POST', body: JSON.stringify(body), headers:{'Content-Type':'application/json'}, signal: runAbort.signal });
      const txt = await res.text();
      log(rlog, txt);
    }catch(e){ log(rlog, String(e)); }
  }

  function cancelRun(){ if (runAbort){ runAbort.abort(); runAbort = null; } log($('run-log'), 'canceled'); }

  async function submitMeta(){
    const slog = $('submit-log');
    const email = $('user-email').value.trim();
    const notes = $('user-notes').value.trim();
    try{
      const res = await fetch(`${ENDPOINT}/api/submit`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, notes, ts: Date.now() }) });
      const txt = await res.text(); log(slog, txt);
    }catch(e){ log(slog, String(e)); }
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('helper-endpoint') && ($('helper-endpoint').textContent = ENDPOINT);
    $('btn-retry')?.addEventListener('click', health);
    $('btn-docker')?.addEventListener('click', dockerCheck);
    $('btn-run')?.addEventListener('click', runPipeline);
    $('btn-cancel')?.addEventListener('click', cancelRun);
    $('btn-submit')?.addEventListener('click', submitMeta);
    // auto ping once
    health();
  });
})(); 