/* The book stage: three hinged leaves (prev / cur / next) that follow the finger, with shading,
   settle physics, focal-point zoom and tap/drag/pinch handling. Emits events on RCB.bus. */
(function () {
  'use strict';
  const RCB = (window.RCB = window.RCB || {});
  const { core, bus, data } = RCB;
  const { pages, coverVariants, LAST } = data;
  const MAX = core.MAX_FLIP_ANGLE;
  const DOUBLE_TAP_ZOOM = 2.4;

  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const prefetched = new Set();

  let stage, book, zoomEl, ripples, live, backdrop;
  let leaves = null;               // { prev, cur, next } -> { el, img, src }
  let index = 0;
  let coverIdx = Math.floor(Math.random() * coverVariants.length);
  let anim = null;                 // active settle animation
  let drag = null;                 // active finger drag
  let zoom = { scale: 1, x: 0, y: 0 };
  let pinchBase = null;
  let geom = null;
  let bdFlip = false;
  let gestures = null;
  let swapping = false;

  const reduced = () => reducedQuery.matches;
  const isZoomed = () => zoom.scale > 1.05;

  // ---------- content helpers ----------
  const srcFor = (i) => (i === 0 ? coverVariants[coverIdx].src : pages[i].src);
  const thumbFor = (i) => (i === 0 ? coverVariants[coverIdx].thumb : pages[i].thumb);
  const altFor = (i) => (i === 0 ? 'שער הספר' : `${pages[i].title} — ${pages[i].loc}`);

  function prefetch(i) {
    if (i === null || i < 0 || i > LAST) return;
    const src = srcFor(i);
    if (prefetched.has(src)) return;
    prefetched.add(src);
    const im = new Image();
    im.decoding = 'async';
    im.src = src;
    if (im.decode) im.decode().catch(() => prefetched.delete(src));
  }

  function setLeaf(leaf, i) {
    const src = i === null ? '' : srcFor(i);
    if (leaf.src === src) return;
    leaf.src = src;
    if (i === null) {
      leaf.el.dataset.empty = '1';
      leaf.img.removeAttribute('src');
      return;
    }
    delete leaf.el.dataset.empty;
    leaf.el.classList.add('loading');
    leaf.el.classList.remove('broken');
    leaf.img.src = src;
    if (leaf.img.complete && leaf.img.naturalWidth) leaf.el.classList.remove('loading');
  }

  function refreshLeaves() {
    setLeaf(leaves.cur, index);
    setLeaf(leaves.next, core.neighbor(index, 'next', LAST));
    setLeaf(leaves.prev, core.neighbor(index, 'prev', LAST));
    leaves.cur.img.alt = altFor(index);
    prefetch(index + 1); prefetch(index - 1); prefetch(index + 2);
  }

  function setBackdrop(i) {
    const [a, b] = backdrop;
    const incoming = bdFlip ? a : b;
    const outgoing = bdFlip ? b : a;
    bdFlip = !bdFlip;
    const apply = () => { incoming.classList.add('on'); outgoing.classList.remove('on'); };
    incoming.onload = apply;
    incoming.onerror = apply;
    incoming.src = thumbFor(i);
    if (incoming.complete && incoming.naturalWidth) apply();
  }

  // ---------- visuals ----------
  const setVars = (leaf, vars) => {
    for (const k in vars) leaf.el.style.setProperty(k, vars[k]);
  };

  function restLeaves() {
    const { prev, cur, next } = leaves;
    prev.el.style.zIndex = 3; cur.el.style.zIndex = 2; next.el.style.zIndex = 1;
    cur.el.style.transform = 'none'; cur.el.style.opacity = '1';
    next.el.style.transform = 'none'; next.el.style.opacity = '1';
    if (reduced()) { prev.el.style.transform = 'none'; prev.el.style.opacity = '0'; }
    else { prev.el.style.transform = `rotateY(${-MAX}deg)`; prev.el.style.opacity = '1'; }
    [prev, cur, next].forEach((l) => setVars(l, { '--shade': 0, '--hl': 0, '--dim': 0, '--cast': 0, '--edge': '0%' }));
  }

  function renderFlip(dir, p) {
    const turning = dir === 'next' ? leaves.cur : leaves.prev;
    const under = dir === 'next' ? leaves.next : leaves.cur;
    const q = dir === 'next' ? p : 1 - p;        // how far the turning leaf is over the spine
    const g = core.flipGeometry(q);
    if (reduced()) turning.el.style.opacity = String(dir === 'next' ? 1 - p : p);
    else turning.el.style.transform = `rotateY(${-g.angle}deg)`;
    setVars(turning, { '--shade': g.curShade, '--hl': g.highlight });
    setVars(under, { '--dim': g.nextShade, '--edge': `${100 - g.edgePct}%`, '--cast': 0.55 * Math.pow(Math.max(g.highlight, 0), 0.6) });
  }

  function renderBlocked(dir, p) {
    if (reduced()) return;
    leaves.cur.el.style.transform = `rotateY(${(dir === 'next' ? -1 : 1) * p * 40}deg)`;
  }

  // ---------- turning ----------
  function commitTurn(dir, target) {
    const old = leaves;
    leaves = dir === 'next' ? { prev: old.cur, cur: old.next, next: old.prev } : { prev: old.next, cur: old.prev, next: old.cur };
    const from = index;
    index = target;
    restLeaves();
    refreshLeaves();
    setBackdrop(index);
    live.textContent = core.chapterAnnouncement(index, data.TOTAL_PAGES);
    bus.emit('turn:end', { index, dir });
    bus.emit('change', { index, from, dir, page: pages[index], coverIdx });
  }

  function finishAnim() {
    if (!anim) return;
    const a = anim;
    anim = null;
    cancelAnimationFrame(a.raf);
    renderFlip(a.dir, a.to);
    if (a.commit) commitTurn(a.dir, a.target);
    else { restLeaves(); bus.emit('turn:cancel', {}); }
  }

  function animate(dir, from, to, duration, commit, target) {
    const t0 = performance.now();
    anim = { dir, to, commit, target, raf: 0 };
    const me = anim;
    const frame = (now) => {
      if (anim !== me) return;
      const t = Math.min((now - t0) / duration, 1);
      renderFlip(dir, from + (to - from) * core.easeOutCubic(t));
      if (t < 1) me.raf = requestAnimationFrame(frame);
      else finishAnim();
    };
    me.raf = requestAnimationFrame(frame);
  }

  /** Turn to any page. Neighbours animate with the same hinged flip; far jumps flip straight to the target. */
  function goTo(target, { source = 'api', duration = 400, velocity = 0 } = {}) {
    if (drag || target === index || target < 0 || target > LAST) return false;
    finishAnim();
    if (target === index) return false;
    if (isZoomed()) resetZoom(false);
    const dir = target > index ? 'next' : 'prev';
    setLeaf(dir === 'next' ? leaves.next : leaves.prev, target);
    setBackdrop(target);
    bus.emit('turn:start', { dir, from: index, to: target, source, velocity });
    animate(dir, 0, 1, duration, true, target);
    return true;
  }

  function step(dir, source) {
    finishAnim();
    const target = core.neighbor(index, dir, LAST);
    if (target === null) { bump(dir); return false; }
    return goTo(target, { source, duration: 360 });
  }

  function bump(dir) {
    bus.emit('edge:bump', { dir });
    if (reduced() || drag || anim) return;
    const el = leaves.cur.el;
    el.animate(
      [{ transform: 'none' }, { transform: `rotateY(${dir === 'next' ? -7 : 7}deg)` }, { transform: 'none' }],
      { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' }
    );
  }

  // ---------- zoom ----------
  function bookGeom() {
    const r = book.getBoundingClientRect();
    return { w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  }

  function applyZoom(animated) {
    zoomEl.classList.toggle('animating', !!animated);
    zoomEl.style.transform = `translate3d(${zoom.x}px, ${zoom.y}px, 0) scale(${zoom.scale})`;
    stage.classList.toggle('is-zoomed', isZoomed());
    bus.emit('zoom', { scale: zoom.scale, zoomed: isZoomed() });
  }

  function zoomTo(scale, clientX, clientY, animated = true) {
    const g = bookGeom();
    zoom = core.zoomAt(zoom, scale, clientX - g.cx, clientY - g.cy, g.w, g.h);
    applyZoom(animated);
  }

  function resetZoom(animated = true) {
    if (zoom.scale === 1 && zoom.x === 0 && zoom.y === 0) return;
    zoom = { scale: 1, x: 0, y: 0 };
    applyZoom(animated);
  }

  function toggleZoom(clientX, clientY) {
    if (isZoomed()) resetZoom(true);
    else {
      const g = bookGeom();
      zoomTo(DOUBLE_TAP_ZOOM, clientX ?? g.cx, clientY ?? g.cy, true);
    }
  }

  // ---------- ripples ----------
  function ripple(x, y) {
    if (reduced()) return;
    const r = stage.getBoundingClientRect();
    const d = document.createElement('span');
    d.className = 'ripple';
    d.style.left = `${x - r.left}px`;
    d.style.top = `${y - r.top}px`;
    ripples.appendChild(d);
    d.addEventListener('animationend', () => d.remove(), { once: true });
  }

  // ---------- gesture handlers ----------
  const handlers = {
    isZoomed,
    onTouchDown() { finishAnim(); bus.emit('touch', {}); },
    onDragStart() {
      finishAnim();
      drag = { dir: 'next', progress: 0, armed: false };
      bus.emit('drag:start', {});
    },
    onDrag({ dx }) {
      if (!drag) return;
      const r = core.dragToTurn(dx, book.getBoundingClientRect().width, index, LAST);
      if (r.dir !== drag.dir) { restLeaves(); drag.dir = r.dir; }
      drag.progress = r.progress;
      if (r.blocked) renderBlocked(r.dir, r.progress);
      else renderFlip(r.dir, r.progress);
      const armed = !r.blocked && r.progress >= core.COMMIT_PROGRESS;
      if (armed !== drag.armed) { drag.armed = armed; bus.emit('drag:detent', { armed }); }
    },
    onDragEnd({ dx, vp, cancelled }) {
      if (!drag) return;
      drag = null;
      const r = core.dragToTurn(dx, book.getBoundingClientRect().width, index, LAST);
      const v = r.dir === 'next' ? -vp : vp;
      const commit = !cancelled && core.shouldCommit(r.progress, v, r.blocked);
      bus.emit('drag:end', { commit });
      if (r.blocked) {
        if (r.progress > 0.04) bus.emit('edge:bump', { dir: r.dir });
        leaves.cur.el.animate([{ transform: leaves.cur.el.style.transform || 'none' }, { transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)' });
        restLeaves();
        return;
      }
      const target = core.neighbor(index, r.dir, LAST);
      const to = commit ? 1 : 0;
      const duration = core.settleDuration(Math.abs(to - r.progress), Math.abs(v));
      if (commit) bus.emit('turn:start', { dir: r.dir, from: index, to: target, source: 'drag', velocity: Math.abs(v) });
      animate(r.dir, r.progress, to, duration, commit, target);
    },
    onTap({ zone, x, y }) {
      if (zone === 'next') { ripple(x, y); step('next', 'tap'); }
      else if (zone === 'prev') { ripple(x, y); step('prev', 'tap'); }
      else bus.emit('tap:center', {});
    },
    onDoubleTap({ x, y }) { toggleZoom(x, y); },
    onSwipeUp() { bus.emit('swipe:up', {}); },
    onPinchStart() { pinchBase = { ...zoom }; geom = bookGeom(); zoomEl.classList.remove('animating'); },
    onPinch({ ratio, cx, cy, startCx, startCy }) {
      if (!pinchBase) return;
      const z = core.zoomAt(pinchBase, pinchBase.scale * ratio, startCx - geom.cx, startCy - geom.cy, geom.w, geom.h);
      const pan = core.clampPan(z.x + (cx - startCx), z.y + (cy - startCy), z.scale, geom.w, geom.h);
      zoom = { scale: z.scale, x: pan.x, y: pan.y };
      applyZoom(false);
    },
    onPinchEnd() { pinchBase = null; geom = null; if (zoom.scale < 1.05) resetZoom(true); },
    onPan({ dx, dy }) {
      const g = geom || bookGeom();
      const p = core.clampPan(zoom.x + dx, zoom.y + dy, zoom.scale, g.w, g.h);
      zoom = { ...zoom, x: p.x, y: p.y };
      applyZoom(false);
    },
    onPanEnd() { geom = null; },
    onWheel(e) {
      if (e.kind === 'turn') step(e.dir, 'wheel');
      else if (e.kind === 'zoom') zoomTo(zoom.scale * Math.exp(e.delta * 0.01), e.x, e.y, false);
      else if (e.kind === 'pan') {
        const g = bookGeom();
        const p = core.clampPan(zoom.x + e.dx, zoom.y + e.dy, zoom.scale, g.w, g.h);
        zoom = { ...zoom, x: p.x, y: p.y };
        applyZoom(false);
      }
    }
  };

  // ---------- public API ----------
  RCB.reader = {
    init(refs) {
      ({ stage, book, zoomEl, ripples, live, backdrop } = refs);
      const make = (el) => ({ el, img: el.querySelector('img'), src: null });
      leaves = { prev: make(refs.leaves.prev), cur: make(refs.leaves.cur), next: make(refs.leaves.next) };
      Object.values(leaves).forEach((l) => {
        l.img.addEventListener('load', () => l.el.classList.remove('loading'));
        l.img.addEventListener('error', () => { l.el.classList.remove('loading'); if (l.img.getAttribute('src')) l.el.classList.add('broken'); });
        l.img.draggable = false;
      });
      gestures = RCB.createGestures(stage, handlers);
      restLeaves();
      let lastW = window.innerWidth;
      window.addEventListener('resize', () => {
        if (window.innerWidth !== lastW) { lastW = window.innerWidth; resetZoom(false); }
      });
      refreshLeaves();
      setBackdrop(index);
    },
    /** Jump without animation (used when restoring the reading position). */
    jump(target) {
      finishAnim();
      resetZoom(false);
      index = core.clamp(target, 0, LAST);
      restLeaves();
      refreshLeaves();
      setBackdrop(index);
      live.textContent = core.chapterAnnouncement(index, data.TOTAL_PAGES);
      bus.emit('change', { index, from: index, dir: 'none', page: pages[index], coverIdx });
    },
    goTo,
    next: () => step('next', 'ui'),
    prev: () => step('prev', 'ui'),
    toggleZoom,
    resetZoom,
    swapCover() {
      if (swapping) return;
      coverIdx = (coverIdx + 1) % coverVariants.length;
      prefetched.clear();
      const apply = () => { refreshLeaves(); setBackdrop(index); };
      if (index === 0 && !reduced() && !anim && !drag) {
        swapping = true;
        const el = leaves.cur.el;
        el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.97) rotateY(10deg)' }], { duration: 150, fill: 'forwards' }).finished
          .then(() => {
            apply();
            return el.animate([{ opacity: 0, transform: 'scale(.97) rotateY(-10deg)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' }).finished;
          })
          .catch(() => { /* cancelled by a newer animation: the final state is applied in finally */ })
          .finally(() => { apply(); el.getAnimations().forEach((a) => a.cancel()); swapping = false; });
      } else {
        apply();
      }
      bus.emit('cover', { coverIdx, variant: coverVariants[coverIdx] });
    },
    get index() { return index; },
    get coverIdx() { return coverIdx; },
    get zoomed() { return isZoomed(); },
    get busy() { return !!anim || !!drag; },
    srcFor,
    thumbFor
  };
})();
