/* Pure, DOM-free helpers: gesture maths, zoom, page-flip geometry.
   Classic script in the browser (window.RCB.core) and require()/import in node tests. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.RCB = root.RCB || {};
    root.RCB.core = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const MAX_FLIP_ANGLE = 96;       // a leaf swings a little past edge-on, then is hidden
  const COMMIT_PROGRESS = 0.4;     // drag this far and the page completes on release
  const FLING_VELOCITY = 0.0007;   // progress-units per ms that counts as a flick
  const MIN_FLING_PROGRESS = 0.05; // ignore twitches
  const DRAG_REACH = 0.85;         // fraction of page width for a full turn
  const EDGE_RUBBER_LIMIT = 0.14;  // how far a blocked edge can be pulled
  const SIDE_ZONE = 0.28;          // tap zones: 28% | 44% | 28%
  const SOUND_MODES = ['full', 'fx', 'off'];

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  /** Index of the page next to `index`, or null past either end. Pages run 0 (cover) .. last. */
  function neighbor(index, dir, last) {
    const n = dir === 'next' ? index + 1 : index - 1;
    return n < 0 || n > last ? null : n;
  }

  /** iOS-style resistance: grows quickly then flattens towards `limit`. */
  function rubberBand(x, limit) {
    if (x <= 0) return 0;
    return (1 - 1 / ((x * 0.55) / limit + 1)) * limit;
  }

  /** Map a horizontal drag to a page turn. Left-to-right book: dragging left (right edge towards the spine) goes forward. */
  function dragToTurn(dx, width, index, last) {
    const dir = dx < 0 ? 'next' : 'prev';
    const raw = Math.abs(dx) / (width * DRAG_REACH);
    const blocked = neighbor(index, dir, last) === null;
    const progress = blocked ? rubberBand(raw, EDGE_RUBBER_LIMIT) : Math.min(raw, 1);
    return { dir, progress, blocked };
  }

  /** Decide on release. `velocity` is progress-units/ms, positive = still turning. */
  function shouldCommit(progress, velocity, blocked) {
    if (blocked) return false;
    if (velocity <= -FLING_VELOCITY) return false;
    if (velocity >= FLING_VELOCITY && progress >= MIN_FLING_PROGRESS) return true;
    return progress >= COMMIT_PROGRESS;
  }

  /** Milliseconds for the settle animation: quicker when the finger was quicker. */
  function settleDuration(distance, velocity) {
    return clamp(distance / Math.max(Math.abs(velocity), 0.0015), 160, 520);
  }

  const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

  /** Keep a zoomed page from being dragged off-screen. Coordinates are relative to centre. */
  function clampPan(x, y, scale, w, h) {
    const mx = Math.max(0, (w * scale - w) / 2);
    const my = Math.max(0, (h * scale - h) / 2);
    return { x: clamp(x, -mx, mx) || 0, y: clamp(y, -my, my) || 0 };
  }

  /** Zoom about a focal point (relative to the page centre) so the content under it stays put. */
  function zoomAt(state, nextScale, fx, fy, w, h, min = 1, max = 4) {
    const scale = clamp(nextScale, min, max);
    if (scale <= min) return { scale: min, x: 0, y: 0 };
    const k = scale / state.scale;
    const x = fx - (fx - state.x) * k;
    const y = fy - (fy - state.y) * k;
    return { scale, ...clampPan(x, y, scale, w, h) };
  }

  /** Pixel offset (from the track's left edge) of a range thumb's centre. */
  function thumbFraction(value, min, max, rtl, trackW, thumbW) {
    const span = max - min || 1;
    let frac = (value - min) / span;
    if (rtl) frac = 1 - frac;
    return thumbW / 2 + frac * (trackW - thumbW);
  }

  /** Visual parameters for a leaf that is `progress` (0..1) of the way over the spine. */
  function flipGeometry(progress) {
    const p = clamp(progress, 0, 1);
    const angle = p * MAX_FLIP_ANGLE;
    const edgePct = clamp((1 - Math.cos((angle * Math.PI) / 180)) * 100, 0, 100);
    return {
      angle,
      edgePct,
      curShade: clamp(p * 0.55, 0, 1),        // the turning leaf darkens as it tilts away
      nextShade: clamp(0.5 * (1 - p), 0, 1),  // the page underneath brightens as it is revealed
      highlight: Math.sin(Math.PI * p)        // specular sweep peaks mid-turn
    };
  }

  function nextSoundMode(mode) {
    const i = SOUND_MODES.indexOf(mode);
    return SOUND_MODES[(i + 1) % SOUND_MODES.length] || 'full';
  }

  /** Slope of a value over the last `windowMs` of samples (units per ms). */
  function createVelocityTracker(windowMs = 90) {
    let samples = [];
    return {
      add(t, v) {
        samples.push({ t, v });
        const cutoff = t - windowMs;
        while (samples.length > 2 && samples[0].t < cutoff) samples.shift();
        if (samples.length === 2 && samples[0].t < cutoff) samples.shift();
      },
      velocity() {
        if (samples.length < 2) return 0;
        const a = samples[0];
        const b = samples[samples.length - 1];
        const dt = b.t - a.t;
        return dt > 0 ? (b.v - a.v) / dt : 0;
      },
      reset() { samples = []; }
    };
  }

  /** Which part of the stage was tapped. In a left-to-right book the right side is "next". */
  function tapZone(x, width, rtl) {
    const f = x / width;
    if (f < SIDE_ZONE) return rtl ? 'next' : 'prev';
    if (f > 1 - SIDE_ZONE) return rtl ? 'prev' : 'next';
    return 'center';
  }

  /** '#f5a524' -> '245,165,36' (usable inside rgba()); falls back to the default gold. */
  function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex));
    if (!m) return '245,165,36';
    const n = parseInt(m[1], 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  }

  /** Screen-reader text announced when the page changes. */
  function chapterAnnouncement(index, total) {
    return index === 0 ? 'עמוד השער' : `עמוד ${index} מתוך ${total}`;
  }

  return {
    MAX_FLIP_ANGLE, COMMIT_PROGRESS, FLING_VELOCITY,
    clamp, neighbor, rubberBand, dragToTurn, shouldCommit, settleDuration, easeOutCubic,
    clampPan, zoomAt, thumbFraction, flipGeometry, nextSoundMode, createVelocityTracker,
    tapZone, chapterAnnouncement, hexToRgb
  };
});
