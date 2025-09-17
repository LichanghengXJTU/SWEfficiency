/* assets/analysis.js */
// 静态渲染 6 条分析；支持 HTML 与图片。
(() => {
  "use strict";

  const ITEMS = [
    { title: 'Shortcut bias vs. systemic cost reduction', body: `LMs preferentially add localized “shortcuts”---identity checks, ad-hoc early exits, and caches---such as self-equality fast paths, prefix-slice checks, or returning the first repeated array. Experts instead restructure hot paths to lower per-element cost. Experts also lean on compiled/numeric backends (Cython/Pythran/BLAS) to reduce Python overhead. LM shortcuts yield strong speedups when guards hold but degrade off-distribution, whereas systemic reductions are broadly robust.` },
    { title: 'Workload overfitting and semantic drift', body: `A recurring LM pattern is to bake benchmark properties into patches, producing impressive but brittle wins. This sometimes crosses into correctness drift---e.g., returning the original DataFrame from groupby.apply, sampling only 1k of 10M DataFrame slice products, or monkey-patching np.arange for Time objects. Experts instead target generalizable structure (odd-only sieving, composite skipping, per-dimensional slice reuse) while preserving function API semantics.` },
    { title: 'Caching as a crutch vs. scalable elimination of cost', body: `LMs often add global or persistent caches to “remember” answers across runs. Experts remove Python-level work entirely---vectorizing, moving loops to compiled code, or dispatching to type-aware fast paths. These expert changes scale with workload without relying on cache hit rates.` },
    { title: 'Maintainability and data-structure engineering', body: `LM edits are frequently invasive---global monkey-patching, module-level mutable caches, or fast paths tied to dynamic object attributes; some even short-circuit graph assembly. Expert patches are localized and composable---adding a function call with precomputed constants, a Cython helper mirroring existing logic, or reusing shallow copies of constructor arguments. Expert edits reduce blast radius of code edits and eases long-term maintenance while delivering stable speedups.` },
    { title: 'LMs make “satisficing” optimizations and give up before expert parity', body: `
      <figure class="img-block" style="margin:0 0 6px 0;">
        <img src="assets/images/median_traj_len_by_speedup_bucket.png" alt="Median trajectory length by speedup bucket" style="width:100%; height:auto;"/>
        <figcaption class="img-caption">Across three models, this figure shows that the shortest runs happen when LMs achieve >1x speed up ratios---expert-level wins are found early. When they underperform human baselines, trajectories do not stretch to the 100 turn action cap; median action counts sit at less than mid length (30-50 turns) and even creep up from Very Weak/Weak to Moderate before dropping again. This pattern fits a “satisficing” story: once the model secures a modest speedup, it tends to stop instead of pushing any closer to expert parity. Claude 3.7 Sonnet (OpenHands) explores more overall (longer medians) but shows the same shape, a model-agnostic behavior rather than a quirk of one system. This suggests simple early-win stopping heuristics; future agents could employ “don’t-stop-early” triggers when the feasible expert speedup is much larger.</figcaption>
      </figure>
    ` },
    { title: 'Manually Annotated Workloads outperform LM Generation', body: `We also conduct an ablation to examine our manual annotation and observe that our pipeline yields workloads that observe more substantial performance deltas than LM generations on the same expert PRs. For each task instance, we hold the gold patch fixed and measure its speedup under two alternative workloads: (i) an LM-generated (Gemini 2.5 Flash) workload produced from the pre/post diff and relevant diff source files, and (ii) SWE-efficiency’s manually annotated workload curated from PR metadata, and maintainer and author comments (Attribute Filter). Our manually annotated workloads demonstrate a larger performance delta than the LM generations 76% of the time: in 47% of instances, the LM generated workload fails to show a statistically significant improvement at all. Since performance engineering often involves a loop of (i) bottleneck workload identification and (ii) code optimization, this result also shows how the SWE-fficiency dataset can be used to evaluate LM performance understanding via workload generation towards closing the loop on more autonomous performance engineering.` }
  ];

  const buildList = (host, items) => {
    host.innerHTML = '';
    items.forEach(it => {
      const card = document.createElement('div'); card.className = 'analysis-card';
      const header = document.createElement('div'); header.className = 'analysis-header';
      const title = document.createElement('div'); title.className = 'analysis-title'; title.textContent = it.title || '';
      const toggle = document.createElement('div'); toggle.className = 'analysis-toggle'; toggle.setAttribute('aria-hidden','true');
      header.appendChild(title); header.appendChild(toggle);
      const body = document.createElement('div'); body.className = 'analysis-body';
      const inner = document.createElement('div'); inner.className = 'analysis-body-inner'; inner.innerHTML = it.body || '';
      body.appendChild(inner);
      card.appendChild(header); card.appendChild(body);
      host.appendChild(card);

      header.addEventListener('click', () => {
        const isOpen = card.classList.toggle('open');
        body.style.maxHeight = isOpen ? (body.scrollHeight + 'px') : '0px';
      });
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    const host = document.getElementById('analysis-list');
    if (!host) return;
    buildList(host, ITEMS);
  });
})(); 