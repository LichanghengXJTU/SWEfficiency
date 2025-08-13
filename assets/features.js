/* assets/features.js */
(() => {
  "use strict";

  const loadFeatures = async () => {
    const res = await fetch('assets/data/features.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`features.json HTTP ${res.status}`);
    return res.json();
  };

  const buildFeature = (host, item, media) => {
    // host 为 .flat-card 容器
    host.innerHTML = '';
    const wrap = document.createElement('div'); wrap.className = 'feat-inner';
    const mediaBox = document.createElement('div'); mediaBox.className = 'feat-media';
    const img = document.createElement('img'); img.alt = item.title || item.id || 'feature';
    img.style.maxWidth = '100%'; img.style.maxHeight = '100%'; img.style.objectFit = 'contain';
    if (item.image) img.src = (media?.basePath || '') + item.image;
    mediaBox.appendChild(img);

    const title = document.createElement('div'); title.className = 'feat-title'; title.textContent = item.title || '';
    const body = document.createElement('div'); body.className = 'feat-body'; body.textContent = item.body || '';

    // 右上浮动媒体 + 文本绕排
    wrap.appendChild(mediaBox); wrap.appendChild(title); wrap.appendChild(body);
    host.appendChild(wrap);

    const applyMediaSize = () => {
      const rect = host.getBoundingClientRect();
      let sideFromRatio = null;
      if (rect.width > 0 && rect.height > 0) {
        const ratio = (typeof item.ratio === 'number' && item.ratio > 0 && item.ratio < 1) ? item.ratio : (media?.defaultRatio || 0.25);
        const area = rect.width * rect.height;
        const targetArea = area * ratio;
        sideFromRatio = Math.sqrt(targetArea);
      }
      let side = sideFromRatio != null ? sideFromRatio : (media?.minSide || 120);
      if (typeof media?.minSide === 'number') side = Math.max(side, media.minSide);
      if (typeof media?.maxSide === 'number') side = Math.min(side, media.maxSide);
      mediaBox.style.width = Math.round(side) + 'px';
      mediaBox.style.height = Math.round(side) + 'px';
    };
    requestAnimationFrame(applyMediaSize);
    window.addEventListener('resize', applyMediaSize);
  };

  const render = async () => {
    const data = await loadFeatures();
    const cards = document.querySelectorAll('.features-grid .flat-card');
    const items = data.items || [];
    cards.forEach((card, idx) => {
      const item = items[idx] || { title: 'Feature', body: 'tbu', image: '' };
      buildFeature(card, item, data.media || {});
    });
  };

  document.addEventListener('DOMContentLoaded', render);
})(); 