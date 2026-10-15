/* Visual effects: chapter-themed particles on a canvas, plus tilt/sheen driven by pointer or gyroscope.
   Particles use cached glow sprites (no per-frame gradients) and scale down if frames get slow. */
(function () {
  'use strict';
  const RCB = (window.RCB = window.RCB || {});
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // Each preset is a list of layers; `accent` is substituted for the chapter colour.
  const PRESETS = {
    dust: [{ n: 44, kind: 'glow', colors: ['accent', '#fff1c9'], r: [1.4, 3.4], vx: [-5, 5], vy: [-20, -7], a: [0.3, 0.85], life: [5, 10], soft: 0.45, sway: 10 }],
    lanterns: [
      { n: 11, kind: 'glow', colors: ['#ff5a36', '#ff9a3c', '#ffd07a'], r: [11, 24], vx: [-6, 6], vy: [-24, -9], a: [0.35, 0.8], life: [9, 16], soft: 0.85, sway: 16 },
      { n: 22, kind: 'glow', colors: ['accent', '#fff1c9'], r: [1.2, 2.8], vx: [-5, 5], vy: [-18, -6], a: [0.3, 0.8], life: [5, 9], soft: 0.45, sway: 8 }
    ],
    bokeh: [{ n: 20, kind: 'glow', colors: ['accent', '#38bdf8', '#fff1c9', '#fb7185'], r: [12, 40], vx: [-9, 9], vy: [-7, 3], a: [0.07, 0.2], life: [8, 15], soft: 0.9, sway: 12 }],
    snow: [{ n: 64, kind: 'glow', colors: ['#ffffff', '#dff3ff'], r: [1, 3], vx: [-10, 10], vy: [24, 62], a: [0.4, 0.95], life: [7, 14], soft: 0.5, sway: 22, fall: true }],
    embers: [{ n: 38, kind: 'glow', colors: ['#ffb347', '#ff7a2f', 'accent'], r: [1.2, 3.4], vx: [-8, 8], vy: [-46, -16], a: [0.4, 1], life: [2.5, 6], soft: 0.5, sway: 14, flicker: true }],
    streaks: [{ n: 24, kind: 'streak', colors: ['#ffffff', 'accent'], len: [60, 190], vx: [-1500, -750], a: [0.07, 0.22], life: [1.4, 3.2] }],
    mist: [
      { n: 8, kind: 'glow', colors: ['#e2f5ee', '#cfe9f2'], r: [130, 270], vx: [8, 22], vy: [-1.5, 1.5], a: [0.05, 0.1], life: [14, 24], soft: 1, sway: 6 },
      { n: 12, kind: 'glow', colors: ['#b7ffc9', '#eaff9a'], r: [1.4, 3], vx: [-8, 8], vy: [-10, 4], a: [0.4, 1], life: [4, 8], soft: 0.5, sway: 16, flicker: true }
    ],
    neon: [{ n: 26, kind: 'glow', colors: ['#e879f9', '#22d3ee', '#818cf8', 'accent'], r: [10, 36], vx: [-12, 12], vy: [-9, 5], a: [0.1, 0.26], life: [6, 12], soft: 0.9, sway: 14, flicker: true }]
  };

  const hexToRgb = (hex) => RCB.core.hexToRgb(hex);

  const spriteCache = new Map();
  function sprite(rgb, soft) {
    const key = `${rgb}|${soft}`;
    let c = spriteCache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, `rgba(${rgb},1)`);
    grad.addColorStop(clamp(1 - soft, 0.05, 0.95) * 0.6, `rgba(${rgb},${0.7 - soft * 0.3})`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    spriteCache.set(key, c);
    return c;
  }

  const state = {
    canvas: null, ctx: null, w: 0, h: 0, dpr: 1,
    particles: [], layers: [], accentRgb: '245,165,36',
    particlesOn: true, reduced: false, running: false, last: 0, quality: 1, slow: 0,
    changedAt: 0,
    tiltOn: true, tiltEl: null, tilt: { x: 0, y: 0, tx: 0, ty: 0 }, base: null, tiltActive: true, orientationOn: false
  };

  function colorFor(layer, accentRgb) {
    const c = pick(layer.colors);
    return c === 'accent' ? accentRgb : hexToRgb(c);
  }

  function spawn(layer, initial) {
    const w = state.w, h = state.h;
    const life = rand(layer.life[0], layer.life[1]);
    const p = {
      layer, life, age: initial ? rand(0, life) : 0, rgb: colorFor(layer, state.accentRgb),
      a: rand(layer.a[0], layer.a[1]), phase: rand(0, Math.PI * 2), dying: false, fade: 1
    };
    if (layer.kind === 'streak') {
      p.x = initial ? rand(0, w) : w + 40;
      p.y = rand(0, h);
      p.vx = rand(layer.vx[0], layer.vx[1]);
      p.vy = 0;
      p.len = rand(layer.len[0], layer.len[1]);
      return p;
    }
    p.r = rand(layer.r[0], layer.r[1]);
    p.vx = rand(layer.vx[0], layer.vx[1]);
    p.vy = rand(layer.vy[0], layer.vy[1]);
    p.x = rand(-20, w + 20);
    p.y = initial ? rand(0, h) : layer.fall ? -p.r - 10 : h + p.r + 10;
    return p;
  }

  function resize() {
    const c = state.canvas;
    if (!c) return;
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.w = window.innerWidth;
    state.h = window.innerHeight;
    c.width = Math.round(state.w * state.dpr);
    c.height = Math.round(state.h * state.dpr);
    state.ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  }

  function liveCount(layer) {
    let n = 0;
    for (const p of state.particles) if (p.layer === layer && !p.dying) n++;
    return n;
  }

  function step(now) {
    if (!state.running) return;
    requestAnimationFrame(step);
    const dt = Math.min((now - state.last) / 1000, 0.05);
    state.last = now;
    if (document.hidden) return;

    // adaptive quality: if we are consistently slower than ~35fps, thin the crowd
    state.slow = dt > 0.028 ? state.slow + 1 : Math.max(0, state.slow - 1);
    if (state.slow > 50 && state.quality > 0.35) { state.quality -= 0.2; state.slow = 0; }

    updateTilt(dt);
    if (!state.particlesOn || state.reduced && !state.forceMotion) {
      if (state.particles.length) { state.particles.length = 0; state.ctx.clearRect(0, 0, state.w, state.h); }
      return;
    }

    const { ctx, w, h } = state;
    ctx.clearRect(0, 0, w, h);

    // top-up each active layer gradually so a chapter change fades the new style in
    const sinceChange = (now - state.changedAt) / 1000;
    for (const layer of state.layers) {
      const target = Math.round(layer.n * state.quality);
      const have = liveCount(layer);
      if (have < target) {
        const burst = Math.min(target - have, Math.max(1, Math.round(dt * 30)));
        for (let i = 0; i < burst; i++) state.particles.push(spawn(layer, sinceChange < 0.05));
      }
    }

    ctx.globalCompositeOperation = 'lighter';
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      const L = p.layer;
      p.age += dt;
      if (p.dying) p.fade -= dt * 1.4;
      if (p.age >= p.life || p.fade <= 0) {
        state.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt + (L.sway ? Math.sin(p.age * 0.9 + p.phase) * L.sway * dt : 0);
      p.y += p.vy * dt;
      if (L.kind === 'glow' && (p.y < -p.r - 30 || p.y > h + p.r + 30 || p.x < -p.r - 60 || p.x > w + p.r + 60)) {
        p.age = p.life; // leaves the screen: retire it
        continue;
      }
      const t = p.age / p.life;
      let env = Math.pow(Math.sin(Math.PI * t), 0.7);
      if (L.flicker) env *= 0.65 + 0.35 * Math.sin(p.age * 7 + p.phase);
      const alpha = p.a * env * (p.dying ? Math.max(p.fade, 0) : 1);
      if (alpha < 0.005) continue;
      ctx.globalAlpha = alpha;
      if (L.kind === 'streak') {
        const g = ctx.createLinearGradient(p.x, p.y, p.x - p.vx / Math.abs(p.vx) * p.len, p.y);
        g.addColorStop(0, `rgba(${p.rgb},1)`);
        g.addColorStop(1, `rgba(${p.rgb},0)`);
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - Math.sign(p.vx) * p.len, p.y);
        ctx.stroke();
      } else {
        const s = sprite(p.rgb, L.soft);
        ctx.drawImage(s, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------- tilt / sheen ----------
  function updateTilt(dt) {
    const t = state.tilt;
    const el = state.tiltEl;
    if (!el) return;
    const active = state.tiltOn && state.tiltActive && (!state.reduced || state.forceMotion);
    const tx = active ? t.tx : 0;
    const ty = active ? t.ty : 0;
    const k = 1 - Math.pow(0.001, dt); // frame-rate independent smoothing
    const nx = t.x + (tx - t.x) * k;
    const ny = t.y + (ty - t.y) * k;
    if (Math.abs(nx - t.x) < 0.0004 && Math.abs(ny - t.y) < 0.0004) return;
    t.x = nx;
    t.y = ny;
    el.style.setProperty('--tilt-x', nx.toFixed(4));
    el.style.setProperty('--tilt-y', ny.toFixed(4));
  }

  function onPointerMove(e) {
    if (e.pointerType !== 'mouse') return;
    state.tilt.tx = clamp((e.clientX / window.innerWidth - 0.5) * 2, -1, 1);
    state.tilt.ty = clamp((e.clientY / window.innerHeight - 0.5) * 2, -1, 1);
  }

  function onOrientation(e) {
    if (e.gamma == null || e.beta == null) return;
    if (!state.base) state.base = { g: e.gamma, b: e.beta };
    state.base.g += (e.gamma - state.base.g) * 0.01; // slowly re-centre as the phone settles in the hand
    state.base.b += (e.beta - state.base.b) * 0.01;
    state.tilt.tx = clamp((e.gamma - state.base.g) / 22, -1, 1);
    state.tilt.ty = clamp((e.beta - state.base.b) / 22, -1, 1);
  }

  const fx = {
    init(canvas, tiltEl) {
      state.canvas = canvas;
      state.ctx = canvas.getContext('2d');
      state.tiltEl = tiltEl;
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      state.reduced = mq.matches;
      mq.addEventListener('change', (e) => { state.reduced = e.matches; });
      // weak devices start with a thinner crowd
      if ((navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 4) <= 2) state.quality = 0.6;
      resize();
      window.addEventListener('resize', resize);
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      state.running = true;
      state.last = performance.now();
      requestAnimationFrame(step);
    },
    setPreset(name, accent) {
      state.accentRgb = hexToRgb(accent);
      const layers = PRESETS[name] || PRESETS.dust;
      if (layers === state.layers) return;
      state.layers = layers;
      state.changedAt = performance.now();
      state.particles.forEach((p) => { if (!layers.includes(p.layer)) p.dying = true; });
    },
    setParticles(on) { state.particlesOn = !!on; if (on) state.forceMotion = state.reduced; },
    setTilt(on) { state.tiltOn = !!on; if (on) state.forceMotion = state.reduced; },
    setTiltActive(on) { state.tiltActive = !!on; },
    get reducedMotion() { return state.reduced; },
    /** iOS needs an explicit permission prompt from a user gesture; Android just works. */
    enableOrientation() {
      if (state.orientationOn) return Promise.resolve(true);
      const DOE = window.DeviceOrientationEvent;
      if (!DOE) return Promise.resolve(false);
      const attach = () => {
        window.addEventListener('deviceorientation', onOrientation, { passive: true });
        state.orientationOn = true;
        return true;
      };
      if (typeof DOE.requestPermission === 'function') {
        return DOE.requestPermission().then((r) => (r === 'granted' ? attach() : false), () => false);
      }
      return Promise.resolve(attach());
    },
    get needsOrientationPermission() {
      return !!(window.DeviceOrientationEvent && typeof window.DeviceOrientationEvent.requestPermission === 'function');
    }
  };

  RCB.fx = fx;
})();
