/* assets/installer.js */
(() => {
  "use strict";
  const ENDPOINT = 'https://127.0.0.1:5050';
  const dlBase = new URL('nonllmplatform/downloadhelper/', window.location.href).toString();

  const $ = (sel) => document.querySelector(sel);

  async function ping(){
    try{
      const res = await fetch(`${ENDPOINT}/api/health`, { method:'GET' });
      if (!res.ok) return null;
      return await res.json();
    }catch{ return null; }
  }

  function renderInstalled(msg){
    const el = $('#helper-install-status'); if (!el) return;
    el.innerHTML = `<div class="status ok">${msg||'Helper 已安装并在本机运行。'}</div>`;
  }
  function renderNotInstalled(){
    const el = $('#helper-install-status'); if (!el) return;
    el.innerHTML = `
      <div class="status warn">未检测到本机 Helper。请先安装，然后返回本页点击“重新检测”。</div>
      <div class="cta-row" style="gap:8px; flex-wrap:wrap;">
        <a class="btn btn-dark" href="${dlBase}install.command" download>下载一键安装（.command）</a>
        <a class="btn" href="${dlBase}install_helper.sh" download>下载脚本（.sh）</a>
        <a class="btn btn-light" href="${dlBase}README.md" target="_blank" rel="noopener">查看安装说明</a>
        <button class="btn btn-crimson" id="btn-recheck" type="button">重新检测</button>
      </div>`;
    $('#btn-recheck')?.addEventListener('click', init);
  }

  async function init(){
    const info = await ping();
    if (info && info.ok){
      renderInstalled('检测到 Helper 在线。可前往 Non‑LLM Bench 执行 Docker 检查。');
    }else{
      renderNotInstalled();
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})(); 