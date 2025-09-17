/* assets/leaderboard.js */
// Leaderboard 脚本：当页面不存在相关容器时，不进行初始化。
(() => {
  "use strict";

  const DATA_URL = "assets/data/leaderboard.json";

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
    if (!($loading && $card)) return; // guard
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
    if (!$switcher) return; // guard
    $switcher.innerHTML = "";
    $switcher.setAttribute("role", "tablist");
    $switcher.setAttribute("aria-label", "Leaderboard criteria");
    const label = el('span', { className: 'criteria-label', attrs: { 'aria-hidden': 'true' } }, 'Criteria:');
    $switcher.appendChild(label);
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

    $switcher.addEventListener("keydown", (e) => {
      const buttons = [...$switcher.querySelectorAll(".segmented-btn")];
      const idx = buttons.findIndex(b => b.classList.contains("active"));
      if (idx < 0) return;
      if (e.key === "ArrowRight") { e.preventDefault(); const next = buttons[(idx + 1) % buttons.length]; next.click(); next.focus(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); const prev = buttons[(idx - 1 + buttons.length) % buttons.length]; prev.click(); prev.focus(); }
    });
  };

  const setActive = (id) => {
    if (!$switcher) return; // guard
    if (state.activeId === id) return;
    state.activeId = id;
    if ($criteriaSelect) {
      const opt = [...$criteriaSelect.options].find(o => o.value === id);
      if (opt) $criteriaSelect.value = id;
    }
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
    if (history.replaceState) history.replaceState(null, "", `#/criteria/${encodeURIComponent(id)}`);
  };

  const isNumericLike = (v) => {
    const s = String(v).trim();
    return /^-?\d{1,3}(,\d{3})*(\.\d+)?(%|x|\u00D7)?$/i.test(s) || /(%|x|\u00D7)$/i.test(s);
  };

  const renderTable = (id) => {
    if (!($table && $card)) return; // guard
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
      trHead.appendChild(el("th", {}, "ORG"));
      thead.appendChild(trHead);
      table.appendChild(thead);
      const tbody = el("tbody");
      if (!crit.rows || crit.rows.length === 0) {
        const tr = el("tr");
        const td = el("td", { attrs: { colspan: String(crit.columns.length + 1) }, className: "empty" }, "No data for this criterion.");
        tr.appendChild(td); tbody.appendChild(tr);
      } else {
        crit.rows.forEach((row) => {
          const tr = el("tr");
          row.forEach((cell, idx) => {
            let content = String(cell);
            let className = isNumericLike(cell) ? "num" : "";
            if (idx === 0 && /^\d+$/.test(content)) {
              const chip = el("span", { className: "chip chip-rank" }, `#${content}`);
              tr.appendChild(el("td", { className: "tight" }, chip));
              return;
            }
            tr.appendChild(el("td", { className }, content));
          });
          const orgLink = el("a", { attrs: { href: "index.html#overview" } }, "SWE-fficiency");
          tr.appendChild(el("td", {}, orgLink));
          tbody.appendChild(tr);
        });
      }
      table.appendChild(tbody);
      body.appendChild(table);
      frame.appendChild(head); frame.appendChild(body);
      $table.appendChild(frame);
      $card.classList.remove("fade-leave");
      $card.classList.add("fade-enter");
    }, 120);
  };

  const loadData = async () => {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    let text = await res.text();
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    return JSON.parse(text);
  };

  const init = async () => {
    // 如果页面上没有排行榜的容器，则直接跳过初始化
    if (!($switcher && $loading && $card && $table)) return;
    setLoading(true);
    try {
      let data;
      try { data = await loadData(); }
      catch (err) { console.warn("Falling back to built-in data:", err); data = { criteria: [] }; }
      const list = Array.isArray(data.criteria) ? data.criteria : [];
      if (list.length === 0) { setLoading(false); return; }
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

  document.addEventListener("DOMContentLoaded", init);
})();

