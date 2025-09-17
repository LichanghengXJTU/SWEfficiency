/* assets/criteria_results.js */
// 静态渲染 Criteria（SR, Difficulty）与 Results（4 卡片）。
(() => {
  "use strict";

  const CRITERIA = [
    {
      id: 'sr', label: 'SR', title: 'Speedup Ratio (SR)',
      body: `If the patch applies successfully and all tests pass, we measure the speedup on the performance workload relative to the instance’s ground truth patch. The performance metric for our benchmark is the <b>speedup ratio</b> (SR), which measures how much faster the LM improvement is over the task instance’s original gold (expert) patch.<br/><br/>
      We define the instance speedup ratio as \( SR = \frac{Speedup_{\\text{LM}}}{Speedup_{\\text{gold}}} \), where \( Speedup_{\\text{gold}} = \frac{T_{\\text{pre}}}{T_{\\text{post-gold-patch}}} \) and \( Speedup_{\\text{LM}} = \frac{T_{\\text{pre}}}{T_{\\text{post-LM-patch}}} \). To score a system across the entire dataset, we report the <b>harmonic mean</b> of SR across all instances. If a system does not submit a patch or submits a patch that fails correctness tests, that instance's SR is \( SR = 1/Speedup_{\\text{gold}} \) (as if no LM edit was attempted).`
    },
    {
      id: 'difficulty', label: 'Difficulty', title: 'Difficulty',
      body: `We identify three task difficulty measures that describe intuition behind how “difficult” a task is: (1) pre-edit workload runtime, or the duration of the workload to be optimized (longer workloads likely require more algorithmic insight); (2) gold patch length, or the number of lines in the expert (gold) edit associated with each task instance (harder instances require larger line-wise expert edits); and (3) the speedup factor that the expert edit achieved (instance is harder if expert speedup is larger).`
    }
  ];

  const RESULTS = [
    {
      id: 'overall', label: 'Overall', title: 'Overall Speedup',
      body: `
      <div class="leaderboard-table" style="margin-bottom:8px;">
        <table class="table clean-table striped" style="width:100%">
          <thead><tr><th>System</th><th>Speedup Ratio</th></tr></thead>
          <tbody>
            <tr><td><span class="sc">Claude 3.7 Sonnet (OpenHands)</span></td><td class="num">0.010×</td></tr>
            <tr><td><span class="sc">GPT-5 Mini (OpenHands)</span></td><td class="num">0.005×</td></tr>
            <tr><td><span class="sc">Gemini 2.5 Flash (OpenHands)</span></td><td class="num">0.002×</td></tr>
          </tbody>
        </table>
      </div>
      <div class="preline">We observe that LM agents fail to consistently match 0.01 times of expert level performance. We observe a substantial capability transfer gap: GPT-5 Mini (OpenHands) achieved 0.005 times of expert performance..

Our results indicate that current agents, while successful on SWE-style issue resolution and bug-fix tasks, currently do not transfer to efficiency-oriented, measurement-grounded program changes, underscoring substantial headroom and the need for new approaches towards more autonomous performance engineering.</div>`
    },
    {
      id: 'bugs', label: 'Bugs', title: 'Bugs introduced when optimizing',
      body: `
      <div class="leaderboard-table" style="margin-bottom:8px;">
        <table class="table clean-table striped" style="width:100%">
          <thead>
            <tr>
              <th>System</th>
              <th>Fails Tests</th>
              <th>Slower than Pre-edit</th>
              <th>Faster than Pre-edit</th>
              <th>Faster than Expert</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Claude 3.7 Sonnet (OpenHands)</td><td class="num">36%</td><td class="num">13%</td><td class="num">29%</td><td class="num">22%</td></tr>
            <tr><td>GPT 5 Mini (OpenHands)</td><td class="num">51%</td><td class="num">10%</td><td class="num">24%</td><td class="num">15%</td></tr>
            <tr><td>Gemini 2.5 Flash (OpenHands)</td><td class="num">44%</td><td class="num">14%</td><td class="num">32%</td><td class="num">10%</td></tr>
          </tbody>
        </table>
      </div>
      <div class="preline">We find that leading systems most often produce patches that break functional correctness and cause tests to fail, invalidating any optimizations made. Even when producing correct patches, the majority of edits are either slower than the original, pre-edit repository state or faster but still slower than the expert edit. Strikingly, fewer than a quarter of correct solutions outperform expert-level baselines, and in some cases agents make changes that degrade performance.

This suggests that current LM agents still lack the nuanced reasoning and repository understanding skill required for bug-free performance optimizations, highlighting the opportunity for future work in developing agents that can jointly reason about correctness and computational efficiency.</div>`
    },
    {
      id: 'easywins', label: 'EasyWins', title: 'Stronger on easy wins but weak on harder speedups',
      body: `
      <figure class="img-block" style="margin:0 0 8px 0;">
        <img src="assets/images/hsr_thresholds_bins_markers_centered.png" alt="HSR thresholds by bins" style="width:100%; height:auto;"/>
        <figcaption class="img-caption">This figure shows a breakdown of LM benchmark performance and correlation with multiple task difficulty measures. Across all three measures of task complexity, we observe that LMs are able to match or come close to matching expert performance on lower-complexity tasks. However, LMs struggle to solve optimization tasks as they become longer in duration and have more substantial feasible speedup opportunities.</figcaption>
      </figure>`
    },
    {
      id: 'misloc', label: 'Misloc', title: 'Function-level mislocalization severely limits LM performance',
      body: `We identify that a significant part of under-performance of LM agents can be attributed to rarely editing functions that contribute most to the expert's speedup. When imagining the expert (gold) patch speedup gains as units of “speedup mass” distributed across files (and, within them, regions/functions), we find that 70.4% of the expert’s speedup gain occurred in functions the LM never touched: 40% of the missed speedup is attributed to not choosing the right file, while 30.4% is due to choosing the wrong function in the right file. Although the LM and expert commonly edit the same files overall (on average, their edited-file sets overlap by 61%), the function level overlap is not concentrated on the files that actually carry most of the expert’s speedup.`
    }
  ];

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

  const buildDeck = (deck, items) => {
    deck.innerHTML = '';
    items.forEach((it, idx) => {
      const card = document.createElement('div');
      card.className = 'card3d' + (idx === 0 ? ' state-active' : ' state-next inactive');
      card.setAttribute('data-key', it.id);
      const inner = document.createElement('div'); inner.className = 'card-inner';
      const content = document.createElement('div'); content.className = 'card-content';
      const title = document.createElement('div'); title.className = 'card-title'; title.textContent = it.title || it.id;
      const body = document.createElement('div'); body.className = 'card-body'; body.innerHTML = it.body || '';
      content.appendChild(title); content.appendChild(body);
      inner.appendChild(content);
      card.appendChild(inner);
      deck.appendChild(card);
    });
  };

  const applyDeckMaxHeight = (deck) => {
    const cards = [...deck.querySelectorAll('.card3d')];
    if (cards.length === 0) return;
    const inners = cards.map(c => c.querySelector('.card-inner'));
    inners.forEach(n => { if (n) n.style.minHeight = ''; });
    const contentHeights = inners.map(inner => inner ? inner.scrollHeight : 0);
    const targetInner = Math.max(240, ...contentHeights);
    const targetDeck = targetInner + 40;
    inners.forEach(inner => { if (inner) inner.style.minHeight = targetInner + 'px'; });
    deck.style.height = targetDeck + 'px';
  };

  // 触发 MathJax 渲染（更稳健，多次尝试）
  function typesetDeck(deck){
    try{
      if (window.MathJax){
        if (MathJax.typesetPromise) { MathJax.typesetPromise(deck ? [deck] : undefined); }
        else if (MathJax.typeset)   { MathJax.typeset(deck ? [deck] : undefined); }
      }
    }catch(e){}
  }

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
        else card.classList.add('inactive-far','inactive');
      });
      applyDeckMaxHeight(deck);
      typesetDeck(deck);
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

  document.addEventListener('DOMContentLoaded', () => {
    const cTabs = document.getElementById('criteria-tabs');
    const cDeck = document.getElementById('criteria-deck');
    const rTabs = document.getElementById('results-tabs');
    const rDeck = document.getElementById('results-deck');
    if (!(cTabs && cDeck && rTabs && rDeck)) return;

    buildTabs(cTabs, CRITERIA, 'res');
    buildDeck(cDeck, CRITERIA);
    attachDeckInteractions(cTabs, cDeck, 'res');

    buildTabs(rTabs, RESULTS, 'res');
    buildDeck(rDeck, RESULTS);
    attachDeckInteractions(rTabs, rDeck, 'res');

    // 触发 MathJax 渲染（初始化后多次尝试，提升稳定性）
    typesetDeck(cDeck); typesetDeck(rDeck);
    setTimeout(() => typesetDeck(cDeck), 50);
    setTimeout(() => typesetDeck(cDeck), 250);
    setTimeout(() => typesetDeck(rDeck), 50);
    setTimeout(() => typesetDeck(rDeck), 250);
  });
})(); 