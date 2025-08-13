/* assets/analysis.js */
(() => {
  "use strict";

  const loadAnalysis = async () => {
    const res = await fetch('assets/data/analysis.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`analysis.json HTTP ${res.status}`);
    return res.json();
  };

  const buildList = (host, items) => {
    host.innerHTML = '';
    items.forEach(it => {
      const card = document.createElement('div'); card.className = 'analysis-card';
      const header = document.createElement('div'); header.className = 'analysis-header';
      const title = document.createElement('div'); title.className = 'analysis-title'; title.textContent = it.title || '';
      const toggle = document.createElement('div'); toggle.className = 'analysis-toggle'; toggle.setAttribute('aria-hidden','true');
      header.appendChild(title); header.appendChild(toggle);
      const body = document.createElement('div'); body.className = 'analysis-body';
      const inner = document.createElement('div'); inner.className = 'analysis-body-inner'; inner.textContent = it.body || '';
      body.appendChild(inner);
      card.appendChild(header); card.appendChild(body);
      host.appendChild(card);

      header.addEventListener('click', () => {
        const isOpen = card.classList.toggle('open');
        body.style.maxHeight = isOpen ? (body.scrollHeight + 'px') : '0px';
      });
    });
  };

  const render = async () => {
    const data = await loadAnalysis();
    const host = document.getElementById('analysis-list');
    if (!host) return;
    buildList(host, data.items || []);
  };

  document.addEventListener('DOMContentLoaded', render);
})(); 