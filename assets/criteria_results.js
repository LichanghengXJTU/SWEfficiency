/* assets/criteria_results.js */
(() => {
  "use strict";

  const loadCR = async () => {
    const res = await fetch('assets/data/criteria_results.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`criteria_results.json HTTP ${res.status}`);
    return res.json();
  };

  const buildTabs = (container, items, prefix) => {
    container.innerHTML = '';
    items.forEach((it, idx) => {
      const btn = document.createElement('button');
      btn.className = 'tab-btn' + (idx === 0 ? ' active' : '');
      btn.setAttribute('data-panel', `${prefix}-${it.id}`);
      btn.textContent = it.label || it.id;
      container.appendChild(btn);
    });
  };

  const buildDeck = (deck, items, mediaBasePath, defaultRatio=0.25, minSide, maxSide) => {
    deck.innerHTML = '';
    items.forEach((it, idx) => {
      const card = document.createElement('div');
      card.className = 'card3d' + (idx === 0 ? ' state-active' : ' state-next inactive');
      card.setAttribute('data-key', it.id);
      const inner = document.createElement('div'); inner.className = 'card-inner';
      const content = document.createElement('div'); content.className = 'card-content';
      const title = document.createElement('div'); title.className = 'card-title'; title.textContent = it.title || it.id;
      const body = document.createElement('div'); body.className = 'card-body'; body.textContent = it.body || '';
      content.appendChild(title); content.appendChild(body);
      const media = document.createElement('div'); media.className = 'card-media';
      const img = document.createElement('img');
      img.alt = it.title || it.id;
      img.style.maxWidth = '100%'; img.style.maxHeight = '100%'; img.style.objectFit = 'contain';
      if (it.image) img.src = (mediaBasePath || '') + it.image;
      media.appendChild(img);
      inner.appendChild(media); inner.appendChild(content);
      card.appendChild(inner);
      deck.appendChild(card);

      // 稳定初始尺寸，减少抖动
      media.style.width = '240px'; media.style.height = '240px';

      const applyMediaRatio = () => {
        const rect = inner.getBoundingClientRect();
        let sideFromRatio = null;
        if (rect.width > 0 && rect.height > 0) {
          const ratio = (typeof it.ratio === 'number' && it.ratio > 0 && it.ratio < 1) ? it.ratio : defaultRatio;
          const area = rect.width * rect.height;
          const targetArea = area * ratio;
          sideFromRatio = Math.sqrt(targetArea);
        }
        let side = sideFromRatio != null ? sideFromRatio : (minSide || 180);
        if (typeof minSide === 'number') side = Math.max(side, minSide);
        if (typeof maxSide === 'number') side = Math.min(side, maxSide);
        media.style.width = Math.round(side) + 'px';
        media.style.height = Math.round(side) + 'px';
      };
      // 首屏两次 raf 后再应用，避免初次布局未稳定
      requestAnimationFrame(() => requestAnimationFrame(applyMediaRatio));
      window.addEventListener('resize', applyMediaRatio);
    });
  };

  const applyDeckMaxHeight = (deck) => {
    const cards = [...deck.querySelectorAll('.card3d')];
    if (cards.length === 0) return;
    const inners = cards.map(c => c.querySelector('.card-inner'));
    // 清理 minHeight
    inners.forEach(n => { if (n) n.style.minHeight = ''; });
    // 测量每张卡内容高度（不受 3D 变换影响）
    const contentHeights = inners.map(inner => inner ? inner.scrollHeight : 0);
    const targetInner = Math.max(200, ...contentHeights); // 至少 200 的内容高度
    const targetDeck = targetInner + 40; // 加留白
    // 统一设置每张卡的内容最小高度与 deck 高度
    inners.forEach(inner => { if (inner) inner.style.minHeight = targetInner + 'px'; });
    deck.style.height = targetDeck + 'px';
  };

  const attachDeckInteractions = (tabs, deck, prefix) => {
    const cards = [...deck.querySelectorAll('.card3d')];
    const keys = cards.map(c => c.getAttribute('data-key'));
    let activeIdx = 0;
    const resetTf = () => cards.forEach(c => (c.style.transform = ''));
    const applyStates = () => {
      resetTf();
      cards.forEach((card) => {
        card.className = card.className.replace(/\bstate-active\b|\bstate-prev\b|\bstate-next\b|\bstate-prev-2\b|\bstate-next-2\b|\bstate-prev-3\b|\bstate-next-3\b|\binactive\b|\binactive-far\b/g, '').trim();
      });
      cards.forEach((card, idx) => {
        const order = (idx - activeIdx + cards.length) % cards.length;
        if (order === 0) card.classList.add('state-active');
        else if (order === 1) card.classList.add('state-next','inactive');
        else if (order === cards.length - 1) card.classList.add('state-prev','inactive');
        else if (order === 2) card.classList.add('state-next-2','inactive');
        else if (order === cards.length - 2) card.classList.add('state-prev-2','inactive');
        else if (order === 3) card.classList.add('state-next-3','inactive');
        else if (order === cards.length - 3) card.classList.add('state-prev-3','inactive');
        else card.classList.add('inactive-far','inactive');
      });
      applyDeckMaxHeight(deck);
    };
    applyStates();

    tabs.addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn'); if (!btn) return;
      const id = btn.getAttribute('data-panel');
      tabs.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
      const i = keys.indexOf(id.slice(prefix.length + 1));
      if (i >= 0) { activeIdx = i; applyStates(); }
    });

    let sX=null, dragging=false, sT=0, lX=0, lT=0, sTf=null;
    const getTf = () => cards.map(c=>c.style.transform);
    const restoreTf = (vals)=> vals.forEach((t,i)=> (cards[i].style.transform = t||''));
    const startDrag = (x)=>{ sX=x; dragging=true; deck.classList.add('dragging'); sTf=getTf(); sT=performance.now(); lX=x; lT=sT; };
    const moveDrag = (x)=>{
      if(!dragging) return; const dx=x-sX; const ratio=Math.max(-1,Math.min(1,dx/120));
      const prev=(activeIdx-1+cards.length)%cards.length, next=(activeIdx+1)%cards.length;
      const ry=ratio*16, rz=ratio*-120, rx=Math.abs(ratio)*4, rz2=ratio*3.5;
      cards[activeIdx].style.transform = `translateX(${ratio*42}px) rotateY(${ry}deg) rotateX(${rx}deg) rotateZ(${rz2}deg) translateZ(${rz}px)`;
      cards[prev].style.transform = `translateX(${-42+ratio*42}px) translateY(3px) rotateY(${-16+ry}deg) rotateX(${4-rx}deg) rotateZ(${-3.5+rz2}deg) translateZ(${-120+-rz}px)`;
      cards[next].style.transform = `translateX(${42+ratio*-42}px) translateY(3px) rotateY(${16-ry}deg) rotateX(${4-rx}deg) rotateZ(${3.5-rz2}deg) translateZ(${-120+-rz}px)`;
      lX=x; lT=performance.now();
    };
    const endDrag = (x)=>{
      if(!dragging) return; dragging=false; deck.classList.remove('dragging');
      const now=performance.now(); const dx=x-sX; const dt=now-sT; const vx=(x-lX)/Math.max(1, now-lT);
      if (Math.abs(vx)>0.6 || (dt<260 && Math.abs(dx)>16)) { activeIdx = (vx<0||dx<0) ? (activeIdx+1)%cards.length : (activeIdx-1+cards.length)%cards.length; }
      else if (dx>48) { activeIdx = (activeIdx-1+cards.length)%cards.length; }
      else if (dx<-48) { activeIdx = (activeIdx+1)%cards.length; }
      applyStates();
      const key=keys[activeIdx];
      tabs.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-panel')===`${prefix}-${key}`));
      restoreTf(sTf||[]); sTf=null; sT=0; lX=0; lT=0;
    };
    deck.addEventListener('pointerdown', (e)=> startDrag(e.clientX));
    deck.addEventListener('pointermove', (e)=> moveDrag(e.clientX));
    deck.addEventListener('pointerup',   (e)=> endDrag(e.clientX));
    deck.addEventListener('pointerleave',(e)=> endDrag(e.clientX||0));
    deck.addEventListener('touchstart',  (e)=> startDrag(e.touches[0].clientX), {passive:true});
    deck.addEventListener('touchmove',   (e)=> moveDrag(e.touches[0].clientX),  {passive:true});
    deck.addEventListener('touchend',    (e)=> endDrag((e.changedTouches[0]||e.touches[0]||{clientX:0}).clientX));

    window.addEventListener('resize', () => applyDeckMaxHeight(deck));
  };

  document.addEventListener('DOMContentLoaded', async () => {
    const cTabs = document.getElementById('criteria-tabs');
    const cDeck = document.getElementById('criteria-deck');
    const rTabs = document.getElementById('results-tabs');
    const rDeck = document.getElementById('results-deck');
    if (!(cTabs && cDeck && rTabs && rDeck)) return;
    const data = await loadCR();

    buildTabs(cTabs, data.criteria, 'res');
    buildDeck(
      cDeck,
      data.criteria.map(c => ({ id: c.id, body: c.body, title: c.title, image: c.image, ratio: c.ratio })),
      data.media?.criteriaBasePath,
      data.media?.defaultRatio,
      data.media?.minSide,
      data.media?.maxSide
    );
    attachDeckInteractions(cTabs, cDeck, 'res');

    buildTabs(rTabs, data.results, 'res');
    buildDeck(
      rDeck,
      data.results.map(c => ({ id: c.id, body: c.body, title: c.title, image: c.image, ratio: c.ratio })),
      data.media?.resultsBasePath,
      data.media?.defaultRatio,
      data.media?.minSide,
      data.media?.maxSide
    );
    attachDeckInteractions(rTabs, rDeck, 'res');
  });
})(); 