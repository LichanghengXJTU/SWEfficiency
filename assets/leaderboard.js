/* assets/leaderboard.js */
(() => {
  "use strict";

  const DATA_URL = "assets/data/leaderboard.json";
//
//  const FALLBACK = {
//    criteria: [
//      {
//        id: "time_improvement",
//        name: "Time Improvement",
//        columns: ["Rank", "Agent / Model", "Language", "Tasks", "Mean Speedup", "Median Speedup"],
//        rows: [
//          [1, "Agent-X", "Python", 50, "1.42\u00D7", "1.30\u00D7"],
//          [2, "Agent-Y", "C++", 50, "1.15\u00D7", "1.10\u00D7"],
//          [3, "Agent-Z", "Mixed", 50, "1.08\u00D7", "1.05\u00D7"]
//        ]
//      },
//      {
//        id: "pass_rate",
//        name: "Pass Rate",
//        columns: ["Rank", "Agent / Model", "Tasks", "Pass Rate"],
//        rows: [
//          [1, "Agent-X", 50, "78%"],
//          [2, "Agent-Y", 50, "65%"],
//          [3, "Agent-Z", 50, "60%"]
//        ]
//      },
//      {
//        id: "opt_at_1",
//        name: "Opt@1",
//        columns: ["Rank", "Agent / Model", "Tasks", "Opt@1"],
//        rows: [
//          [1, "Agent-X", 50, "4.6%"],
//          [2, "Agent-Y", 50, "3.2%"],
//          [3, "Agent-Z", 50, "0.0%"]
//        ]
//      }
//    ]
//  };

  const $switcher = document.getElementById("criteria-switcher");
  const $loading  = document.getElementById("leaderboard-loading");
  const $card     = document.getElementById("leaderboard-card");
  const $table    = document.getElementById("leaderboard-table");
  const $modelFilter = document.getElementById("leaderboard-model-filter");
  const $criteriaSelect = document.getElementById("leaderboard-criteria-select");
  const $modelGhost = document.getElementById("leaderboard-model-ghost");
  const $modelClear = document.getElementById("leaderboard-model-clear");
  const $criteriaIndicator = document.getElementById("criteria-indicator");

  const state = { criteriaList: [], activeId: null };

  const el = (tag, opts = {}, children = []) => {
    const node = document.createElement(tag);
    if (opts.className) node.className = opts.className;
    if (opts.attrs) Object.entries(opts.attrs).forEach(([k, v]) => node.setAttribute(k, v));
    if (opts.dataset) Object.entries(opts.dataset).forEach(([k, v]) => (node.dataset[k] = v));
    if (opts.on) Object.entries(opts.on).forEach(([evt, fn]) => node.addEventListener(evt, fn));
    if (!Array.isArray(children)) children = [children];
    children.forEach(c => node.appendChild(typeof c === "string" ? document.createTextNode(c) : c));
    return node;
  };

  const setLoading = (isLoading, msg = "Loading leaderboard…") => {
    if (isLoading) {
      $loading.style.display = "flex";
      $loading.innerHTML = `<div class="spinner"></div><span>${msg}</span>`;
      $card.style.display = "none";
    } else {
      $loading.style.display = "none";
      $card.style.display = "block";
    }
  };

  const buildSwitcher = (criteria) => {
    $switcher.innerHTML = "";
    $switcher.setAttribute("role", "tablist");
    $switcher.setAttribute("aria-label", "Leaderboard criteria");
    // 在 segmented 内加入左侧标签
    const label = el('span', { className: 'criteria-label', attrs: { 'aria-hidden': 'true' } }, 'Criteria:');
    $switcher.appendChild(label);
    // 同步填充右侧原生下拉
    if ($criteriaSelect) {
      $criteriaSelect.innerHTML = criteria.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
      $criteriaSelect.addEventListener('change', (e) => setActive(e.target.value));
    }
    criteria.forEach((c, idx) => {
      const btn = el(
        "button",
        {
          className: "segmented-btn" + (idx === 0 ? " active" : ""),
          attrs: { role: "tab", "aria-selected": idx === 0 ? "true" : "false", tabindex: idx === 0 ? "0" : "-1" },
          dataset: { id: c.id },
          on: { click: () => setActive(c.id) }
        },
        c.name
      );
      $switcher.appendChild(btn);
    });

    // 键盘导航
    $switcher.addEventListener("keydown", (e) => {
      const buttons = [...$switcher.querySelectorAll(".segmented-btn")];
      const idx = buttons.findIndex(b => b.classList.contains("active"));
      if (idx < 0) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const next = buttons[(idx + 1) % buttons.length];
        next.click(); next.focus();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const prev = buttons[(idx - 1 + buttons.length) % buttons.length];
        prev.click(); prev.focus();
      }
    });
  };

  const setActive = (id) => {
    if (state.activeId === id) return;
    state.activeId = id;
    if ($criteriaSelect) {
      const opt = [...$criteriaSelect.options].find(o => o.value === id);
      if (opt) $criteriaSelect.value = id;
    }
    // 更新 criteria 指示器
    if ($criteriaIndicator) {
      const c = state.criteriaList.find(c => c.id === id);
      $criteriaIndicator.innerHTML = `<span class="dot"></span>${c ? c.name : id}`;
    }
    [...$switcher.children].forEach(btn => {
      const isActive = btn.dataset.id === id;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
      btn.setAttribute("tabindex", isActive ? "0" : "-1");
    });
    renderTable(id);
    history.replaceState(null, "", `#/criteria/${encodeURIComponent(id)}`);
  };

  const isNumericLike = (v) => {
    const s = String(v).trim();
    // 123, 123.45, 78%, 1.42×/x
    return /^-?\d{1,3}(,\d{3})*(\.\d+)?(%|x|\u00D7)?$/i.test(s) || /(%|x|\u00D7)$/i.test(s);
  };

  const renderTable = (id) => {
    const crit = state.criteriaList.find(c => c.id === id);
    if (!crit) return;

    $card.classList.remove("fade-enter");
    $card.classList.add("fade-leave");

    window.setTimeout(() => {
      $table.innerHTML = "";

      const frame = el("div", { className: "codeframe" });
      const head  = el("div", { className: "codeframe-head" }, [
        el("div", { className: "codeframe-dots" }, [
          el("span", { className: "dot dot-red" }),
          el("span", { className: "dot dot-amber" }),
          el("span", { className: "dot dot-green" })
        ]),
        el("div", { className: "codeframe-title" }, crit.name)
      ]);
      const body  = el("div", { className: "codeframe-body" });

      const table = el("table", { className: "table clean-table striped sticky-first compact", attrs: { role: "table" } });

      const thead = el("thead");
      const trHead = el("tr");
      crit.columns.forEach(col => trHead.appendChild(el("th", {}, col)));
      // 追加 ORG 列
      trHead.appendChild(el("th", {}, "ORG"));
      thead.appendChild(trHead);
      table.appendChild(thead);

      const tbody = el("tbody");
      if (!crit.rows || crit.rows.length === 0) {
        const tr = el("tr");
        const td = el("td", { attrs: { colspan: String(crit.columns.length + 1) }, className: "empty" }, "No data for this criterion.");
        tr.appendChild(td);
        tbody.appendChild(tr);
      } else {
        crit.rows.forEach((row, rowIdx) => {
          const tr = el("tr");
          row.forEach((cell, idx) => {
            let content = String(cell);
            let className = isNumericLike(cell) ? "num" : "";
            if (idx === 0 && /^\d+$/.test(content)) {
              const n = parseInt(content, 10);
              const chip = el("span", { className: "chip chip-rank" }, `#${content}`);
              if (n === 1) chip.classList.add('rank-gold');
              else if (n === 2) chip.classList.add('rank-silver');
              else if (n === 3) chip.classList.add('rank-bronze');
              tr.appendChild(el("td", { className: "tight" }, chip));
              return;
            }
            const header = crit.columns[idx] || "";
            if (/language/i.test(header)) {
              const badge = el("span", { className: "badge badge-lang" }, content);
              tr.appendChild(el("td", { className }, badge));
              return;
            }
            tr.appendChild(el("td", { className }, content));
          });
          // 追加 ORG 列单元格（固定为 Sweperf 链接）
          const orgLink = el("a", { attrs: { href: "index.html#overview" } }, "Sweperf");
          tr.appendChild(el("td", {}, orgLink));
          tbody.appendChild(tr);
        });
      }
      table.appendChild(tbody);

      body.appendChild(table);
      frame.appendChild(head);
      frame.appendChild(body);
      $table.appendChild(frame);

      $card.classList.remove("fade-leave");
      $card.classList.add("fade-enter");

      // 模型名过滤 + 灰字暗示 + Tab 补全 + 一键清空
      if ($modelFilter) {
        const modelColIdx = crit.columns.findIndex(c => /agent|model/i.test(c));
        const allModels = (crit.rows||[]).map(r => String(r[modelColIdx]||'')).filter(Boolean);
        const uniqueModels = Array.from(new Set(allModels));

        const applyFilter = () => {
          const q = $modelFilter.value.trim().toLowerCase();
          const rows = [...tbody.querySelectorAll('tr')];
          rows.forEach(tr => {
            const tds = tr.querySelectorAll('td');
            if (!tds || tds.length === 0) return;
            if (tds[0].classList.contains('empty')) { tr.style.display = ''; return; }
            if (modelColIdx === -1) { tr.style.display = ''; return; }
            const cell = tds[modelColIdx];
            const text = cell ? cell.textContent.toLowerCase() : '';
            tr.style.display = q ? (text.includes(q) ? '' : 'none') : '';
          });
        };

        const updateGhost = () => {
          if (!$modelGhost) return;
          const q = $modelFilter.value;
          if (!q) { $modelGhost.textContent = ''; return; }
          const lc = q.toLowerCase();
          const candidates = uniqueModels.filter(m => m.toLowerCase().startsWith(lc));
          if (candidates.length === 1) {
            $modelGhost.textContent = candidates[0];
          } else {
            $modelGhost.textContent = '';
          }
        };

        const onKeydown = (e) => {
          if (e.key === 'Tab' && $modelGhost && $modelGhost.textContent) {
            e.preventDefault();
            $modelFilter.value = $modelGhost.textContent;
            $modelGhost.textContent = '';
            applyFilter();
          }
        };

        const clearInput = () => {
          $modelFilter.value = '';
          if ($modelGhost) $modelGhost.textContent = '';
          applyFilter();
          $modelFilter.focus();
        };

        $modelFilter.removeEventListener('input', $modelFilter.__applyFilter || (()=>{}));
        $modelFilter.__applyFilter = () => { applyFilter(); updateGhost(); };
        $modelFilter.addEventListener('input', $modelFilter.__applyFilter);
        $modelFilter.removeEventListener('keydown', $modelFilter.__onKeydown || (()=>{}));
        $modelFilter.__onKeydown = onKeydown;
        $modelFilter.addEventListener('keydown', onKeydown);
        if ($modelClear) {
          $modelClear.removeEventListener('click', $modelClear.__clear || (()=>{}));
          $modelClear.__clear = clearInput;
          $modelClear.addEventListener('click', clearInput);
        }

        applyFilter();
        updateGhost();
      }
    }, 120);
  };

  const loadData = async () => {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    let text = await res.text();
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    let json;
    try { json = JSON.parse(text); }
    catch (e) { console.error("JSON parse failed. First 200 chars:", text.slice(0, 200)); throw e; }
    return json;
  };

  const init = async () => {
    setLoading(true);
    try {
      let data;
      try { data = await loadData(); }
      catch (err) { console.warn("Falling back to built-in data:", err); data = FALLBACK; }

      const list = Array.isArray(data.criteria) ? data.criteria : [];
      if (list.length === 0) throw new Error("No criteria in data.");
      state.criteriaList = list;

      buildSwitcher(state.criteriaList);

      const m = location.hash.match(/#\/criteria\/([A-Za-z0-9_\-]+)/);
      const targetId = (m && state.criteriaList.some(c => c.id === m[1])) ? m[1] : state.criteriaList[0].id;
      setActive(targetId);

      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(true, `Failed to load leaderboard data: ${(err && err.message) ? err.message : err}`);
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    // 仅首页存在 Tabs
    const tabs = document.getElementById("results-tabs");
    const panels = document.getElementById("results-panels");
    const deck = document.getElementById("results-deck");

    const adjustDeckHeight = (deckEl) => {
      if (!deckEl) return;
      const active = deckEl.querySelector('.card3d.state-active');
      if (!active) return;
      // 取卡片内部内容节点（Examples 中我们包了一层宽度容器；其他场景可能没有）
      const inner = active.querySelector('div[style*="width:"]') || active.firstElementChild || active;
      const contentH = inner ? inner.scrollHeight : active.scrollHeight;
      // 适度留白
      const target = Math.max(240, contentH + 40);
      deckEl.style.height = target + 'px';
    };

    if (tabs && panels && deck) {
      // existing 3D deck logic for Results
      const cards = [...deck.querySelectorAll('.card3d')];
      const keys = cards.map(c => c.getAttribute('data-key'));
      let activeIdx = Math.max(0, [...tabs.querySelectorAll('.tab-btn')].findIndex(b => b.classList.contains('active')));

      const resetInlineTransforms = () => { cards.forEach(c => (c.style.transform = '')); };

      const applyStates = () => {
        resetInlineTransforms();
        cards.forEach((card, idx) => {
          card.classList.remove('state-active','state-prev','state-next','inactive');
          if (idx === activeIdx) {
            card.classList.add('state-active');
          } else if (idx === (activeIdx - 1 + cards.length) % cards.length) {
            card.classList.add('state-prev','inactive');
          } else if (idx === (activeIdx + 1) % cards.length) {
            card.classList.add('state-next','inactive');
          } else {
            card.classList.add('inactive');
          }
        });
        adjustDeckHeight(deck);
      };

      const setActiveByKey = (key) => {
        const idx = keys.indexOf(key);
        if (idx >= 0 && idx !== activeIdx) { activeIdx = idx; applyStates(); }
      };

      // 初始化
      applyStates();

      // 点击 tab 切换（同时更新 3D deck）
      tabs.addEventListener("click", (e) => {
        const btn = e.target.closest(".tab-btn");
        if (!btn) return;
        const id = btn.getAttribute("data-panel"); // res-c1
        tabs.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b === btn));
        setActiveByKey(id.slice(4));
      });

      // 拖拽切换（更敏感）
      let dragStartX = null; let dragging = false;
      let startTransforms = null;
      const getTransforms = () => cards.map(c => c.style.transform);
      const restoreTransforms = (vals) => vals.forEach((t,i)=> (cards[i].style.transform = t||''));
      let dragStartT = 0; let lastX = 0; let lastT = 0;

      const startDrag = (x) => { dragStartX = x; dragging = true; deck.classList.add('dragging'); startTransforms = getTransforms(); dragStartT = performance.now(); lastX = x; lastT = dragStartT; };
      const moveDrag = (x) => {
        if (!dragging) return;
        const dx = x - dragStartX;
        const ratio = Math.max(-1, Math.min(1, dx / 100)); // 极敏感：100px 达到极值
        const prevIdx = (activeIdx - 1 + cards.length) % cards.length;
        const nextIdx = (activeIdx + 1) % cards.length;
        const ry = ratio * 16; const rz = ratio * -130; const rx = Math.abs(ratio) * 4; const rz2 = ratio * 3.5;
        cards[activeIdx].style.transform = `translateX(${ratio*42}px) rotateY(${ry}deg) rotateX(${rx}deg) rotateZ(${rz2}deg) translateZ(${rz}px) scale(${1 - Math.abs(ratio)*0.05})`;
        cards[prevIdx].style.transform   = `translateX(${-42 + ratio*42}px) translateY(3px) rotateY(${-16 + ry}deg) rotateX(${4 - rx}deg) rotateZ(${-3.5 + rz2}deg) translateZ(${-130 + -rz}px) scale(${0.95 + Math.abs(ratio)*0.05})`;
        cards[nextIdx].style.transform   = `translateX(${42 + ratio* -42}px) translateY(3px) rotateY(${16 + -ry}deg) rotateX(${4 - rx}deg) rotateZ(${3.5 - rz2}deg) translateZ(${-130 + -rz}px) scale(${0.95 + Math.abs(ratio)*0.05})`;
        lastX = x; lastT = performance.now();
      };
      const endDrag = (x) => {
        if (!dragging) return; dragging = false; deck.classList.remove('dragging');
        const now = performance.now();
        const dx = x - dragStartX; const dt = now - dragStartT;
        const vx = (x - lastX) / Math.max(1, now - lastT);
        if (Math.abs(vx) > 0.5 || (dt < 280 && Math.abs(dx) > 12)) {
          if (vx < 0 || dx < 0) { activeIdx = (activeIdx + 1) % cards.length; } else { activeIdx = (activeIdx - 1 + cards.length) % cards.length; }
        } else if (dx > 45) { activeIdx = (activeIdx - 1 + cards.length) % cards.length; }
        else if (dx < -45) { activeIdx = (activeIdx + 1) % cards.length; }
        applyStates();
        const key = keys[activeIdx];
        tabs.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-panel') === `res-${key}`));
        restoreTransforms(startTransforms || []); startTransforms = null;
        dragStartT = 0; lastX = 0; lastT = 0;
      };

      deck.addEventListener('pointerdown', (e) => startDrag(e.clientX));
      deck.addEventListener('pointermove', (e) => moveDrag(e.clientX));
      deck.addEventListener('pointerup',   (e) => endDrag(e.clientX));
      deck.addEventListener('pointerleave',(e) => endDrag(e.clientX || 0));
      deck.addEventListener('touchstart',  (e) => startDrag(e.touches[0].clientX), {passive:true});
      deck.addEventListener('touchmove',   (e) => moveDrag(e.touches[0].clientX),  {passive:true});
      deck.addEventListener('touchend',    (e) => endDrag((e.changedTouches[0]||e.touches[0]||{clientX:0}).clientX));

      window.addEventListener('resize', () => adjustDeckHeight(deck));
    }

    // Criteria deck
    const cTabs = document.getElementById('criteria-tabs');
    const cDeck = document.getElementById('criteria-deck');
    if (cTabs && cDeck) {
      const cards = [...cDeck.querySelectorAll('.card3d')];
      const keys = cards.map(c => c.getAttribute('data-key'));
      let activeIdx = Math.max(0, [...cTabs.querySelectorAll('.tab-btn')].findIndex(b => b.classList.contains('active')));
      const resetTransforms = () => cards.forEach(c => (c.style.transform = ''));
      const applyStates = () => {
        resetTransforms();
        cards.forEach((card, idx) => {
          card.classList.remove('state-active','state-prev','state-next','inactive');
          if (idx === activeIdx) card.classList.add('state-active');
          else if (idx === (activeIdx - 1 + cards.length) % cards.length) card.classList.add('state-prev','inactive');
          else if (idx === (activeIdx + 1) % cards.length) card.classList.add('state-next','inactive');
          else card.classList.add('inactive');
        });
        adjustDeckHeight(cDeck);
      };
      const setActiveByKey = (key) => { const i = keys.indexOf(key); if (i>=0 && i!==activeIdx){ activeIdx=i; applyStates(); } };
      applyStates();

      cTabs.addEventListener('click', (e) => {
        const btn = e.target.closest('.tab-btn'); if(!btn) return;
        const id = btn.getAttribute('data-panel');
        cTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b===btn));
        setActiveByKey(id.slice(4));
      });

      let startX=null, dragging=false, startT=0, lastX=0, lastT=0, startTf=null;
      const getTf = () => cards.map(c=>c.style.transform);
      const restoreTf = (vals)=> vals.forEach((t,i)=> (cards[i].style.transform = t||''));

      const startDrag = (x)=>{ startX=x; dragging=true; cDeck.classList.add('dragging'); startTf=getTf(); startT=performance.now(); lastX=x; lastT=startT; };
      const moveDrag = (x)=>{
        if(!dragging) return;
        const dx = x - startX; const ratio = Math.max(-1, Math.min(1, dx/120));
        const prev = (activeIdx - 1 + cards.length)%cards.length, next = (activeIdx + 1)%cards.length;
        const ry = ratio*16, rz = ratio*-120, rx = Math.abs(ratio)*4, rz2 = ratio*3.5;
        cards[activeIdx].style.transform = `translateX(${ratio*42}px) rotateY(${ry}deg) rotateX(${rx}deg) rotateZ(${rz2}deg) translateZ(${rz}px) scale(${1 - Math.abs(ratio)*0.05})`;
        cards[prev].style.transform = `translateX(${-42 + ratio*42}px) translateY(3px) rotateY(${-16 + ry}deg) rotateX(${4 - rx}deg) rotateZ(${-3.5 + rz2}deg) translateZ(${-120 + -rz}px) scale(${0.95 + Math.abs(ratio)*0.05})`;
        cards[next].style.transform = `translateX(${42 + ratio*-42}px) translateY(3px) rotateY(${16 - ry}deg) rotateX(${4 - rx}deg) rotateZ(${3.5 - rz2}deg) translateZ(${-120 + -rz}px) scale(${0.95 + Math.abs(ratio)*0.05})`;
      };
      const endDrag = (x)=>{
        if(!dragging) return; dragging=false; cDeck.classList.remove('dragging');
        const now = performance.now(); const dx = x - startX; const dt = now - startT; const vx = (x - lastX)/Math.max(1, now-lastT);
        if (Math.abs(vx)>0.6 || (dt<260 && Math.abs(dx)>16)) { activeIdx = (vx<0 || dx<0) ? (activeIdx+1)%cards.length : (activeIdx-1+cards.length)%cards.length; }
        else if (dx>48) { activeIdx = (activeIdx-1+cards.length)%cards.length; }
        else if (dx<-48) { activeIdx = (activeIdx+1)%cards.length; }
        applyStates();
        const key = keys[activeIdx];
        cTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-panel')===`res-${key}`));
        restoreTf(startTf||[]); startTf=null; startT=0; lastX=0; lastT=0;
      };

      cDeck.addEventListener('pointerdown', (e)=> startDrag(e.clientX));
      cDeck.addEventListener('pointermove', (e)=> moveDrag(e.clientX));
      cDeck.addEventListener('pointerup',   (e)=> endDrag(e.clientX));
      cDeck.addEventListener('pointerleave',(e)=> endDrag(e.clientX||0));
      cDeck.addEventListener('touchstart',  (e)=> startDrag(e.touches[0].clientX), {passive:true});
      cDeck.addEventListener('touchmove',   (e)=> moveDrag(e.touches[0].clientX),  {passive:true});
      cDeck.addEventListener('touchend',    (e)=> endDrag((e.changedTouches[0]||e.touches[0]||{clientX:0}).clientX));

      window.addEventListener('resize', () => adjustDeckHeight(cDeck));
    }


    // Analysis 交由 assets/analysis.js 动态渲染
  });
  document.addEventListener("DOMContentLoaded", init);
})();

