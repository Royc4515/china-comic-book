/* Live audio controller: autoplay unlock, sound modes, tab-visibility handling.
   Modes: 'full' (effects + ambience), 'fx' (effects only), 'off'. Safe to call before unlock. */
(function () {
  'use strict';
  const RCB = (window.RCB = window.RCB || {});

  let ctx = null;
  let engine = null;
  let mode = 'off';
  let wantedBed = null;
  let wantedTrack = null;
  let musicOn = false;
  let music = null;
  // With music playing, only non-tonal beds stay: the synth pads would fight the recorded melody.
  const TEXTURE_BEDS = new Set(['wind', 'city', 'train']);
  let warned = false;

  const warnOnce = (err) => {
    if (warned) return;
    warned = true;
    console.warn('Audio unavailable:', err && err.message ? err.message : err);
  };

  function applyLevels() {
    if (engine) engine.setLevels({ sfx: mode !== 'off', ambience: mode === 'full' });
  }

  /** Ambience only runs in 'full' mode; otherwise the bed graph is torn down, not just muted. */
  function syncBed() {
    if (!engine) return;
    const musicPlaying = musicOn && mode !== 'off';
    const kind = mode === 'full' && (!musicPlaying || TEXTURE_BEDS.has(wantedBed)) ? wantedBed : null;
    try { engine.setBed(kind); } catch (err) { warnOnce(err); }
  }

  function syncMusic() {
    if (!music) return;
    try {
      music.setTrack(wantedTrack);
      music.setEnabled(musicOn && mode !== 'off');
    } catch (err) { warnOnce(err); }
  }

  function ensure() {
    if (engine) return true;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor || !RCB.createAudioEngine) return false;
    try {
      ctx = new Ctor({ latencyHint: 'interactive' });
      engine = RCB.createAudioEngine(ctx);
      music = RCB.createMusic ? RCB.createMusic(ctx, engine.nodes.master) : null;
      applyLevels();
      syncBed();
      syncMusic();
      return true;
    } catch (err) {
      warnOnce(err);
      return false;
    }
  }

  function guard(fn) {
    return (...args) => {
      if (mode === 'off' || !engine || !ctx || ctx.state !== 'running') return;
      try { fn(...args); } catch (err) { warnOnce(err); }
    };
  }

  const audio = {
    get mode() { return mode; },
    get unlocked() { return !!ctx && ctx.state === 'running'; },
    /** Diagnostics for tests and bug reports. */
    status() { return { mode, ctx: ctx && ctx.state, bed: wantedBed, track: wantedTrack, musicOn, music: music && music.status() }; },

    /** Must be called from inside a user gesture (tap) the first time. */
    unlock({ explicit = false } = {}) {
      if (mode === 'off' || !ensure()) return Promise.resolve(false);
      // 'ambient' lets the listener's own music keep playing and honours the silent switch
      if (explicit && navigator.audioSession) {
        try { navigator.audioSession.type = 'ambient'; } catch (err) { warnOnce(err); }
      }
      return ctx.state === 'running' ? Promise.resolve(true) : ctx.resume().then(() => ctx.state === 'running', () => false);
    },

    setMode(next) {
      mode = next;
      if (mode === 'off') {
        if (engine) { applyLevels(); syncBed(); syncMusic(); }
        return;
      }
      if (engine) {
        applyLevels();
        syncBed();
        syncMusic();
        if (ctx.state === 'suspended') ctx.resume().catch(warnOnce);
      }
    },

    setBed(kind) {
      wantedBed = kind;
      syncBed();
    },

    /** Chapter mood -> which track plays (crossfaded; same track keeps playing across pages). */
    setTrack(id) {
      wantedTrack = id;
      syncMusic();
    },

    setMusic(on) {
      musicOn = !!on;
      syncBed();
      syncMusic();
    },

    turn: guard((opts) => engine.sfx.turn(opts)),
    land: guard((opts) => engine.sfx.land(opts)),
    bump: guard(() => engine.sfx.bump()),
    tap: guard(() => engine.sfx.tap()),
    tick: guard(() => engine.sfx.tick()),
    zoom: guard((zoomIn) => engine.sfx.zoom(zoomIn)),
    chime: guard((index) => engine.sfx.chime(index)),
    open: guard(() => engine.sfx.open()),
    cover: guard(() => engine.sfx.cover())
  };

  // iOS can leave the context suspended/interrupted (call, Siri, resume outside a gesture): retry on the next touch.
  document.addEventListener('pointerdown', () => {
    if (ctx && mode !== 'off' && ctx.state !== 'running' && !document.hidden) ctx.resume().catch(warnOnce);
  }, { capture: true, passive: true });

  // Silence the app when it is backgrounded; pick up again when it returns.
  document.addEventListener('visibilitychange', () => {
    if (!ctx || mode === 'off') return;
    if (document.hidden) ctx.suspend().catch(warnOnce);
    else ctx.resume().catch(warnOnce);
  });

  RCB.audio = audio;
})();
