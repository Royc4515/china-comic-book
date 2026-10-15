/* Pointer-event gesture recogniser for the reading stage (touch, mouse and pen share one path).
   It only classifies input and reports raw deltas; the reader decides what they mean.
     horizontal drag  -> onDragStart / onDrag / onDragEnd   (page turn)
     vertical up-drag -> onSwipeUp
     two fingers      -> onPinchStart / onPinch / onPinchEnd
     one finger, zoomed -> onPan
     tap / double-tap -> onTap / onDoubleTap
     wheel / trackpad pinch -> onWheel */
(function () {
  'use strict';
  const RCB = (window.RCB = window.RCB || {});
  const core = RCB.core;

  const SLOP = 9;              // px of movement before a touch becomes a gesture
  const TAP_MAX_MS = 350;
  const DOUBLE_TAP_MS = 290;
  const DOUBLE_TAP_DIST = 36;
  const SWIPE_UP_MIN = 70;

  RCB.createGestures = function createGestures(el, h) {
    const pointers = new Map();
    const velocity = core.createVelocityTracker(90);
    let mode = 'idle';           // idle | pending | drag | pan | pinch | swipeup | ignored
    let start = null;            // {x, y, t}
    let last = null;             // last single-pointer position (for pan deltas)
    let pinch = null;            // {dist, cx, cy, lastCx, lastCy}
    let lastTap = null;          // {x, y, t}
    let tapTimer = 0;
    let wheelLock = 0;
    let dragDx = 0;              // latest horizontal drag offset, kept for mid-drag cancellation

    const rect = () => el.getBoundingClientRect();
    const zoomed = () => h.isZoomed();

    function clearTapTimer() {
      if (tapTimer) { clearTimeout(tapTimer); tapTimer = 0; }
    }

    function beginPinch() {
      const [a, b] = [...pointers.values()];
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx, cy, lastCx: cx, lastCy: cy };
      mode = 'pinch';
      h.onPinchStart({ cx, cy });
    }

    function onDown(e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      clearTapTimer();
      if (pointers.size === 1) {
        mode = 'pending';
        start = { x: e.clientX, y: e.clientY, t: e.timeStamp };
        last = { x: e.clientX, y: e.clientY };
        velocity.reset();
        h.onTouchDown();
      } else if (pointers.size === 2) {
        if (mode === 'drag') h.onDragEnd({ dx: dragDx, vp: 0, cancelled: true });
        beginPinch();
      }
    }

    function onMove(e) {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX;
      p.y = e.clientY;

      if (mode === 'pinch' && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;
        h.onPinch({ ratio: Math.hypot(a.x - b.x, a.y - b.y) / pinch.dist, cx, cy, dcx: cx - pinch.lastCx, dcy: cy - pinch.lastCy, startCx: pinch.cx, startCy: pinch.cy });
        pinch.lastCx = cx;
        pinch.lastCy = cy;
        return;
      }
      if (pointers.size !== 1) return;

      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;

      if (mode === 'pending') {
        if (Math.hypot(dx, dy) < SLOP) return;
        if (zoomed()) mode = 'pan';
        else if (Math.abs(dx) >= Math.abs(dy)) { mode = 'drag'; dragDx = 0; h.onDragStart(); }
        else if (dy < 0) mode = 'swipeup';
        else mode = 'ignored';
      }

      if (mode === 'drag') {
        const w = rect().width;
        velocity.add(e.timeStamp, dx / (w * 0.85));
        dragDx = dx;
        h.onDrag({ dx });
      } else if (mode === 'pan') {
        h.onPan({ dx: e.clientX - last.x, dy: e.clientY - last.y });
      }
      last = { x: e.clientX, y: e.clientY };
    }

    function onUp(e) {
      const p = pointers.get(e.pointerId);
      if (!p) return;
      pointers.delete(e.pointerId);
      try { el.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ }
      const cancelled = e.type === 'pointercancel';

      if (mode === 'pinch') {
        if (pointers.size < 2) {
          h.onPinchEnd();
          pinch = null;
          const rest = [...pointers.values()][0];
          if (rest && zoomed()) { mode = 'pan'; last = { x: rest.x, y: rest.y }; } else { mode = pointers.size ? 'ignored' : 'idle'; }
        }
        return;
      }
      if (pointers.size > 0) return;

      const dx = cancelled && mode === 'drag' ? dragDx : e.clientX - start.x;
      const dy = e.clientY - start.y;
      const dt = e.timeStamp - start.t;

      if (mode === 'drag') {
        // sample the release itself, so a finger that rested before lifting reads as ~0 velocity, not a stale flick
        velocity.add(e.timeStamp, dx / (rect().width * 0.85));
        h.onDragEnd({ dx, vp: velocity.velocity(), cancelled });
      } else if (mode === 'pan') {
        h.onPanEnd();
      } else if (mode === 'swipeup') {
        if (!cancelled && dy < -SWIPE_UP_MIN) h.onSwipeUp();
      } else if (mode === 'pending' && !cancelled && dt < TAP_MAX_MS) {
        handleTap(e.clientX, e.clientY, e.timeStamp);
      }
      mode = 'idle';
    }

    function handleTap(x, y, t) {
      const isDouble = lastTap && t - lastTap.t < DOUBLE_TAP_MS && Math.hypot(x - lastTap.x, y - lastTap.y) < DOUBLE_TAP_DIST;
      if (isDouble) {
        lastTap = null;
        clearTapTimer();
        h.onDoubleTap({ x, y });
        return;
      }
      const r = rect();
      const zone = zoomed() ? 'center' : core.tapZone(x - r.left, r.width, false);
      // only centre taps can start a double-tap; side taps stay free to flip page after page
      lastTap = zone === 'center' ? { x, y, t } : null;
      if (zone === 'center') {
        // wait out the double-tap window before treating it as a single tap
        tapTimer = setTimeout(() => { tapTimer = 0; h.onTap({ zone, x, y }); }, DOUBLE_TAP_MS);
      } else {
        h.onTap({ zone, x, y });
      }
    }

    function onWheel(e) {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        h.onWheel({ kind: 'zoom', delta: -e.deltaY, x: e.clientX, y: e.clientY });
      } else if (zoomed()) {
        h.onWheel({ kind: 'pan', dx: -e.deltaX, dy: -e.deltaY });
      } else {
        const now = e.timeStamp;
        const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (now - wheelLock > 480 && Math.abs(d) > 12) {
          wheelLock = now;
          // scrolling down/right = forward
          h.onWheel({ kind: 'turn', dir: d > 0 ? 'next' : 'prev' });
        }
      }
    }

    const stopDefault = (e) => e.preventDefault();

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('contextmenu', stopDefault);
    // Safari's proprietary pinch events would otherwise zoom the whole page
    el.addEventListener('gesturestart', stopDefault);
    el.addEventListener('gesturechange', stopDefault);

    return {
      cancelPending: clearTapTimer,
      destroy() {
        clearTapTimer();
        el.removeEventListener('pointerdown', onDown);
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerup', onUp);
        el.removeEventListener('pointercancel', onUp);
        el.removeEventListener('wheel', onWheel);
        el.removeEventListener('contextmenu', stopDefault);
        el.removeEventListener('gesturestart', stopDefault);
        el.removeEventListener('gesturechange', stopDefault);
      }
    };
  };
})();
