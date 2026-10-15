/* Procedural sound: page-turn foley, UI ticks, pentatonic plucks, gong, and per-chapter ambience.
   Everything is synthesised (no audio files). `createAudioEngine(ctx)` works on any BaseAudioContext,
   so it can be rendered offline for level checks. */
(function () {
  'use strict';
  const RCB = (window.RCB = window.RCB || {});

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // C major pentatonic across two octaves (C D E G A C D E G)
  const PENTA = [60, 62, 64, 67, 69, 72, 74, 76, 79].map(mtof);
  const rand = (a, b) => a + Math.random() * (b - a);

  function makeNoise(ctx, seconds, colour) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (colour === 'pink') {
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      } else if (colour === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else {
        d[i] = w;
      }
    }
    return buf;
  }

  function makeImpulse(ctx, seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  function createAudioEngine(ctx) {
    const master = ctx.createGain();
    master.gain.value = 0.9;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -14;
    limiter.knee.value = 18;
    limiter.ratio.value = 5;
    limiter.attack.value = 0.004;
    limiter.release.value = 0.25;
    master.connect(limiter);
    limiter.connect(ctx.destination);

    const sfxBus = ctx.createGain();
    sfxBus.connect(master);
    const ambBus = ctx.createGain();
    ambBus.gain.value = 0;
    ambBus.connect(master);

    const reverb = ctx.createConvolver();
    reverb.buffer = makeImpulse(ctx, 1.9, 2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.38;
    reverb.connect(wet);
    wet.connect(master);
    const send = ctx.createGain();
    send.connect(reverb);

    const noise = { pink: makeNoise(ctx, 4, 'pink'), brown: makeNoise(ctx, 4, 'brown'), white: makeNoise(ctx, 2, 'white') };

    function noiseSource(kind, loop) {
      const s = ctx.createBufferSource();
      s.buffer = noise[kind];
      s.loop = !!loop;
      return s;
    }

    function panner(value) {
      if (!ctx.createStereoPanner) return null;
      const p = ctx.createStereoPanner();
      p.pan.value = value;
      return p;
    }

    /** Connects a node chain end to the destination bus, optionally via the reverb send. */
    function toBus(node, bus, reverbAmount) {
      node.connect(bus);
      if (reverbAmount) {
        const s = ctx.createGain();
        s.gain.value = reverbAmount;
        node.connect(s);
        s.connect(send);
      }
    }

    function burst({ t, dur, kind = 'pink', type = 'bandpass', f0, f1, q = 1, peak, attack = 0.01, pan0 = 0, pan1 = 0, bus = sfxBus }) {
      const src = noiseSource(kind, false);
      const flt = ctx.createBiquadFilter();
      flt.type = type;
      flt.Q.value = q;
      flt.frequency.setValueAtTime(f0, t);
      if (f1) flt.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(flt);
      flt.connect(g);
      const p = pan0 || pan1 ? panner(pan0) : null;
      if (p) {
        p.pan.linearRampToValueAtTime(pan1, t + dur);
        g.connect(p);
        p.connect(bus);
      } else {
        g.connect(bus);
      }
      src.start(t, rand(0, 1.5), dur + 0.05);
    }

    function thump({ t, f0, f1, dur, peak, bus = sfxBus }) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(bus);
      o.start(t);
      o.stop(t + dur + 0.05);
    }

    function pluck(freq, t, { vel = 0.5, dur = 1.8, wetAmt = 0.6, bus = sfxBus, pan = 0 } = {}) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(Math.min(freq * 9, 9000), t);
      lp.frequency.exponentialRampToValueAtTime(Math.max(freq * 1.6, 500), t + dur * 0.6);
      const out = ctx.createGain();
      out.gain.value = 0.34;
      [[1, 1, 'triangle'], [2, 0.3, 'sine'], [3, 0.13, 'sine'], [4.01, 0.05, 'sine']].forEach(([mult, amp, type], i) => {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = freq * mult;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(Math.max(amp * vel, 0.0002), t + 0.004);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur / (1 + i * 0.7));
        o.connect(g);
        g.connect(lp);
        o.start(t);
        o.stop(t + dur + 0.1);
      });
      lp.connect(out);
      const p = pan ? panner(pan) : null;
      if (p) { out.connect(p); toBus(p, bus, wetAmt); } else { toBus(out, bus, wetAmt); }
    }

    function gong(t, vel = 0.5) {
      [[1, 1, 3.2], [2.76, 0.5, 2.4], [5.4, 0.22, 1.6], [8.93, 0.1, 1.0]].forEach(([mult, amp, dec]) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = 98 * mult;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(amp * vel * 0.3, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
        o.connect(g);
        toBus(g, sfxBus, 0.5);
        o.start(t);
        o.stop(t + dec + 0.1);
      });
    }

    // ---------- one-shot effects ----------
    const sfx = {
      turn({ dir = 'next', intensity = 0.6 } = {}) {
        const t = ctx.currentTime;
        const s = dir === 'next' ? -1 : 1;
        burst({ t, dur: 0.3, f0: 650, f1: 2600, q: 0.7, peak: 1.5 * intensity, attack: 0.07, pan0: 0.5 * s, pan1: -0.45 * s });
        burst({ t: t + 0.04, dur: 0.22, type: 'highpass', f0: 3200, q: 0.5, peak: 0.3 * intensity, attack: 0.05, pan0: 0.5 * s, pan1: -0.45 * s });
        thump({ t, f0: 170, f1: 62, dur: 0.14, peak: 0.34 * intensity });
      },
      land({ intensity = 0.6 } = {}) {
        const t = ctx.currentTime;
        burst({ t, dur: 0.09, type: 'lowpass', f0: 1100, q: 0.7, peak: 0.9 * intensity, attack: 0.004 });
        thump({ t, f0: 110, f1: 55, dur: 0.12, peak: 0.3 * intensity });
      },
      bump() {
        const t = ctx.currentTime;
        thump({ t, f0: 90, f1: 48, dur: 0.16, peak: 0.5 });
        burst({ t, dur: 0.07, type: 'lowpass', f0: 600, q: 0.7, peak: 0.35, attack: 0.004 });
      },
      tap() {
        const t = ctx.currentTime;
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(700, t);
        o.frequency.exponentialRampToValueAtTime(520, t + 0.06);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.32, t + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
        o.connect(g);
        toBus(g, sfxBus, 0.18);
        o.start(t);
        o.stop(t + 0.12);
      },
      tick() {
        const t = ctx.currentTime;
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(2300, t);
        o.frequency.exponentialRampToValueAtTime(1500, t + 0.03);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.11, t + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
        o.connect(g);
        g.connect(sfxBus);
        o.start(t);
        o.stop(t + 0.05);
      },
      zoom(zoomIn) {
        const t = ctx.currentTime;
        burst({ t, dur: 0.3, f0: zoomIn ? 380 : 1900, f1: zoomIn ? 1900 : 380, q: 0.8, peak: 0.7, attack: 0.08 });
        pluck(zoomIn ? PENTA[4] : PENTA[2], t + 0.02, { vel: 0.18, dur: 0.6, wetAmt: 0.5 });
      },
      /** A small pentatonic arpeggio that depends on the chapter, so every page has its own motif. */
      chime(index) {
        const t = ctx.currentTime;
        const base = index % 5;
        [base, base + 2, base + 4].forEach((step, i) => {
          pluck(PENTA[step], t + i * 0.085, { vel: 0.36 - i * 0.05, dur: 1.7, pan: (i - 1) * 0.25 });
        });
      },
      open() {
        const t = ctx.currentTime;
        gong(t, 0.55);
        [0, 2, 4, 5, 7].forEach((step, i) => pluck(PENTA[step], t + 0.35 + i * 0.12, { vel: 0.42, dur: 2.2, pan: (i - 2) * 0.2 }));
      },
      cover() {
        const t = ctx.currentTime;
        pluck(PENTA[5], t, { vel: 0.35, dur: 1.2 });
        pluck(PENTA[7], t + 0.09, { vel: 0.28, dur: 1.2 });
      }
    };

    // ---------- ambience beds ----------
    function bedGraph() {
      const out = ctx.createGain();
      out.gain.value = 0;
      out.connect(ambBus);
      const timers = new Set();
      const stops = [];
      const track = (node) => { stops.push(node); return node; };
      // Timers never schedule audio while the context is suspended (tab hidden): that would queue a burst for resume.
      const every = (fn, ms) => { const id = setInterval(() => { if (ctx.state === 'running') fn(); }, ms); timers.add(id); return id; };
      const later = (fn, ms) => {
        const id = setTimeout(() => {
          timers.delete(id);
          if (ctx.state === 'running') fn(); else later(fn, 600);
        }, ms);
        timers.add(id);
        return id;
      };
      const dispose = () => {
        timers.forEach((id) => { clearInterval(id); clearTimeout(id); });
        timers.clear();
        stops.forEach((n) => { try { n.stop(); } catch (e) { /* already stopped */ } });
        out.disconnect();
      };
      return { out, track, every, later, dispose };
    }

    function lfo(g, rate, depth, target) {
      const o = ctx.createOscillator();
      o.frequency.value = rate;
      const d = ctx.createGain();
      d.gain.value = depth;
      o.connect(d);
      d.connect(target);
      o.start();
      g.track(o);
      return o;
    }

    function loopNoise(g, kind, filterType, freq, q, gain, lfoRate, lfoDepth) {
      const src = noiseSource(kind, true);
      const f = ctx.createBiquadFilter();
      f.type = filterType;
      f.frequency.value = freq;
      f.Q.value = q;
      const gn = ctx.createGain();
      gn.gain.value = gain;
      src.connect(f);
      f.connect(gn);
      gn.connect(g.out);
      src.start(0, rand(0, 2));
      g.track(src);
      if (lfoRate) lfo(g, lfoRate, lfoDepth, f.frequency);
      return gn;
    }

    function padVoice(g, freq, gain, cutoff, trem) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      o.detune.value = rand(-7, 7);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cutoff;
      const gn = ctx.createGain();
      gn.gain.value = gain;
      o.connect(f);
      f.connect(gn);
      toBus(gn, g.out, 0.5);
      o.start();
      g.track(o);
      if (trem) lfo(g, trem, gain * 0.5, gn.gain);
    }

    const beds = {
      wind(g) {
        loopNoise(g, 'pink', 'bandpass', 520, 0.7, 0.55, 0.07, 260);
        loopNoise(g, 'brown', 'lowpass', 190, 0.7, 0.35, 0.05, 40);
        loopNoise(g, 'pink', 'bandpass', 1500, 2.5, 0.04, 0.13, 500);
      },
      city(g) {
        loopNoise(g, 'brown', 'lowpass', 230, 0.7, 0.55, 0.04, 40);
        loopNoise(g, 'pink', 'bandpass', 1900, 0.5, 0.05, 0.09, 600);
        padVoice(g, mtof(50), 0.05, 500, 0.06);
      },
      train(g) {
        loopNoise(g, 'brown', 'lowpass', 170, 0.7, 0.6, 0.03, 30);
        loopNoise(g, 'pink', 'bandpass', 900, 0.8, 0.1);
        const clack = () => {
          const t = ctx.currentTime + 0.05;
          burst({ t, dur: 0.07, type: 'lowpass', f0: 520, q: 0.7, peak: 0.34, attack: 0.004, bus: g.out });
          thump({ t, f0: 82, f1: 50, dur: 0.09, peak: 0.28, bus: g.out });
        };
        g.every(() => { clack(); g.later(clack, 130); }, 460);
      },
      candle(g) {
        padVoice(g, mtof(45), 0.09, 600, 0.05);
        padVoice(g, mtof(52), 0.07, 700, 0.07);
        padVoice(g, mtof(57), 0.045, 800, 0.04);
        const crackle = () => {
          burst({ t: ctx.currentTime, dur: rand(0.01, 0.03), type: 'highpass', f0: rand(2200, 4200), q: 0.7, peak: rand(0.03, 0.12), attack: 0.002, bus: g.out });
          g.later(crackle, rand(70, 520));
        };
        crackle();
      },
      mist(g) {
        [43, 50, 55, 62].forEach((m, i) => padVoice(g, mtof(m), 0.09 - i * 0.012, 950, 0.05 + i * 0.013));
        loopNoise(g, 'pink', 'bandpass', 1300, 1.2, 0.035, 0.06, 400);
      },
      theme(g) {
        [50, 57, 64].forEach((m, i) => padVoice(g, mtof(m), 0.07 - i * 0.012, 1100, 0.04 + i * 0.02));
        const sparkle = () => {
          pluck(PENTA[Math.floor(rand(3, 9))], ctx.currentTime, { vel: 0.12, dur: 2.4, wetAmt: 0.9, bus: g.out, pan: rand(-0.6, 0.6) });
          g.later(sparkle, rand(2800, 6500));
        };
        g.later(sparkle, 1500);
      },
      jazz(g) {
        const chords = [
          { bass: 38, notes: [50, 53, 57, 60, 64] },   // Dm9
          { bass: 43, notes: [53, 55, 59, 62, 64] },   // G13
          { bass: 36, notes: [55, 59, 62, 64, 67] },   // Cmaj9
          { bass: 45, notes: [57, 60, 64, 67, 71] }    // Am9
        ];
        const beat = 60 / 54;
        let i = 0;
        const play = () => {
          const t = ctx.currentTime + 0.05;
          const c = chords[i++ % chords.length];
          c.notes.forEach((m, k) => {
            const f = mtof(m);
            [[1, 0.42, 2.6], [2, 0.14, 0.9]].forEach(([mult, amp, dec]) => {
              const o = ctx.createOscillator();
              o.type = 'sine';
              o.frequency.value = f * mult;
              const gn = ctx.createGain();
              const at = t + k * 0.018;
              gn.gain.setValueAtTime(0.0001, at);
              gn.gain.exponentialRampToValueAtTime(amp, at + 0.03);
              gn.gain.exponentialRampToValueAtTime(0.0001, at + beat * dec * 1.6);
              o.connect(gn);
              toBus(gn, g.out, 0.55);
              o.start(at);
              o.stop(at + beat * dec * 1.6 + 0.1);
            });
          });
          const bf = mtof(c.bass);
          const bo = ctx.createOscillator();
          bo.type = 'triangle';
          bo.frequency.value = bf;
          const bl = ctx.createBiquadFilter();
          bl.type = 'lowpass';
          bl.frequency.value = 320;
          const bg = ctx.createGain();
          bg.gain.setValueAtTime(0.0001, t);
          bg.gain.exponentialRampToValueAtTime(0.55, t + 0.03);
          bg.gain.exponentialRampToValueAtTime(0.0001, t + beat * 1.9);
          bo.connect(bl);
          bl.connect(bg);
          bg.connect(g.out);
          bo.start(t);
          bo.stop(t + beat * 2 + 0.1);
          // brushed shuffle on the off-beats
          for (let b = 0; b < 8; b++) {
            const bt = t + b * beat * 0.5 + (b % 2 ? beat * 0.17 : 0);
            burst({ t: bt, dur: 0.07, type: 'highpass', f0: 5200, q: 0.5, peak: b % 2 ? 0.08 : 0.05, attack: 0.004, bus: g.out });
          }
        };
        play();
        g.every(play, beat * 4 * 1000);
      }
    };

    let current = null;

    function setBed(kind) {
      if (current && current.kind === kind) return;
      const now = ctx.currentTime;
      if (current) {
        const old = current;
        old.graph.out.gain.cancelScheduledValues(now);
        old.graph.out.gain.setValueAtTime(old.graph.out.gain.value, now);
        old.graph.out.gain.linearRampToValueAtTime(0, now + 1.6);
        setTimeout(() => old.graph.dispose(), 1900);
      }
      current = null;
      if (!kind || !beds[kind]) return;
      const graph = bedGraph();
      beds[kind](graph);
      graph.out.gain.setValueAtTime(0, now);
      graph.out.gain.linearRampToValueAtTime(1, now + 2.4);
      current = { kind, graph };
    }

    function setLevels({ sfx: sfxOn, ambience }) {
      const now = ctx.currentTime;
      sfxBus.gain.cancelScheduledValues(now);
      sfxBus.gain.setTargetAtTime(sfxOn ? 1 : 0, now, 0.05);
      ambBus.gain.cancelScheduledValues(now);
      ambBus.gain.setTargetAtTime(ambience ? 0.22 : 0, now, 0.4);
    }

    return { sfx, setBed, setLevels, currentBed: () => (current ? current.kind : null), nodes: { master, sfxBus, ambBus } };
  }

  RCB.createAudioEngine = createAudioEngine;
})();
