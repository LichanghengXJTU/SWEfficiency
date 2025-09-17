/* assets/features.js */
// 静态渲染 Features。第一项包含图片，图片横向居中、保持比例，文字置于图片下方。
(() => {
  "use strict";

  const FEATURES = [
    {
      id: 'data-collection',
      title: 'Scientific data collection',
      image: 'assets/images/data_pipeline.png',
      body:
        'We select and scrap the pull requests in 9 repositories, use 3 key attributes to filter the tasks, identify the covering correctness tests, annotate the performance workload and filter the instances according to their execution results. These procedures promise the data we collect are worthy to discuss.'
    },
    {
      id: 'open-precise',
      title: 'Open-ended but precise evaluation criteria',
      body:
        'Providing only the workload to be optimized as part of task formulation makes the optimization problem highly open-ended: agents can choose from a wide range of approaches, including algorithmic changes, library substitutions, memory layout optimizations, or parallelization, which mirrors the flexibility of real world problems. Spontaneously, our evaluation is made precise by grounding correctness in an explicit set of unit and integration tests, which guarantee an unambiguous criteria for functional correctness.'
    },
    {
      id: 'perf-vs-corr',
      title: 'Clear distinction between performance and correctness workloads',
      body:
        'We separately annotate realistic performance workloads from PR information and use static analysis tooling to identify key correctness tests for task instance construction, satisfying the software standards that the performance benchmarks are clearly separated from correctness tests.'
    },
    {
      id: 'preserve-correctness',
      title: 'Preserving correctness during optimization',
      body:
        'Our benchmark emphasizes the pass-to-pass setting of performance engineering: improving runtime code without introducing new behavior or breaking existing tests, which highlights a more realistic performance engineering journey that the new behaviors are rarely introduced when optimizing code but the existing functionality remains unchanged.'
    }
  ];

  const render = () => {
    const cards = document.querySelectorAll('.features-grid .flat-card');
    if (!cards || cards.length === 0) return;
    FEATURES.forEach((item, idx) => {
      const host = cards[idx];
      if (!host) return;
      host.innerHTML = '';
      const wrap = document.createElement('div'); wrap.className = 'feat-inner';

      if (idx === 0 && item.image) {
        // 第一项：图片横向居中 + 文字在下方
        const fig = document.createElement('figure');
        fig.style.margin = '0'; fig.style.textAlign = 'center';
        const img = document.createElement('img');
        img.src = item.image; img.alt = item.title; img.style.maxWidth = '100%'; img.style.height = 'auto';
        fig.appendChild(img);
        const cap = document.createElement('figcaption');
        cap.className = 'img-caption'; cap.textContent = '';
        fig.appendChild(cap);
        wrap.appendChild(fig);
        const title = document.createElement('div'); title.className = 'feat-title'; title.textContent = item.title;
        const body = document.createElement('div'); body.className = 'feat-body'; body.textContent = item.body;
        wrap.appendChild(title); wrap.appendChild(body);
      } else {
        const title = document.createElement('div'); title.className = 'feat-title'; title.textContent = item.title;
        const body = document.createElement('div'); body.className = 'feat-body'; body.textContent = item.body;
        wrap.appendChild(title); wrap.appendChild(body);
      }
      host.appendChild(wrap);
    });
  };

  document.addEventListener('DOMContentLoaded', render);
})(); 