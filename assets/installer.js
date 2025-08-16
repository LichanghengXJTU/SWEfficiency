/* assets/installer.js */
// This is the installer page, which is used to install the helper of the SWEfficiency.
(() => {
  "use strict";
  const ENDPOINT = 'https://127.0.0.1:5050';
  const $ = (sel) => document.querySelector(sel);

  function bindCopyButtons(){
    document.querySelectorAll('button[data-copy-target]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-copy-target');
        const code = document.getElementById(id);
        if (!code) return;
        const txt = code.textContent;
        try { navigator.clipboard.writeText(txt); btn.textContent = 'Copied'; setTimeout(()=>btn.textContent='Copy', 1200); } catch {}
      });
    });
  }

  async function ping(){
    try{
      const res = await fetch(`${ENDPOINT}/api/health`, { method:'GET' });
      if (!res.ok) return null;
      return await res.json();
    }catch{ return null; }
  }

  function renderInstalled(msg){
    const el = $('#helper-install-status'); if (!el) return;
    el.innerHTML = `<div class="status ok">${msg||'Helper detected. You can proceed to Non‑LLM Bench.'}</div>`;
  }
  function renderNotInstalled(){
    const el = $('#helper-install-status'); if (!el) return;
    el.innerHTML = `<div class="status warn">Helper not detected. Please install, then click “Recheck”.</div>
      <div style="margin-top:8px;"><button class="btn btn-tertiary" id="btn-recheck" type="button">Recheck</button></div>`;
    $('#btn-recheck')?.addEventListener('click', init);
  }

  async function init(){
    const info = await ping();
    if (info && info.ok){
      renderInstalled('Helper detected and online. Go to Non‑LLM Bench to run Docker checks.');
    }else{
      renderNotInstalled();
    }
    bindCopyButtons();
  }

  document.addEventListener('DOMContentLoaded', init);
})(); 