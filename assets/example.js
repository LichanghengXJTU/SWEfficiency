/* assets/example.js */
(() => {
  "use strict";

  const genLines = (n) => Array.from({length:n}, (_,i)=> `placeholder analysis line ${i+1}`).join('\n');

  const measureCardContent = (card) => {
    const inner = card.querySelector('div[style*="width:"]') || card.firstElementChild || card;
    return inner ? inner.scrollHeight : card.scrollHeight;
  };

  const applyDeckMaxHeight = (eDeck) => {
    const cards = [...eDeck.querySelectorAll('.card3d')];
    const workloads = cards.map(c => c.querySelector('.codebox.auto'));
    workloads.forEach(w => { if (w) w.style.minHeight = ''; });
    const originalTexts = [];
    cards.forEach((card) => {
      const analysisEl = card.querySelector('[id$="-analysis"]');
      const sel = card.querySelector('select');
      if (analysisEl && sel) {
        originalTexts.push([analysisEl, analysisEl.textContent]);
        const maxLines = Math.max(1, sel.options.length);
        analysisEl.textContent = genLines(maxLines);
      }
    });
    const heights = cards.map(measureCardContent);
    const maxH = Math.max(240, ...heights) + 40;
    eDeck.style.height = maxH + 'px';
    originalTexts.forEach(([el, txt]) => { el.textContent = txt; });
    cards.forEach((card, idx) => {
      const w = workloads[idx]; if (!w) return;
      const inner = card.querySelector('div[style*="width:"]') || card.firstElementChild || card;
      const naturalH = (inner ? inner.scrollHeight : card.scrollHeight) + 40;
      const extra = Math.max(0, maxH - naturalH);
      if (extra > 0) {
        const base = w.offsetHeight;
        w.style.minHeight = (base + extra) + 'px';
      }
    });
  };

  const renderExamples = async () => {
    const eTabs = document.getElementById('examples-tabs');
    const eDeck = document.getElementById('examples-deck');
    if (!eTabs || !eDeck) return;

    // 加载 examples 配置
    const res = await fetch('assets/data/examples.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`examples.json HTTP ${res.status}`);
    const data = await res.json();
    const examples = Array.isArray(data.examples) ? data.examples : [];
    if (examples.length === 0) return;

    // 渲染 tabs
    eTabs.innerHTML = '';
    examples.forEach((eg, idx) => {
      const btn = document.createElement('button');
      btn.className = 'tab-btn' + (idx === 0 ? ' active' : '');
      btn.setAttribute('data-panel', `eg-${eg.id}`);
      btn.textContent = eg.id;
      eTabs.appendChild(btn);
    });

    // 渲染 cards
    eDeck.innerHTML = '';
    examples.forEach((eg, idx) => {
      const card = document.createElement('div');
      card.className = 'card3d' + (idx === 0 ? ' state-active' : ' state-next inactive');
      card.setAttribute('data-key', eg.id);

      // build inner
      const wrap = document.createElement('div');
      wrap.setAttribute('style','width:92%;');

      // header row: title + chips
      const headRow = document.createElement('div');
      headRow.setAttribute('style','display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px;');
      const title = document.createElement('div');
      title.className = 'section-title';
      title.setAttribute('style','font-size:18px; margin:0;');
      title.textContent = eg.title || eg.id;
      const chips = document.createElement('div');
      chips.className = 'chips';

      const modelSelectChip = document.createElement('div');
      modelSelectChip.className = 'chip select';
      const modelSelect = document.createElement('select');
      modelSelect.id = `${eg.id}-model-select`;
      (eg.models||[]).forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.name; opt.textContent = m.name; modelSelect.appendChild(opt);
      });
      modelSelectChip.appendChild(modelSelect);
      chips.appendChild(modelSelectChip);

      const status = document.createElement('div');
      status.className = 'status-pill';
      status.id = `${eg.id}-status`;
      chips.appendChild(status);

      const lang = document.createElement('div');
      lang.className = 'lang-pill';
      lang.id = `${eg.id}-lang`;
      chips.appendChild(lang);

      headRow.appendChild(title);
      headRow.appendChild(chips);

      // meta
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.setAttribute('style','margin-bottom:8px;');
      const repoLink = eg.meta && eg.meta.repo_url ? `<a href="${eg.meta.repo_url}" target="_blank" rel="noreferrer">link</a>` : '#';
      meta.innerHTML = `tasks：${eg.meta?.task||''}<br/>instance_id: ${eg.meta?.instance_id||''} . GitHub link: ${repoLink}<br/>commit: ${eg.meta?.commit||''}`;

      // grid
      const grid = document.createElement('div');
      grid.className = 'grid grid-12';
      grid.setAttribute('style','gap:10px;');

      // workload col
      const colL = document.createElement('div');
      colL.className = 'col-6 col-12-sm';
      const metaL = document.createElement('div'); metaL.className = 'meta'; metaL.setAttribute('style','margin-bottom:6px;'); metaL.textContent = 'workload';
      const preW = document.createElement('pre'); preW.className = 'codebox auto';
      const codeW = document.createElement('code'); codeW.textContent = eg.workload || 'placeholder workload';
      preW.appendChild(codeW);
      colL.appendChild(metaL); colL.appendChild(preW);

      // human patch col
      const colR = document.createElement('div');
      colR.className = 'col-6 col-12-sm';
      const topR = document.createElement('div'); topR.setAttribute('style','display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;');
      const metaR = document.createElement('div'); metaR.className = 'meta'; metaR.textContent = 'human patch';
      const chipsR = document.createElement('div'); chipsR.className = 'chips';
      const humanCritChip = document.createElement('div'); humanCritChip.className = 'chip select';
      const humanCrit = document.createElement('select'); humanCrit.id = `${eg.id}-human-crit`;
      (eg.criteriaList||[]).forEach(c => { const o=document.createElement('option'); o.value=c.id; o.textContent=c.name||c.id; humanCrit.appendChild(o); });
      humanCritChip.appendChild(humanCrit);
      const humanScore = document.createElement('div'); humanScore.className='status-pill'; humanScore.id=`${eg.id}-human-score`; humanScore.textContent='Untest';
      chipsR.appendChild(humanCritChip); chipsR.appendChild(humanScore);
      topR.appendChild(metaR); topR.appendChild(chipsR);
      const preH = document.createElement('pre'); preH.className='codebox sm';
      const codeH = document.createElement('code'); codeH.textContent = eg.humanPatch || 'placeholder human patch';
      preH.appendChild(codeH);
      colR.appendChild(topR); colR.appendChild(preH);

      // LLM patch full row
      const colLLM = document.createElement('div'); colLLM.className = 'col-12';
      const topLLM = document.createElement('div'); topLLM.setAttribute('style','display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;');
      const metaLLM = document.createElement('div'); metaLLM.className='meta'; metaLLM.textContent='LLM patch';
      const chipsLLM = document.createElement('div'); chipsLLM.className='chips';
      const llmCritChip = document.createElement('div'); llmCritChip.className = 'chip select';
      const llmCrit = document.createElement('select'); llmCrit.id = `${eg.id}-llm-crit`;
      (eg.criteriaList||[]).forEach(c => { const o=document.createElement('option'); o.value=c.id; o.textContent=c.name||c.id; llmCrit.appendChild(o); });
      llmCritChip.appendChild(llmCrit);
      const llmScore = document.createElement('div'); llmScore.className='status-pill'; llmScore.id=`${eg.id}-llm-score`; llmScore.textContent='Untest';
      chipsLLM.appendChild(llmCritChip); chipsLLM.appendChild(llmScore);
      topLLM.appendChild(metaLLM); topLLM.appendChild(chipsLLM);
      const preLLM = document.createElement('pre'); preLLM.className='codebox sm';
      const codeLLM = document.createElement('code'); codeLLM.id = `${eg.id}-llm`; codeLLM.textContent = 'placeholder for model-specific patch (select a model)';
      preLLM.appendChild(codeLLM);
      colLLM.appendChild(topLLM); colLLM.appendChild(preLLM);

      // analysis
      const colA = document.createElement('div'); colA.className = 'col-12';
      const metaA = document.createElement('div'); metaA.className='meta'; metaA.setAttribute('style','margin-bottom:6px;'); metaA.textContent='Analysis';
      const ana = document.createElement('div'); ana.className='flat-card placeholder sm preline'; ana.id = `${eg.id}-analysis`; ana.textContent = 'placeholder for analysis of selected model';
      colA.appendChild(metaA); colA.appendChild(ana);

      grid.appendChild(colL);
      grid.appendChild(colR);
      grid.appendChild(colLLM);
      grid.appendChild(colA);

      wrap.appendChild(headRow);
      wrap.appendChild(meta);
      wrap.appendChild(grid);
      card.appendChild(wrap);
      eDeck.appendChild(card);
    });

    // 3D Deck 行为
    const cards = [...eDeck.querySelectorAll('.card3d')];
    const keys = cards.map(c => c.getAttribute('data-key'));
    let activeIdx = 0;
    const resetTf = () => cards.forEach(c => (c.style.transform = ''));
    const applyStates = () => {
      resetTf();
      cards.forEach((card, idx) => {
        card.className = card.className.replace(/\bstate-active\b|\bstate-prev\b|\bstate-next\b|\bstate-prev-2\b|\bstate-next-2\b|\binactive\b|\binactive-far\b/g, '').trim();
      });
      cards.forEach((card, idx) => {
        const order = (idx - activeIdx + cards.length) % cards.length; // 0 active, 1 next, 2 next-2, 3 next-3, ...
        if (order === 0) {
          card.classList.add('state-active');
        } else if (order === 1) {
          card.classList.add('state-next','inactive');
        } else if (order === cards.length - 1) {
          card.classList.add('state-prev','inactive');
        } else if (order === 2) {
          card.classList.add('state-next-2','inactive');
        } else if (order === cards.length - 2) {
          card.classList.add('state-prev-2','inactive');
        } else if (order === 3) {
          card.classList.add('state-next-3','inactive');
        } else if (order === cards.length - 3) {
          card.classList.add('state-prev-3','inactive');
        } else {
          card.classList.add('inactive-far','inactive');
        }
      });
      applyDeckMaxHeight(eDeck);
    };
    applyStates();

    eTabs.addEventListener('click', (e)=>{
      const btn = e.target.closest('.tab-btn'); if(!btn) return;
      const id = btn.getAttribute('data-panel');
      eTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b===btn));
      const i = keys.indexOf(id.slice(3)); if (i>=0) { activeIdx = i; applyStates(); }
    });

    let sX=null, dragging=false, sT=0, lX=0, lT=0, sTf=null;
    const getTf = () => cards.map(c=>c.style.transform);
    const restoreTf = (vals)=> vals.forEach((t,i)=> (cards[i].style.transform = t||''));
    const isInteractive = (el) => !!el.closest('select, .chip.select, .chips, a, button, input, textarea');
    const startDrag = (e)=>{ if (isInteractive(e.target)) return; sX=e.clientX; dragging=true; eDeck.classList.add('dragging'); sTf=getTf(); sT=performance.now(); lX=e.clientX; lT=sT; };
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
      if(!dragging) return; dragging=false; eDeck.classList.remove('dragging');
      const now=performance.now(); const dx=x-sX; const dt=now-sT; const vx=(x-lX)/Math.max(1, now-lT);
      if (Math.abs(vx)>0.6 || (dt<260 && Math.abs(dx)>16)) { activeIdx = (vx<0||dx<0) ? (activeIdx+1)%cards.length : (activeIdx-1+cards.length)%cards.length; }
      else if (dx>48) { activeIdx = (activeIdx-1+cards.length)%cards.length; }
      else if (dx<-48) { activeIdx = (activeIdx+1)%cards.length; }
      applyStates();
      const key=keys[activeIdx];
      eTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-panel')===`eg-${key}`));
      restoreTf(sTf||[]); sTf=null; sT=0; lX=0; lT=0;
    };
    eDeck.addEventListener('pointerdown', startDrag);
    eDeck.addEventListener('pointermove', (e)=> moveDrag(e.clientX));
    eDeck.addEventListener('pointerup',   (e)=> endDrag(e.clientX));
    eDeck.addEventListener('pointerleave',(e)=> endDrag(e.clientX || 0));
    eDeck.addEventListener('touchstart',  (e)=> { if (isInteractive(e.target)) return; startDrag(e.touches[0]); }, {passive:true});
    eDeck.addEventListener('touchmove',   (e)=> moveDrag(e.touches[0].clientX),  {passive:true});
    eDeck.addEventListener('touchend',    (e)=> endDrag((e.changedTouches[0]||e.touches[0]||{clientX:0}).clientX));

    // 绑定模型、criteria 与 score、补齐 meta 状态
    const updateByModel = (eg) => {
      const modelSel = document.getElementById(`${eg.id}-model-select`);
      const statusEl = document.getElementById(`${eg.id}-status`);
      const langEl = document.getElementById(`${eg.id}-lang`);
      const llmCode = document.getElementById(`${eg.id}-llm`);
      const analysisEl = document.getElementById(`${eg.id}-analysis`);
      const humanCrit = document.getElementById(`${eg.id}-human-crit`);
      const humanScore = document.getElementById(`${eg.id}-human-score`);
      const llmCrit = document.getElementById(`${eg.id}-llm-crit`);
      const llmScore = document.getElementById(`${eg.id}-llm-score`);

      const findModel = (name) => (eg.models||[]).find(m => m.name === name);
      const applyModel = () => {
        const m = findModel(modelSel.value);
        if (!m) return;
        statusEl.textContent = m.status || 'Untest';
        statusEl.classList.remove('ok','fail');
        if ((m.status||'').toLowerCase() === 'success') statusEl.classList.add('ok');
        if ((m.status||'').toLowerCase() === 'failure') statusEl.classList.add('fail');
        langEl.textContent = eg.lang || '';
        llmCode.textContent = m.llmPatch || 'placeholder llm patch';
        analysisEl.textContent = m.analysis || 'placeholder analysis';

        const critIds = (eg.criteriaList||[]).map(c => c.id);
        const available = Object.keys(m.criteriaScores||{}).filter(id => critIds.includes(id));
        const html = available.length ? available.map(cid => `<option value="${cid}">${(eg.criteriaList.find(c=>c.id===cid)?.name)||cid}</option>`).join('') : '<option>(n/a)</option>';
        [humanCrit, llmCrit].forEach(sel => { if (!sel) return; sel.innerHTML = html; sel.disabled = available.length === 0; });

        const scoreOf = (cid) => (m.criteriaScores && m.criteriaScores[cid]) ? m.criteriaScores[cid] : 'Untest';
        if (humanCrit && humanScore) humanScore.textContent = scoreOf(humanCrit.value);
        if (llmCrit && llmScore) llmScore.textContent = scoreOf(llmCrit.value);

        applyDeckMaxHeight(eDeck);
      };

      if (modelSel) modelSel.addEventListener('change', applyModel);
      if (humanCrit) humanCrit.addEventListener('change', () => {
        const m = findModel(modelSel.value);
        if (!m) return; humanScore.textContent = (m.criteriaScores && m.criteriaScores[humanCrit.value]) ? m.criteriaScores[humanCrit.value] : 'Untest';
        applyDeckMaxHeight(eDeck);
      });
      if (llmCrit) llmCrit.addEventListener('change', () => {
        const m = findModel(modelSel.value);
        if (!m) return; llmScore.textContent = (m.criteriaScores && m.criteriaScores[llmCrit.value]) ? m.criteriaScores[llmCrit.value] : 'Untest';
        applyDeckMaxHeight(eDeck);
      });

      applyModel();
    };

    examples.forEach(eg => updateByModel(eg));

    window.addEventListener('resize', () => applyDeckMaxHeight(eDeck));
  };

  document.addEventListener('DOMContentLoaded', () => {
    // 仅首页 Examples 存在
    renderExamples().catch(err => console.error('Failed to render examples from JSON:', err));
  });
})(); 