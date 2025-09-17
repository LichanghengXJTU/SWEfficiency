/* assets/example.js */
// 静态渲染 4 个实例；criteria 仅 SR；人类/LLM patch 采用 diff 高亮并限制高度滚动。
(() => {
  "use strict";

  const CRITERIA = [{ id: 'sr', name: 'SR' }];

  const DIFF_STYLE = {
    add: 'color:#0a7a3e; background: #eefbf3;',
    del: 'color:#b11b1b; background: #fff1f1;',
    ctx: 'color:#0f0f0f;'
  };

  const examples = [
    {
      id: 'pandas-dev__pandas-50524',
      title: 'pandas PR #50524 — PERF: ArrowExtensionArray comparison methods',
      lang: 'Python',
      meta: { instance_id: 'pandas-dev__pandas-50524', repo_url: 'https://github.com/pandas-dev/pandas/pull/50524', commit: 'a28cadbeb6f21da6c768b84473b3415e6efb3115', task: 'PERF: ArrowExtensionArray comparison methods' },
      workload: `import timeit
import statistics

import pandas as pd
import numpy as np

data = np.random.randn(10**6)
data[0] = np.nan

arr = pd.array(data, dtype="float64[pyarrow]")

def workload():
    arr > 0
    
runtimes = timeit.repeat(workload, number=5, repeat=100)

# Print runtime mean and std deviation.
print("Mean:", statistics.mean(runtimes))
print("Std Dev:", statistics.stdev(runtimes))`,
      humanPatch: `--- a/pandas/core/arrays/arrow/array.py
+++ b/pandas/core/arrays/arrow/array.py
@@ -406,8 +406,14 @@ def _cmp_method(self, other, op):
                 f"{op.__name__} not implemented for {type(other)}"
             )
-
-        result = result.to_numpy()
-        return BooleanArray._from_sequence(result)
+        if result.null_count > 0:
+            values = pc.fill_null(result, False).to_numpy()
+            mask = result.is_null().to_numpy()
+        else:
+            values = result.to_numpy()
+            mask = np.zeros(len(values), dtype=np.bool_)
+        return BooleanArray(values, mask)
 
     def _evaluate_op_method(self, other, op, arrow_funcs):
         pc_func = arrow_funcs[op.__name__]`,
      models: [
        { name: 'Claude 3.7 Sonnet (OpenHands)', llmPatch: `--- a/pandas/core/arrays/arrow/array.py
+++ b/pandas/core/arrays/arrow/array.py
@@ -406,8 +406,16 @@ class ArrowExtensionArray(OpsMixin, ExtensionArray):
                 f"{op.__name__} not implemented for {type(other)}"
             )
-
-        result = result.to_numpy()
-        return BooleanArray._from_sequence(result)
+        if result.null_count == 0:
+            result_np = result.to_numpy().astype(bool)
+            return BooleanArray(result_np, np.zeros(len(result), dtype=bool))
        
+        result_np = result.to_numpy().astype(bool)
+        mask = result.is_null().to_numpy()
+        return BooleanArray(result_np, mask)
 
     def _evaluate_op_method(self, other, op, arrow_funcs):
         pc_func = arrow_funcs[op.__name__]`, status: 'TBD', analysis: 'This example shows the LM’s shortcut bias compared to experts preferring to reduce the systemic cost. The patches show how the expert patch lowers the cost for all inputs by (i) keeping work in Arrow kernels and (ii) producing a BooleanArray from a values+mask pair without ever materializing an object-dtype array.', criteriaScores: { sr: 'TBD' } },
        { name: 'GPT-5 Mini (OpenHands)', llmPatch: 'TBD', status: 'TBD', analysis: 'TBD', criteriaScores: { sr: 'TBD' } },
        { name: 'Gemini 2.5 Flash (OpenHands)', llmPatch: 'TBD', status: 'TBD', analysis: 'TBD', criteriaScores: { sr: 'TBD' } }
      ],
      criteriaList: CRITERIA
    },
    {
      id: 'dask__dask-5940',
      title: 'dask PR #5940 — Optimize make_blockwise_graph',
      lang: 'Python',
      meta: { instance_id: 'dask__dask-5940', repo_url: 'https://github.com/dask/dask/pull/5940', commit: '72c7d906212f14df5d515be33c9cc5f0d86b3fec', task: 'Optimize make_blockwise_graph' },
      workload: `import timeit
import statistics

import dask.array as da

A = 500
B = 1000

def setup():

    global layer
    a = da.ones((A, B, 2), chunks=1)
    b = da.zeros((A, B, 1), chunks=1)
    c = a + b
    g = c.__dask_graph__()
    layer = g.layers[c.name]

def workload():
    global layer
    layer._dict

runtimes = timeit.repeat(workload, number=1, repeat=5, setup=setup)

# Print runtime mean and std deviation.
print("Mean:", statistics.mean(runtimes))
print("Std Dev:", statistics.stdev(runtimes))`,
      humanPatch: `--- a/dask/blockwise.py
+++ b/dask/blockwise.py
@@ -341,63 +341,120 @@ def make_blockwise_graph(func, output, out_indices, *arrind_pairs, **kwargs):
-    dummy_indices = all_indices - set(out_indices)
+    dummy_indices = list(all_indices - set(out_indices))
@@
-    keytups = list(itertools.product(*[range(dims[i]) for i in out_indices]))
-    keydicts = [dict(zip(out_indices, tup)) for tup in keytups]
+    index_pos = {ind: i for i, ind in enumerate(out_indices)}
+    zero_pos = {ind: -1 for i, ind in enumerate(out_indices)}
+    index_pos.update(
+        {ind: 2 * i + len(out_indices) for i, ind in enumerate(dummy_indices)}
+    )
+    zero_pos.update(
+        {ind: 2 * i + 1 + len(out_indices) for i, ind in enumerate(dummy_indices)}
+    )
@@
-    dummies = dict((i, list(range(dims[i]))) for i in dummy_indices)
+    dummies = tuple(
+        itertools.chain.from_iterable(
+            [list(range(dims[i])), [0] * dims[i]] for i in dummy_indices
+        )
+    )
+    dummies += (0,)
@@
-    dsk = {}
+    dsk2 = {}
@@
-    valtups = []
-    for kd in keydicts:
+    for out_coords in itertools.product(*[range(dims[i]) for i in out_indices]):
+        coords = out_coords + dummies
         args = []
-        for arg, ind in argpairs:
+        for cmap, axes, arg_ind in zip(coord_maps, concat_axes, argpairs):
+            arg, ind = arg_ind
             if ind is None:
                 args.append(arg)
             else:
-                tups = lol_tuples((arg,), ind, kd, dummies)
-                if any(nb == 1 for nb in numblocks[arg]):
-                    tups2 = zero_broadcast_dimensions(tups, numblocks[arg])
-                else:
-                    tups2 = tups
-                if concatenate and isinstance(tups2, list):
-                    axes = [n for n, i in enumerate(ind) if i in dummies]
-                    tups2 = (concatenate, tups2, axes)
-                args.append(tups2)
-        valtups.append(args)
+                arg_coords = tuple(coords[c] for c in cmap)
+                if axes:
+                    tups = lol_product((arg,), arg_coords)
+                    if concatenate:
+                        tups = (concatenate, tups, axes)
+                else:
+                    tups = (arg,) + arg_coords
+                args.append(tups)
+        if kwargs:
+            val = (apply, func, args, kwargs2)
+        else:
+            args.insert(0, func)
+            val = tuple(args)
+        dsk[(output,) + out_coords] = val
@@
-    if not kwargs:  # will not be used in an apply, should be a tuple
-        valtups = [tuple(vt) for vt in valtups]
@@
-    keys = [(output,) + kt for kt in keytups]
@@
-    if kwargs:
-        task, dsk2 = to_task_dask(kwargs)
-        if dsk2:
-            dsk.update(ensure_dict(dsk2))
-            kwargs2 = task
-        else:
-            kwargs2 = kwargs
-        vals = [(apply, func, vt, kwargs2) for vt in valtups]
-    else:
-        vals = [(func,) + vt for vt in valtups]
-
-    dsk.update(dict(zip(keys, vals)))
+    if dsk2:
+        dsk.update(ensure_dict(dsk2))
 
-    return dsk
+    return dsk
@@
 def lol_product(head, values):
@@
     else:
         return lol_product(head + (values[0],), values[1:])`,
      models: [
        { name: 'TBD Model', llmPatch: 'TBD', status: 'TBD', analysis: 'TBD', criteriaScores: { sr: 'TBD' } }
      ],
      criteriaList: CRITERIA
    },
    {
      id: 'sympy__sympy-21455',
      title: 'sympy PR #21455 — perf(assump): enhance get_known_facts_keys',
      lang: 'Python',
      meta: { instance_id: 'sympy__sympy-21455', repo_url: 'https://github.com/sympy/sympy/pull/21455', commit: 'f2e4a7cfe79dafa7d1dea8e9c56c6db4f2d97c0a', task: 'perf(assump) : enhance get_known_facts_keys' },
      workload: `import timeit
import statistics
from sympy.assumptions.ask import Q, ask
from sympy.abc import x

from sympy.core.cache import clear_cache

def setup():
    clear_cache()    

def workload():
    ask(Q.real(x), Q.positive(x))

runtimes = timeit.repeat(workload, number=5, repeat=1000, setup=setup)

print("Mean:", statistics.mean(runtimes))
print("Std Dev:", statistics.stdev(runtimes))`,
      humanPatch: `--- a/sympy/assumptions/ask_generated.py
+++ b/sympy/assumptions/ask_generated.py
@@ -97,96 +97,168 @@ def get_known_facts_dict():
-        Q.algebraic: (set([Q.algebraic, Q.commutative, Q.finite]),
+        Q.algebraic: (set([Q.algebraic, Q.commutative, Q.complex, Q.finite]),
@@
-        Q.composite: (set([Q.algebraic, Q.commutative, Q.composite, Q.finite,
-        Q.hermitian, Q.positive, Q.rational]), set([Q.imaginary,
-        Q.infinite, Q.irrational, Q.negative, Q.negative_infinite,
-        Q.positive_infinite, Q.prime, Q.transcendental, Q.zero])),
+        Q.composite: (set([Q.algebraic, Q.commutative, Q.complex, Q.composite,
+        Q.extended_nonnegative, Q.extended_nonzero,
+        Q.extended_positive, Q.extended_real, Q.finite, Q.hermitian,
+        Q.integer, Q.nonnegative, Q.nonzero, Q.positive, Q.rational,
+        Q.real]), set([Q.extended_negative, Q.extended_nonpositive,
+        Q.imaginary, Q.infinite, Q.irrational, Q.negative,
+        Q.negative_infinite, Q.nonpositive, Q.positive_infinite,
+        Q.prime, Q.transcendental, Q.zero])),
@@
--- a/sympy/assumptions/facts.py
+++ b/sympy/assumptions/facts.py
@@ -173,12 +173,13 @@ def generate_known_facts_dict(keys, fact):
 @cacheit
 def get_known_facts_keys():
-    """
-    Return the unapplied unary predicates.
-    """
+    """
+    Return every unary predicates registered to \`\`Q\`\`.
+
+    This function is used to generate the keys for
+    \`\`generate_known_facts_dict\`\`.
+
+    """
     exclude = set()
-    for pred in get_composite_predicates():
-        exclude.add(pred)
     for pred in [Q.eq, Q.ne, Q.gt, Q.lt, Q.ge, Q.le]:
         # exclude polyadic predicates
         exclude.add(pred)`,
      models: [ { name: 'TBD Model', llmPatch: 'TBD', status: 'TBD', analysis: 'TBD', criteriaScores: { sr: 'TBD' } } ],
      criteriaList: CRITERIA
    },
    {
      id: 'pandas-dev__pandas-50089',
      title: 'pandas PR #50089 — PERF: 34% faster Series.to_dict',
      lang: 'Python',
      meta: { instance_id: 'pandas-dev__pandas-50089', repo_url: 'https://github.com/pandas-dev/pandas/pull/50089', commit: '7c208c8907f5ab18f807366c0c5e26ae1dbca299', task: 'PERF: 34% faster Series.to_dict' },
      workload: `import timeit
import statistics

import pandas as pd
import random

df = pd.Series([random.random() for _ in range(1000)], dtype=float)

def workload():
    df.to_dict()

runtimes = timeit.repeat(workload, number=1, repeat=10**5)

# Print runtime mean and std deviation.
print("Mean:", statistics.mean(runtimes))
print("Std Dev:", statistics.stdev(runtimes))`,
      humanPatch: `--- a/pandas/core/series.py
+++ b/pandas/core/series.py
@@ -1818,7 +1818,7 @@ def to_dict(self, into: type[dict] = dict) -> dict:
-            return into_c((k, v) for k, v in self.items())
+            return into_c(self.items())`,
      models: [
        { name: 'GPT-5 Mini (OpenHands)', llmPatch: `--- a/pandas/core/series.py
+++ b/pandas/core/series.py
@@ -1816,9 +1816,18 @@ class Series(base.IndexOpsMixin, NDFrame):  # type: ignore[misc]
-            return into_c((k, v) for k, v in self.items())
+            values = getattr(self, "_values", None)
+            if values is None:
+                return into_c((k, v) for k, v in self.items())
+            try:
+                list_vals = values.tolist()
+            except Exception:
+                # fallback to generic iteration
+                list_vals = [v for v in values]
+            return into_c(zip(self.index, list_vals))`, status: 'TBD', analysis: 'Expert edit replaces generator of key-value pairs with view self.items(), eliminating per-element tuple allocation (1.38x). GPT-5 Mini converts underlying array to list and zips with index to reduce Python-level boxing (1.98x). Shows invasion of LM’s edition.', criteriaScores: { sr: 'TBD' } },
        { name: 'Claude 3.7 Sonnet (OpenHands)', llmPatch: 'TBD', status: 'TBD', analysis: 'TBD', criteriaScores: { sr: 'TBD' } }
      ],
      criteriaList: CRITERIA
    }
  ];

  const toDiffHtml = (text) => {
    // 简单双字符行首识别："+" 绿，"-" 红，其他黑
    const esc = (s) => s.replace(/[&<>]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]));
    return text.split('\n').map(line => {
      if (line.startsWith('+')) return `<div style="${DIFF_STYLE.add}">${esc(line)}</div>`;
      if (line.startsWith('-')) return `<div style="${DIFF_STYLE.del}">${esc(line)}</div>`;
      return `<div style="${DIFF_STYLE.ctx}">${esc(line)}</div>`;
    }).join('');
  };

  const measureCardContent = (card) => {
    const inner = card.querySelector('div[style*="width:"]') || card.firstElementChild || card;
    return inner ? inner.scrollHeight : card.scrollHeight;
  };

  const applyDeckMaxHeight = (eDeck) => {
    const cards = [...eDeck.querySelectorAll('.card3d')];
    const heights = cards.map(measureCardContent);
    const maxH = Math.max(280, ...heights) + 40;
    eDeck.style.height = maxH + 'px';
  };

  const renderExamples = () => {
    const eTabs = document.getElementById('examples-tabs');
    const eDeck = document.getElementById('examples-deck');
    if (!eTabs || !eDeck) return;

    // tabs
    eTabs.innerHTML = '';
    examples.forEach((eg, idx) => {
      const btn = document.createElement('button');
      btn.className = 'tab-btn' + (idx === 0 ? ' active' : '');
      btn.setAttribute('data-panel', `eg-${eg.id}`);
      btn.textContent = eg.id;
      eTabs.appendChild(btn);
    });

    // cards
    eDeck.innerHTML = '';
    examples.forEach((eg, idx) => {
      const card = document.createElement('div');
      card.className = 'card3d' + (idx === 0 ? ' state-active' : ' state-next inactive');
      card.setAttribute('data-key', eg.id);

      const wrap = document.createElement('div');
      wrap.setAttribute('style','width:92%;');

      const headRow = document.createElement('div');
      headRow.setAttribute('style','display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px;');
      const title = document.createElement('div'); title.className='section-title'; title.setAttribute('style','font-size:18px; margin:0;'); title.textContent=eg.title||eg.id;
      const chips = document.createElement('div'); chips.className='chips';
      const modelSelectChip = document.createElement('div'); modelSelectChip.className='chip select';
      const modelSelect = document.createElement('select'); modelSelect.id = `${eg.id}-model-select`;
      (eg.models||[]).forEach(m=>{ const o=document.createElement('option'); o.value=m.name; o.textContent=m.name; modelSelect.appendChild(o); });
      modelSelectChip.appendChild(modelSelect); chips.appendChild(modelSelectChip);
      const status = document.createElement('div'); status.className='status-pill'; status.id=`${eg.id}-status`; chips.appendChild(status);
      const lang = document.createElement('div'); lang.className='lang-pill'; lang.id = `${eg.id}-lang`; chips.appendChild(lang);
      headRow.appendChild(title); headRow.appendChild(chips);

      const meta = document.createElement('div'); meta.className='meta'; meta.setAttribute('style','margin-bottom:8px;');
      const repoLink = eg.meta && eg.meta.repo_url ? `<a href="${eg.meta.repo_url}" target="_blank" rel="noreferrer">link</a>` : '#';
      const taskText = (eg.meta && eg.meta.task) ? eg.meta.task : '';
      const instanceText = (eg.meta && eg.meta.instance_id) ? eg.meta.instance_id : '';
      const commitText = (eg.meta && eg.meta.commit) ? eg.meta.commit : '';
      meta.innerHTML = `tasks：${taskText}<br/>instance_id: ${instanceText} . GitHub link: ${repoLink}<br/>commit: ${commitText}`;

      const grid = document.createElement('div'); grid.className='grid grid-12'; grid.setAttribute('style','gap:10px;');

      // workload
      const colL = document.createElement('div'); colL.className='col-6 col-12-sm';
      const metaL = document.createElement('div'); metaL.className='meta'; metaL.setAttribute('style','margin-bottom:6px;'); metaL.textContent='workload';
      const preW = document.createElement('pre'); preW.className='codebox auto'; const codeW=document.createElement('code'); codeW.textContent=eg.workload||'TBD'; preW.appendChild(codeW); colL.appendChild(metaL); colL.appendChild(preW);

      // human patch
      const colR = document.createElement('div'); colR.className='col-6 col-12-sm';
      const topR = document.createElement('div'); topR.setAttribute('style','display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;');
      const metaR = document.createElement('div'); metaR.className='meta'; metaR.textContent='human patch';
      const chipsR = document.createElement('div'); chipsR.className='chips';
      const humanCritChip = document.createElement('div'); humanCritChip.className='chip select';
      const humanCrit = document.createElement('select'); humanCrit.id=`${eg.id}-human-crit`; (eg.criteriaList||[]).forEach(c=>{ const o=document.createElement('option'); o.value=c.id; o.textContent=c.name||c.id; humanCrit.appendChild(o); });
      humanCritChip.appendChild(humanCrit); const humanScore = document.createElement('div'); humanScore.className='status-pill'; humanScore.id=`${eg.id}-human-score`; humanScore.textContent='TBD'; chipsR.appendChild(humanCritChip); chipsR.appendChild(humanScore);
      topR.appendChild(metaR); topR.appendChild(chipsR);
      const preH = document.createElement('pre'); preH.className='codebox sm'; preH.style.maxHeight='240px'; preH.style.overflow='auto'; const codeH = document.createElement('code'); codeH.innerHTML = toDiffHtml(eg.humanPatch||'TBD'); preH.appendChild(codeH);
      colR.appendChild(topR); colR.appendChild(preH);

      // LLM patch
      const colLLM = document.createElement('div'); colLLM.className='col-12';
      const topLLM = document.createElement('div'); topLLM.setAttribute('style','display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;');
      const metaLLM = document.createElement('div'); metaLLM.className='meta'; metaLLM.textContent='LLM patch';
      const chipsLLM = document.createElement('div'); chipsLLM.className='chips';
      const llmCritChip = document.createElement('div'); llmCritChip.className='chip select';
      const llmCrit = document.createElement('select'); llmCrit.id = `${eg.id}-llm-crit`; (eg.criteriaList||[]).forEach(c=>{ const o=document.createElement('option'); o.value=c.id; o.textContent=c.name||c.id; llmCrit.appendChild(o); });
      llmCritChip.appendChild(llmCrit); const llmScore = document.createElement('div'); llmScore.className='status-pill'; llmScore.id=`${eg.id}-llm-score`; llmScore.textContent='TBD'; chipsLLM.appendChild(llmCritChip); chipsLLM.appendChild(llmScore);
      topLLM.appendChild(metaLLM); topLLM.appendChild(chipsLLM);
      const preLLM = document.createElement('pre'); preLLM.className='codebox sm'; preLLM.style.maxHeight='240px'; preLLM.style.overflow='auto'; const codeLLM=document.createElement('code'); codeLLM.id=`${eg.id}-llm`; codeLLM.innerHTML='TBD'; preLLM.appendChild(codeLLM);
      colLLM.appendChild(topLLM); colLLM.appendChild(preLLM);

      // analysis
      const colA = document.createElement('div'); colA.className='col-12';
      const metaA = document.createElement('div'); metaA.className='meta'; metaA.setAttribute('style','margin-bottom:6px;'); metaA.textContent='Analysis';
      const ana = document.createElement('div'); ana.className='flat-card placeholder sm preline'; ana.id = `${eg.id}-analysis`; ana.textContent='TBD';
      colA.appendChild(metaA); colA.appendChild(ana);

      grid.appendChild(colL); grid.appendChild(colR); grid.appendChild(colLLM); grid.appendChild(colA);
      wrap.appendChild(headRow); wrap.appendChild(meta); wrap.appendChild(grid); card.appendChild(wrap); eDeck.appendChild(card);
    });

    // Deck
    const cards = [...eDeck.querySelectorAll('.card3d')];
    const keys = cards.map(c => c.getAttribute('data-key'));
    let activeIdx = 0;
    const resetTf = () => cards.forEach(c => (c.style.transform = ''));
    const applyStates = () => {
      resetTf();
      cards.forEach((card) => { card.className = card.className.replace(/\bstate-active\b|\bstate-prev\b|\bstate-next\b|\bstate-prev-2\b|\bstate-next-2\b|\bstate-prev-3\b|\bstate-next-3\b|\binactive\b|\binactive-far\b/g, '').trim(); });
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
    const moveDrag = (x)=>{ if(!dragging) return; const dx=x-sX; const ratio=Math.max(-1,Math.min(1,dx/120)); const prev=(activeIdx-1+cards.length)%cards.length, next=(activeIdx+1)%cards.length; const ry=ratio*16, rz=ratio*-120, rx=Math.abs(ratio)*4, rz2=ratio*3.5; cards[activeIdx].style.transform = `translateX(${ratio*42}px) rotateY(${ry}deg) rotateX(${rx}deg) rotateZ(${rz2}deg) translateZ(${rz}px)`; cards[prev].style.transform = `translateX(${-42+ratio*42}px) translateY(3px) rotateY(${-16+ry}deg) rotateX(${4-rx}deg) rotateZ(${-3.5+rz2}deg) translateZ(${-120+-rz}px)`; cards[next].style.transform = `translateX(${42+ratio*-42}px) translateY(3px) rotateY(${16-ry}deg) rotateX(${4-rx}deg) rotateZ(${3.5-rz2}deg) translateZ(${-120+-rz}px)`; lX=x; lT=performance.now(); };
    const endDrag = (x)=>{ if(!dragging) return; dragging=false; eDeck.classList.remove('dragging'); const now=performance.now(); const dx=x-sX; const dt=now-sT; const vx=(x-lX)/Math.max(1, now-lT); if (Math.abs(vx)>0.6 || (dt<260 && Math.abs(dx)>16)) { activeIdx = (vx<0||dx<0) ? (activeIdx+1)%cards.length : (activeIdx-1+cards.length)%cards.length; } else if (dx>48) { activeIdx = (activeIdx-1+cards.length)%cards.length; } else if (dx<-48) { activeIdx = (activeIdx+1)%cards.length; } applyStates(); const key=keys[activeIdx]; eTabs.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-panel')===`eg-${key}`)); restoreTf(sTf||[]); sTf=null; sT=0; lX=0; lT=0; };
    eDeck.addEventListener('pointerdown', startDrag);
    eDeck.addEventListener('pointermove', (e)=> moveDrag(e.clientX));
    eDeck.addEventListener('pointerup',   (e)=> endDrag(e.clientX));
    eDeck.addEventListener('pointerleave',(e)=> endDrag(e.clientX || 0));
    eDeck.addEventListener('touchstart',  (e)=> { if (isInteractive(e.target)) return; startDrag(e.touches[0]); }, {passive:true});
    eDeck.addEventListener('touchmove',   (e)=> moveDrag(e.touches[0].clientX),  {passive:true});
    eDeck.addEventListener('touchend',    (e)=> endDrag((e.changedTouches[0]||e.touches[0]||{clientX:0}).clientX));

    // bind model selection
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
        statusEl.textContent = m.status || 'TBD';
        statusEl.classList.remove('ok','fail');
        if ((m.status||'').toLowerCase() === 'success') statusEl.classList.add('ok');
        if ((m.status||'').toLowerCase() === 'failure') statusEl.classList.add('fail');
        langEl.textContent = eg.lang || '';
        llmCode.innerHTML = toDiffHtml(m.llmPatch || 'TBD');
        analysisEl.textContent = m.analysis || 'TBD';
        const scoreOf = (cid) => (m.criteriaScores && m.criteriaScores[cid]) ? m.criteriaScores[cid] : 'TBD';
        if (humanCrit && humanScore) humanScore.textContent = scoreOf(humanCrit.value||'sr');
        if (llmCrit && llmScore) llmScore.textContent = scoreOf(llmCrit.value||'sr');
        applyDeckMaxHeight(eDeck);
      };
      if (modelSel) modelSel.addEventListener('change', applyModel);
      applyModel();
    };

    examples.forEach(eg => updateByModel(eg));
    window.addEventListener('resize', () => applyDeckMaxHeight(eDeck));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderExamples);
  } else {
    renderExamples();
  }
})(); 