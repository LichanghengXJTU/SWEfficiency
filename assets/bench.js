/* assets/bench.js */
// This is the benchmark page, which is used to run the non-LLM benchmark of the SWEfficiency.
// We will update this doc to add the LLM benchmark and correctness checker later.
(() => {
  "use strict";

  const ENDPOINT = 'https://127.0.0.1:5050';
  const $ = (id) => document.getElementById(id);
  const log = (el, msg) => { if (!el) return; el.textContent = String(msg ?? ''); };
  const setStatus = (el, text, cls=[]) => { if (!el) return; el.textContent = text; el.classList.remove('ok','fail'); cls.forEach(c => el.classList.add(c)); };
  const copyText = (txt) => { try { navigator.clipboard.writeText(txt); } catch(e){} };
  // Auto-upload timer
  let autoUploadTimer = null;
  let autoUploadBackoffMs = 10 * 60 * 1000; // 10 minutes
  let autoUploadAttempts = 0;
  const autoUploadMaxAttempts = 3;
  const dailyClickLocks = new Set(); // key: instance+YYYYMMDD to ensure single immediate attempt per click
  const clearAutoUpload = () => { if (autoUploadTimer){ clearTimeout(autoUploadTimer); autoUploadTimer=null; } };

  function collectUploadBody(){
    const image = $('bench-image').textContent.trim();
    const idraw = $('bench-id').value.trim();
    const instance = (idraw.match(/[\w.-]+__[^\s:]+-\d+/)||[])[0] || '';
    const code = $('bench-code').value;
    const workload_b64 = btoa(unescape(encodeURIComponent(code)));
    const before = { mean: parseFloat($('before-mean').textContent)||null, std: parseFloat($('before-std').textContent)||null };
    const after  = { mean: parseFloat($('after-mean').textContent)||null, std: parseFloat($('after-std').textContent)||null };
    let improvement = null; if (isFinite(before.mean) && isFinite(after.mean)){ improvement = ((before.mean - after.mean)/before.mean)*100; }
    const notes = $('user-notes').value.trim();
    const body = { image, instanceId: instance||undefined, githubUrl: isGithub(idraw)?idraw:undefined, workload_b64, before, after, improvement, notes, ts: Date.now() };
    return body;
  }

  // This is the function that uses three defensive measures to avoid uploading too many times
  // This will be called by oneClickSubmit() and autoUploadOnce()
  async function autoUploadOnce(){
    const ulog = $('upload-log');
    let shouldRetry = false;
    try{
      if (!$('agree-upload')?.checked){ clearAutoUpload(); return; }
      if (autoUploadAttempts >= autoUploadMaxAttempts){ clearAutoUpload(); return; }
      // basic sanity: need some metrics and image
      const body = collectUploadBody();
      if (!body.image){ clearAutoUpload(); return; }
      const res = await fetch(`${ENDPOINT}/api/upload_run`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.ok){
        if (json.uploaded && json.prUrl){ log(ulog, `Thanks! Uploaded. PR: ${json.prUrl}`); clearAutoUpload(); return; }
        if (json.needDevice && json.verifyUri && json.userCode){
          // still waiting for user to finish device auth
          log(ulog, `Waiting for device auth… Open ${json.verifyUri} and enter code: ${json.userCode}`);
        } else if (json.needToken){
          log(ulog, 'GitHub token required. Create a PAT with repo scope and POST to https://127.0.0.1:5050/api/upload/token');
          clearAutoUpload(); return;
        } else if (json.message){
          log(ulog, json.message);
          // Stop if recorded locally (<=15%)
          if (/Recorded locally/i.test(json.message) || /Identical submission exists/i.test(json.message)){ clearAutoUpload(); return; }
        } else {
          log(ulog, 'Submitting… waiting for authorization');
        }
        // Any HTTP 200 OK response: stop auto retries by default
        clearAutoUpload(); return;
      } else {
        // Non-ok: show message and keep limited retries
        log(ulog, json.message || 'Upload failed');
        if (!res.ok) shouldRetry = true;
      }
    }catch(e){
      log(ulog, String(e));
      shouldRetry = true;
    } finally {
      // schedule next try
      if (shouldRetry){
        autoUploadAttempts++;
        if (!autoUploadTimer && autoUploadAttempts < autoUploadMaxAttempts){ autoUploadTimer = setTimeout(()=>{ autoUploadTimer=null; autoUploadOnce(); }, autoUploadBackoffMs); }
      }
    }
  }

  async function getJSON(path, opts={}){
    const res = await fetch(`${ENDPOINT}${path}`, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers||{}) } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const txt = await res.text(); try { return JSON.parse(txt); } catch { return { raw: txt }; }
  }
  async function health(){ const s=$('helper-status'), h=$('health-log'); try{ setStatus(s,'Checking...',[]); const data=await getJSON('/api/health'); setStatus(s,'Connected',['ok']); log(h, JSON.stringify(data,null,2)); }catch(e){ setStatus(s,'Offline',['fail']); log(h,String(e)); } }
  async function dockerCheck(){ const s=$('docker-status'), d=$('docker-log'); try{ setStatus(s,'Checking...',[]); const data=await getJSON('/api/docker/check'); const ok = !!(data && (data.ok || data.available)); setStatus(s, ok ? 'Available' : 'Unavailable', ok?['ok']:['fail']); log(d, JSON.stringify(data, null, 2)); }catch(e){ setStatus(s,'Error',['fail']); log(d,String(e)); } }

  const isGithub = (s) => /^https?:\/\/github\.com\//i.test(s.trim());
  const isDocker = (s) => /^(docker\.|ghcr\.|quay\.|[\w.-]+\/)\S+:/.test(s.trim());
  const isInstance = (s) => /^[\w.-]+__[^\s:]+-\d+$/i.test(s.trim());
  function parseInstanceId(input){ const s=input.trim(); if(isGithub(s)){ const m=s.match(/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/i); if(m) return `${m[1]}__${m[2]}-${m[3]}`;} else if(isDocker(s)){ const mm=s.split(':'); const tag=mm[1]||''; if(isInstance(tag)) return tag;} else if(isInstance(s)){ return s;} return null; }
  function imageFromInstance(instance){ return `docker.io/sweperf/sweperf_annotate:${instance}`; }
  function genDockerCmd(hostPath, image){ const src=hostPath?JSON.stringify(hostPath):'<REPLACE_ME>'; return `docker run -it --mount type=bind,src=${src},dst=/tmp/workload.py ${image} /bin/bash`; }

  function lintCode(code){ const hints=[]; [/\bimport\s+timeit\b/,/\bimport\s+statistics\b/].forEach(r=>{ if(!r.test(code)) hints.push('Missing required import: '+r.source.replace(/\\b/g,''));}); if(!/Mean\s*:/.test(code)) hints.push('Expected print("Mean:", value)'); if(!/(Std\s*Dev|Std)\s*:/.test(code)) hints.push('Expected print("Std Dev:", value)'); if(code.trim().length<20) hints.push('Code seems too short'); return hints; }

  async function submitMeta(){
    const slog = $('submit-log');
    const notes = $('user-notes').value.trim();
    try{
      const res = await fetch(`${ENDPOINT}/api/submit`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ notes, ts: Date.now(), meta: {} }) });
      const txt = await res.text(); log(slog, txt);
    }catch(e){ log(slog, String(e)); }
  }

  async function uploadRun(){
    const ulog = $('upload-log');
    const agreed = $('agree-upload').checked;
    if (!agreed){ log(ulog, 'Local submit only. Tip: check “I agree to upload to SWEf‑data” to enable upload.'); return; }
    try{
      const body = collectUploadBody();
      const res = await fetch(`${ENDPOINT}/api/upload_run`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      const json = await res.json();
      if (json.ok){
        if (json.uploaded && json.prUrl){ log(ulog, `Thanks! Uploaded. PR: ${json.prUrl}`); }
        else if (json.needDevice && json.verifyUri && json.userCode){ log(ulog, `Open ${json.verifyUri} and enter code: ${json.userCode}. Auto-submit is ON.`); clearAutoUpload(); autoUploadOnce(); }
        else if (json.needToken){ log(ulog, 'GitHub token required.'); }
        else { log(ulog, json.message || 'Thanks! Recorded locally.'); }
      } else {
        log(ulog, json.message || 'Upload failed');
      }
    }catch(e){ log(ulog, String(e)); }
  }

  async function oneClickSubmit(){
    // always do a local submit first
    await submitMeta();
    // then try upload if agreed
    if ($('agree-upload')?.checked){
      // lock per instance+date to avoid rapid duplicate clicks
      const idraw = $('bench-id').value.trim();
      const instance = (idraw.match(/[\w.-]+__[^\s:]+-\d+/)||[])[0] || '';
      const today = new Date(); const dd = String(today.getUTCDate()).padStart(2,'0'); const mm = String(today.getUTCMonth()+1).padStart(2,'0'); const yyyy = today.getUTCFullYear();
      const key = `${instance}-${yyyy}${mm}${dd}`;
      if (dailyClickLocks.has(key)){
        // already attempted once this day for this instance in this page session
        return;
      }
      dailyClickLocks.add(key);
      autoUploadAttempts = 0; clearAutoUpload();
      await uploadRun(); // immediate attempt once
      // background retries (at most 2 more) handled by autoUploadOnce() in case of needDevice
    }
  }

  async function startAuth(){
    const ulog = $('upload-log');
    try{
      const res = await fetch(`${ENDPOINT}/api/upload/start`, { method:'POST' });
      const json = await res.json();
      if (json.ok && json.needDevice){
        if ($('agree-upload')?.checked){
          log(ulog, `Open ${json.verifyUri} and enter code: ${json.userCode}. Auto-submit is ON and will complete after authorization.`);
          clearAutoUpload(); autoUploadOnce();
        } else {
          log(ulog, `Open ${json.verifyUri} and enter code: ${json.userCode}. Tip: check “I agree to upload to SWEf‑data” to enable auto-submit.`);
        }
      } else {
        log(ulog, json.message || 'Unexpected response while starting authentication');
      }
    }catch(e){ log(ulog, String(e)); }
  }

  let runAbort=null;
  async function runBenchmark(){
    // reset UI
    log($('bench-cmd'), ''); log($('pull-log'), '');
    log($('before-log'), ''); log($('after-log'), '');
    $('before-mean').textContent='—'; $('before-std').textContent='—';
    $('after-mean').textContent='—'; $('after-std').textContent='—';

    const idInput=$('bench-id').value; const code=$('bench-code').value;
    const hints=lintCode(code); const hintBox=$('bench-hints');
    if(hints.length){ hintBox.style.display='block'; hintBox.textContent='Hints: '+hints.join(' · ');} else { hintBox.style.display='none'; }
    if(!idInput.trim()){ log($('before-log'),'Please input Link/Image/Instance ID'); return; }
    const inst=parseInstanceId(idInput); if(!inst){ log($('before-log'),'Cannot infer instance id from input'); return; }
    const image=imageFromInstance(inst); $('bench-image').textContent=image;

    let prep; try{ prep=await getJSON('/api/bench/prepare', { method:'POST', body: JSON.stringify({ instance: inst, image, code }) }); }catch(e){ log($('before-log'), String(e)); return; }
    const cmd=genDockerCmd(prep.hostWorkloadPath, image); log($('bench-cmd'), cmd);

    if(runAbort){ runAbort.abort(); runAbort=null; } runAbort=new AbortController();
    try{
      const data=await getJSON('/api/bench/run', { method:'POST', signal: runAbort.signal, body: JSON.stringify({ jobId: prep.jobId }) });
      const pullLines=[]; const rawBefore=(data.before&&data.before.raw)||''; const rawAfter=(data.after&&data.after.raw)||'';
      const collectPull=(txt)=>{ txt.split(/\n/).forEach(line=>{ if(/pull|download|extract/i.test(line)) pullLines.push(line); }); };
      collectPull(rawBefore); collectPull(rawAfter); if(pullLines.length) log($('pull-log'), pullLines.join('\n'));

      const bMean=(data.before&&data.before.mean!=null)? String(data.before.mean):null;
      const bStd=(data.before&&data.before.std!=null)? String(data.before.std):null;
      $('before-mean').textContent=bMean??'—'; $('before-std').textContent=bStd??'—';
      const aMean=(data.after&&data.after.mean!=null)? String(data.after.mean):null;
      const aStd=(data.after&&data.after.std!=null)? String(data.after.std):null;
      $('after-mean').textContent=aMean??'—'; $('after-std').textContent=aStd??'—';

      const beforeErr=(data.before?.error||'').trim();
      const afterErr=(data.after?.error||'').trim();
      const hasMetrics = (bMean!=null && bStd!=null && aMean!=null && aStd!=null);
      const hasError = (!!beforeErr || !!afterErr);

      // Show/hide blocks according to states
      const pair = $('results-pair');
      const beBox = $('before-error-box');
      const afBox = $('after-error-box');
      const impBox = $('improvement-box');

      // default hide
      pair.style.display = 'none'; beBox.style.display = 'none'; afBox.style.display = 'none'; impBox.style.display = 'none';
      log($('before-log'), ''); log($('after-log'), '');

      if (hasMetrics && !hasError){
        // success only: show metrics pair + improvement
        pair.style.display = '';
        impBox.style.display = '';
      } else if (!hasMetrics && hasError){
        // error only: show errors only
        if (beforeErr){ beBox.style.display = ''; log($('before-log'), beforeErr); }
        if (afterErr){ afBox.style.display = ''; log($('after-log'), afterErr); }
      } else if (hasMetrics && hasError){
        // success + error: show metrics pair, then both error boxes, then improvement
        pair.style.display = '';
        if (beforeErr){ beBox.style.display = ''; log($('before-log'), beforeErr); }
        if (afterErr){ afBox.style.display = ''; log($('after-log'), afterErr); }
        impBox.style.display = '';
      }

      const bm=parseFloat(data.before?.mean), am=parseFloat(data.after?.mean);
      if(isFinite(bm)&&isFinite(am)){ const diff=((bm-am)/bm)*100; const tag=diff>=0?'faster':'slower'; $('bench-diff').textContent=`Improvement: ${tag} ${Math.abs(diff).toFixed(2)}%`; } else { $('bench-diff').textContent='Improvement: —'; }
    }catch(e){ log($('before-log'), String(e)); }
  }

  function cancelRun(){ if(runAbort){ runAbort.abort(); runAbort=null; } }

  document.addEventListener('DOMContentLoaded', () => {
    $('helper-endpoint') && ($('helper-endpoint').textContent = ENDPOINT);
    $('btn-retry')?.addEventListener('click', health);
    $('btn-docker')?.addEventListener('click', dockerCheck);
    $('btn-lint')?.addEventListener('click', () => {
      const hints = lintCode(($('bench-code')?.value)||'');
      const box = $('bench-hints');
      box.style.display = 'block';
      if (hints.length){
        box.textContent = 'Hints: ' + hints.join(' · ');
        box.style.color = 'var(--crimson)';
        box.style.fontWeight = '700';
      } else {
        box.textContent = 'No issues found';
        box.style.color = '#2da44e';
        box.style.fontWeight = '700';
      }
    });
    $('btn-bench-run')?.addEventListener('click', runBenchmark);
    $('btn-bench-cancel')?.addEventListener('click', cancelRun);
    $('copy-before')?.addEventListener('click', () => copyText(`Mean: ${$('before-mean').textContent} | Std: ${$('before-std').textContent}`));
    $('copy-after')?.addEventListener('click', () => copyText(`Mean: ${$('after-mean').textContent} | Std: ${$('after-std').textContent}`));
    $('btn-one-submit')?.addEventListener('click', oneClickSubmit);
    // Add an Authenticate button dynamically next to upload (to avoid HTML edits if not present)
    const uploadBtn = $('btn-one-submit');
    if (uploadBtn){
      const authBtn = document.createElement('button');
      authBtn.className = 'btn'; authBtn.id = 'btn-auth'; authBtn.textContent = 'Authenticate';
      uploadBtn.parentElement.insertBefore(authBtn, uploadBtn);
      authBtn.addEventListener('click', ()=>{ autoUploadAttempts = 0; clearAutoUpload(); startAuth(); });
    }
    health();
  });
})(); 