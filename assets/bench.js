/* assets/bench.js */
(() => {
  "use strict";

  const ENDPOINT = 'https://127.0.0.1:5050';
  const $ = (id) => document.getElementById(id);
  const log = (el, msg) => { if (!el) return; el.textContent = String(msg ?? ''); };
  const setStatus = (el, text, cls=[]) => { if (!el) return; el.textContent = text; el.classList.remove('ok','fail'); cls.forEach(c => el.classList.add(c)); };
  const copyText = (txt) => { try { navigator.clipboard.writeText(txt); } catch(e){} };

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
  function genDockerCmd(hostPath, image){ const src=hostPath?JSON.stringify(hostPath):'<REPLACE_ME>'; return `docker run -it --rm --cpus=1 --memory=1g --pids-limit=256 --network=none --cap-drop=ALL --security-opt no-new-privileges --mount type=bind,src=${src},dst=/tmp/workload.py ${image} /bin/bash`; }

  function lintCode(code){ const hints=[]; [/\bimport\s+timeit\b/,/\bimport\s+statistics\b/].forEach(r=>{ if(!r.test(code)) hints.push('Missing required import: '+r.source.replace(/\\b/g,''));}); if(!/Mean\s*:/.test(code)) hints.push('Expected print("Mean:", value)'); if(!/(Std\s*Dev|Std)\s*:/.test(code)) hints.push('Expected print("Std Dev:", value)'); if(code.trim().length<20) hints.push('Code seems too short'); return hints; }

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
      // pull message (if backend returns raw logs inside before/after.raw, show any pull-related lines heuristically)
      const pullLines=[];
      const rawBefore = (data.before&&data.before.raw)||'';
      const rawAfter = (data.after&&data.after.raw)||'';
      const collectPull=(txt)=>{
        txt.split(/\n/).forEach(line=>{ if(/pull|download|extract/i.test(line)) pullLines.push(line); });
      };
      collectPull(rawBefore); collectPull(rawAfter);
      if(pullLines.length) log($('pull-log'), pullLines.join('\n'));

      // before
      $('before-mean').textContent = (data.before&&data.before.mean!=null)? String(data.before.mean): '—';
      $('before-std').textContent = (data.before&&data.before.std!=null)? String(data.before.std): '—';
      log($('before-log'), data.before?.error || data.before?.core || '');

      // after
      $('after-mean').textContent = (data.after&&data.after.mean!=null)? String(data.after.mean): '—';
      $('after-std').textContent = (data.after&&data.after.std!=null)? String(data.after.std): '—';
      log($('after-log'), data.after?.error || data.after?.core || '');

      const bm=parseFloat(data.before?.mean), am=parseFloat(data.after?.mean);
      if(isFinite(bm)&&isFinite(am)){ const diff=((bm-am)/bm)*100; const tag=diff>=0?'faster':'slower'; $('bench-diff').textContent=`Improvement: ${tag} ${Math.abs(diff).toFixed(2)}%`; } else { $('bench-diff').textContent='Improvement: —'; }
    }catch(e){ log($('before-log'), String(e)); }
  }

  function cancelRun(){ if(runAbort){ runAbort.abort(); runAbort=null; } }

  document.addEventListener('DOMContentLoaded', () => {
    $('helper-endpoint') && ($('helper-endpoint').textContent = ENDPOINT);
    $('btn-retry')?.addEventListener('click', health);
    $('btn-docker')?.addEventListener('click', dockerCheck);
    $('btn-lint')?.addEventListener('click', () => { const hints=lintCode(($('bench-code')?.value)||''); const box=$('bench-hints'); if(hints.length){ box.style.display='block'; box.textContent='Hints: '+hints.join(' · ');} else { box.style.display='none'; } });
    $('btn-bench-run')?.addEventListener('click', runBenchmark);
    $('btn-bench-cancel')?.addEventListener('click', cancelRun);
    $('copy-before')?.addEventListener('click', () => copyText(`Mean: ${$('before-mean').textContent} | Std: ${$('before-std').textContent}`));
    $('copy-after')?.addEventListener('click', () => copyText(`Mean: ${$('after-mean').textContent} | Std: ${$('after-std').textContent}`));
    health();
  });
})(); 