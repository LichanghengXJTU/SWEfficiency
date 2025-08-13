/* assets/anchor_scroll.js */
(() => {
  "use strict";

  // 强制由我们接管位置恢复
  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch {}

  const prefersReducedMotion = (() => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  })();

  const getHeaderOffset = () => {
    const root = getComputedStyle(document.documentElement).getPropertyValue('--header-height');
    const n = parseInt(root, 10);
    return (isFinite(n) && n > 0) ? (n + 16) : 96; // header + margin
  };

  const smoothScrollToY = (y) => {
    const top = Math.max(0, y);
    window.scrollTo({ top, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  };

  const scrollToElement = (el) => {
    if (!el) return false;
    const y = el.getBoundingClientRect().top + window.scrollY - getHeaderOffset();
    smoothScrollToY(y);
    return true;
  };

  // 1) 拦截站内锚点点击，改为平滑滚动并修正头部偏移
  const isSamePageHash = (a) => {
    if (!a || !a.getAttribute) return false;
    const href = a.getAttribute('href');
    if (!href) return false;
    const url = new URL(href, window.location.href);
    const sameOrigin = url.origin === window.location.origin;
    const samePath = url.pathname === window.location.pathname;
    return sameOrigin && samePath && url.hash && url.hash.length > 1;
  };

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    if (!isSamePageHash(a)) return;
    const url = new URL(a.getAttribute('href'), window.location.href);
    const target = document.querySelector(url.hash);
    if (!target) return;
    e.preventDefault();
    history.pushState(null, '', url.hash);
    scrollToElement(target);
  }, { passive: false });

  const fromLeaderboard = () => {
    try { return sessionStorage.getItem('gotoPlatforms') === '1'; } catch { return false; }
  };
  const clearLeaderboardFlag = () => { try { sessionStorage.removeItem('gotoPlatforms'); } catch {} };

  // 2) hash 首次平滑处理（含 leaderboard→#platforms 强化校正）
  const handleInitialHash = () => {
    const hash = window.location.hash;
    if (!hash || hash.length <= 1) return false;
    const target = document.querySelector(hash);
    if (!target) return false;
    let tries = 0; let lastH = 0;
    const check = () => {
      const h = document.body ? document.body.scrollHeight : 0;
      const stable = Math.abs(h - lastH) < 2;
      lastH = h; tries++;
      if (stable || tries > 12) {
        scrollToElement(target);
        // 若来自 leaderboard 且是 #platforms，追加多次平滑校正，确保最终落位正确
        if (fromLeaderboard() && hash === '#platforms') {
          const bumps = [200, 450, 800, 1200];
          bumps.forEach(ms => setTimeout(() => scrollToElement(target), ms));
          clearLeaderboardFlag();
        }
      } else {
        setTimeout(check, 100);
      }
    };
    setTimeout(check, 0);
    return true;
  };

  // 3) 精确保存/恢复当前位置（按 pathname）
  const keyForPath = () => `scroll:${location.pathname}`;
  const saveScrollNow = () => {
    try {
      const data = { x: window.scrollX || 0, y: window.scrollY || 0, ts: Date.now() };
      sessionStorage.setItem(keyForPath(), JSON.stringify(data));
    } catch {}
  };
  let throttle = false;
  const onScroll = () => {
    if (throttle) return;
    throttle = true;
    requestAnimationFrame(() => { throttle = false; saveScrollNow(); });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('pagehide', saveScrollNow, { passive: true });
  window.addEventListener('beforeunload', saveScrollNow, { passive: true });

  const getSaved = () => {
    try {
      const raw = sessionStorage.getItem(keyForPath());
      if (!raw) return null;
      const v = JSON.parse(raw);
      if (typeof v === 'object' && v && Number.isFinite(v.y)) return v;
    } catch {}
    return null;
  };

  // 用户交互即停止恢复
  let cancelRestore = false;
  const stopRestore = () => { cancelRestore = true; };
  window.addEventListener('pointerdown', stopRestore, { passive: true, once: true });
  window.addEventListener('wheel', stopRestore, { passive: true, once: true });
  window.addEventListener('keydown', stopRestore, { passive: true, once: true });

  const restoreSavedPosition = (durationMs = 1600) => {
    const saved = getSaved();
    if (!saved) return;
    const targetY = Math.max(0, saved.y);
    const start = performance.now();
    const tick = () => {
      if (cancelRestore) return;
      if (Math.abs(window.scrollY - targetY) > 1) {
        window.scrollTo({ top: targetY, left: saved.x || 0, behavior: 'auto' });
      }
      if (performance.now() - start < durationMs) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const onLoad = () => {
    const hashed = !!(location.hash && location.hash.length > 1);
    if (hashed && fromLeaderboard() && location.hash === '#platforms') {
      handleInitialHash();
      clearLeaderboardFlag();
    } else {
      restoreSavedPosition(1800);
    }
  };

  window.addEventListener('load', onLoad);
  document.addEventListener('DOMContentLoaded', () => { if (document.readyState === 'complete') onLoad(); });
})(); 