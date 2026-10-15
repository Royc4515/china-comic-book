/* Background music: two streamed tracks routed through the shared AudioContext (so iOS volume, suspend and
   mute all behave), crossfaded when the chapter's mood changes. Tracks keep their position when switched away. */
(function () {
  'use strict';
  const RCB = (window.RCB = window.RCB || {});

  const TRACKS = {
    asia: 'assets/music/asia.mp3',
    sunrise: 'assets/music/sunrise.mp3'
  };
  const LEVEL = 0.16;         // both files measure about -14.7 dB RMS; this lands them near -30 dB, under the effects
  const CROSSFADE_S = 2.6;

  RCB.createMusic = function createMusic(ctx, destination) {
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(destination);

    const voices = {};
    let current = null;
    let enabled = false;
    let primed = false;

    function voice(id) {
      if (voices[id]) return voices[id];
      const el = new Audio();
      el.preload = 'auto';
      el.src = TRACKS[id];
      // the files carry their own fade in/out, so restarting at the end loops without a click
      el.addEventListener('ended', () => {
        el.currentTime = 0;
        if (enabled && current === id) el.play().catch(() => {});
      });
      const src = ctx.createMediaElementSource(el);
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain);
      gain.connect(bus);
      voices[id] = { el, gain };
      return voices[id];
    }

    function fade(g, to, secs) {
      const t = ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(to, t + secs);
    }

    function start(id) {
      const v = voice(id);
      v.el.play().then(() => fade(v.gain, 1, CROSSFADE_S)).catch(() => { /* blocked until a gesture: retried on next call */ });
    }

    /** iOS only lets an <audio> element play after it has been started once inside a gesture. */
    function prime() {
      if (primed) return;
      primed = true;
      Object.keys(TRACKS).forEach((id) => {
        if (id === current) return;
        const v = voice(id);
        v.el.play().then(() => v.el.pause()).catch(() => { primed = false; });
      });
    }

    function stopOthers(keep) {
      Object.keys(voices).forEach((id) => {
        if (id === keep) return;
        const v = voices[id];
        fade(v.gain, 0, CROSSFADE_S);
        setTimeout(() => { if (current !== id || !enabled) v.el.pause(); }, CROSSFADE_S * 1000 + 200);
      });
    }

    document.addEventListener('visibilitychange', () => {
      Object.values(voices).forEach((v) => { if (document.hidden) v.el.pause(); });
      if (!document.hidden && enabled && current) start(current);
    });

    return {
      status() {
        const v = {};
        Object.keys(voices).forEach((id) => {
          v[id] = { paused: voices[id].el.paused, t: +voices[id].el.currentTime.toFixed(1), gain: +voices[id].gain.gain.value.toFixed(2) };
        });
        return { enabled, current, bus: +bus.gain.value.toFixed(2), voices: v };
      },
      get playing() { return enabled && !!current; },
      setTrack(id) {
        if (id === current) return;
        current = TRACKS[id] ? id : null;
        stopOthers(current);
        if (enabled && current) start(current);
      },
      setEnabled(on) {
        if (on === enabled) return;
        enabled = on;
        bus.gain.cancelScheduledValues(ctx.currentTime);
        bus.gain.setTargetAtTime(on ? LEVEL : 0, ctx.currentTime, 0.5);
        if (on) {
          prime();
          if (current) start(current);
        } else {
          setTimeout(() => { if (!enabled) Object.values(voices).forEach((v) => v.el.pause()); }, 1800);
        }
      }
    };
  };
})();
