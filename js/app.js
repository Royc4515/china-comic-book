/* Bootstrap + wiring: settings, splash/audio-unlock, per-chapter theming, input shortcuts, PWA bits. */
(function () {
  'use strict';
  const RCB = window.RCB;
  const { core, bus, data, store, audio, haptics, fx, reader, scrollview, ui } = RCB;
  const { pages, LAST } = data;

  const $ = (sel) => document.querySelector(sel);
  const root = document.documentElement;
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  const state = {
    sound: store.get('sound', 'full'),
    haptics: store.get('haptics', true),
    particles: store.get('particles', !fx.reducedMotion),
    tilt: store.get('tilt', !fx.reducedMotion && !fx.needsOrientationPermission),
    mode: store.get('mode', 'flip'),
    music: store.get('music', true)
  };

  const SOUND_LABELS = { full: 'צליל: אפקטים ואווירה', fx: 'צליל: אפקטים בלבד', off: 'צליל: כבוי' };
  const position = () => (state.mode === 'scroll' ? scrollview.index : reader.index);

  // ---------- settings ----------
  function applySound(mode, { explicit = false } = {}) {
    state.sound = mode;
    store.set('sound', mode);
    audio.setMode(mode);
    ui.setSoundMode(mode);
    if (mode !== 'off') audio.unlock({ explicit });
  }

  function setSwitch(btn, on) { btn.setAttribute('aria-checked', String(!!on)); }

  function applyMusic(on) { state.music = on; store.set('music', on); audio.setMusic(on); setSwitch($('#sw-music'), on); }
  function applyHaptics(on) { state.haptics = on; store.set('haptics', on); haptics.setEnabled(on); setSwitch($('#sw-haptics'), on); }
  function applyParticles(on) { state.particles = on; store.set('particles', on); fx.setParticles(on); setSwitch($('#sw-particles'), on); }
  function applyTilt(on) { state.tilt = on; store.set('tilt', on); fx.setTilt(on); setSwitch($('#sw-tilt'), on); }

  function setMode(mode) {
    state.mode = mode;
    store.set('mode', mode);
    const scroll = mode === 'scroll';
    document.body.classList.toggle('mode-scroll', scroll);
    ui.setFlipMode(!scroll);
    if (scroll) {
      scrollview.show(reader.index);
      ui.showHud();
      ui.setZoom({ scale: 1, zoomed: false });
    } else {
      const target = scrollview.active ? scrollview.index : reader.index;
      scrollview.hide();
      reader.jump(target);
      ui.showHud();
    }
    document.querySelectorAll('#seg-mode button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.value === mode)));
  }

  // ---------- per-chapter theme ----------
  function applyTheme(index) {
    const t = pages[index].theme;
    root.style.setProperty('--accent', t.accent);
    root.style.setProperty('--accent-rgb', core.hexToRgb(t.accent));
    fx.setPreset(t.fx, t.accent);
    audio.setBed(t.bed);
    audio.setTrack(t.music);
  }

  // Saved immediately; the shareable #hash is debounced (Safari throttles history.replaceState to 100 calls / 30s).
  let hashTimer = 0;
  function syncPosition(index) {
    store.set('page', index);
    clearTimeout(hashTimer);
    hashTimer = setTimeout(() => {
      try { history.replaceState(null, '', index === 0 ? location.pathname + location.search : `#${index}`); } catch (err) { /* sandboxed frame: ignore */ }
    }, 600);
  }

  // ---------- navigation helpers ----------
  function go(index, source) {
    if (state.mode === 'scroll') { scrollview.scrollTo(index, true); return; }
    reader.goTo(index, { source, duration: 460 });
  }

  function stepPage(delta) {
    if (state.mode === 'scroll') {
      scrollview.scrollTo(core.clamp(scrollview.index + delta, 0, LAST), true);
    } else if (delta > 0) reader.next();
    else reader.prev();
  }

  // ---------- reader / UI events ----------
  bus.on('change', ({ index, coverIdx }) => {
    ui.updatePage(index, coverIdx);
    applyTheme(index);
    syncPosition(index);
  });

  bus.on('turn:start', ({ dir, from, to, source, velocity }) => {
    const intensity = source === 'drag' ? core.clamp(0.4 + velocity * 260, 0.4, 1) : 0.62;
    audio.turn({ dir, intensity });
    haptics.turn();
    ui.touchStage();
  });
  bus.on('turn:end', ({ index }) => {
    audio.land({ intensity: 0.6 });
    if (index === LAST) { audio.chime(index); haptics.success(); }
  });
  bus.on('edge:bump', () => { audio.bump(); haptics.thud(); });
  bus.on('drag:detent', ({ armed }) => { haptics.tick(); if (armed) audio.tick(); });
  bus.on('drag:start', () => fx.setTiltActive(false));
  bus.on('drag:end', () => fx.setTiltActive(!reader.zoomed));
  bus.on('touch', () => ui.touchStage());

  let wasZoomed = false;
  bus.on('zoom', (z) => {
    ui.setZoom(z);
    fx.setTiltActive(!z.zoomed);
    if (z.zoomed !== wasZoomed) { wasZoomed = z.zoomed; audio.zoom(z.zoomed); haptics.tap(); }
  });

  bus.on('tap:center', () => { if (reader.zoomed) return; audio.tap(); ui.toggleHud(); });
  bus.on('swipe:up', () => (reader.index === 0 ? swapCover() : ui.openSheet('sheet-info')));
  bus.on('cover', ({ coverIdx }) => { audio.cover(); haptics.soft(); scrollview.refreshCover(); ui.updatePage(position(), coverIdx); });

  bus.on('sheet:open', () => { audio.tap(); haptics.tap(); });
  bus.on('sheet:close', () => audio.tap());

  bus.on('grid:pick', ({ index }) => { ui.closeSheet(); go(index, 'grid'); audio.chime(index); });
  bus.on('scrub:tick', () => { audio.tick(); haptics.tick(); });
  bus.on('scrub:commit', ({ value }) => { go(value, 'scrub'); if (Math.abs(value - position()) > 1) audio.chime(value); });

  // scroll mode keeps the HUD, theme and progress in sync
  bus.on('scroll:index', ({ index }) => {
    ui.updatePage(index, reader.coverIdx);
    applyTheme(index);
    syncPosition(index);
    audio.tick();
  });
  let hudLockedByScroll = false;
  bus.on('scroll:dir', ({ dir, atTop }) => {
    if (dir === 'down' && !atTop) { ui.hideHud(); hudLockedByScroll = true; }
    else if (hudLockedByScroll) { ui.showHud(); hudLockedByScroll = false; }
  });

  function swapCover() { reader.swapCover(); }

  // ---------- DOM wiring ----------
  function bindControls() {
    $('#btn-prev').addEventListener('click', () => { audio.tap(); haptics.tap(); stepPage(-1); });
    $('#btn-next').addEventListener('click', () => { audio.tap(); haptics.tap(); stepPage(1); });
    $('#btn-pages').addEventListener('click', () => ui.openSheet('sheet-pages'));
    $('#btn-settings').addEventListener('click', () => ui.openSheet('sheet-settings'));
    $('#chip').addEventListener('click', () => (position() === 0 ? swapCover() : ui.openSheet('sheet-info')));
    $('#zoom-chip').addEventListener('click', () => { reader.resetZoom(); audio.tap(); });

    $('#btn-sound').addEventListener('click', () => {
      const next = core.nextSoundMode(state.sound);
      applySound(next, { explicit: true });
      ui.toast(SOUND_LABELS[next]);
      haptics.tap();
    });

    document.querySelectorAll('#seg-sound button').forEach((b) => b.addEventListener('click', () => {
      applySound(b.dataset.value, { explicit: true });
      haptics.tap();
    }));
    document.querySelectorAll('#seg-mode button').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.value !== state.mode) { setMode(b.dataset.value); haptics.tap(); audio.tap(); }
    }));

    $('#sw-music').addEventListener('click', () => { applyMusic(!state.music); haptics.tap(); if (state.music && state.sound !== 'off') audio.unlock({ explicit: true }); });
    $('#sw-haptics').addEventListener('click', () => { applyHaptics(!state.haptics); haptics.tap(); });
    $('#sw-particles').addEventListener('click', () => { applyParticles(!state.particles); haptics.tap(); });
    $('#sw-tilt').addEventListener('click', async () => {
      const next = !state.tilt;
      if (next) {
        const ok = await fx.enableOrientation();
        if (!ok && fx.needsOrientationPermission) { ui.toast('אפשרו גישה לחיישני תנועה כדי להפעיל'); return; }
      }
      applyTilt(next);
      haptics.tap();
    });

    // fullscreen (not available on iPhone Safari, pointless once installed)
    const fsBtn = $('#btn-fullscreen');
    const fsRequest = root.requestFullscreen || root.webkitRequestFullscreen;
    if (!fsRequest || isStandalone) fsBtn.hidden = true;
    fsBtn.addEventListener('click', () => {
      ui.closeSheet();
      if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else Promise.resolve(fsRequest.call(root)).catch(() => ui.toast('מסך מלא לא זמין'));
    });

    // install as an app
    let deferredInstall = null;
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; $('#btn-install').hidden = false; });
    window.addEventListener('appinstalled', () => { $('#btn-install').hidden = true; deferredInstall = null; });
    $('#btn-install').addEventListener('click', async () => {
      if (!deferredInstall) return;
      deferredInstall.prompt();
      await deferredInstall.userChoice.catch(() => null);
      deferredInstall = null;
      $('#btn-install').hidden = true;
    });
    if (isIOS && !isStandalone) $('#install-ios-note').hidden = false;

    if (!haptics.supported) {
      const sw = $('#sw-haptics');
      sw.disabled = true;
      setSwitch(sw, false);
      $('#haptics-note').textContent = 'לא נתמך בדפדפן או במכשיר הזה';
    }
    if (fx.needsOrientationPermission) $('#tilt-note').textContent = 'לחיצה תבקש גישה לחיישני תנועה';
  }

  function bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || ui.sheetOpen || e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.body.classList.contains('is-splash')) return;
      const k = e.key;
      if (k === 'Tab' && !ui.hudVisible) ui.showHud();
      if (k === ' ' && e.target.closest && e.target.closest('button, a, [role="switch"], [role="radio"]')) return;
      if (k === 'ArrowLeft' || k === 'PageUp') { stepPage(-1); e.preventDefault(); }
      else if (k === 'ArrowRight' || k === 'PageDown' || k === ' ') { stepPage(1); e.preventDefault(); }
      else if (k === 'Home') go(0, 'key');
      else if (k === 'End') go(LAST, 'key');
      else if ((k === 'f' || k === 'F') && !$('#btn-fullscreen').hidden) $('#btn-fullscreen').click();
      else if (k === 'm' || k === 'M') $('#btn-sound').click();
      else if (k === 'z' || k === 'Z') reader.toggleZoom();
      else if (k === 'Escape') reader.resetZoom();
    });
  }

  // ---------- splash / entering the book ----------
  function enterBook() {
    const splash = $('#splash');
    document.body.classList.remove('is-splash');
    $('#app').inert = false;
    splash.classList.add('gone');
    store.set('visited', true);
    ui.showHud();
    if (!store.get('hinted', false)) {
      store.set('hinted', true);
      setTimeout(() => ui.toast('החליקו לדפדוף · צביטה להגדלה\nהקשה במרכז — הצגה והסתרה של תפריטים', 4600), 900);
    }
    $('#stage').focus({ preventScroll: true });
  }

  /** iOS only allows motion access from a gesture, so a saved "tilt on" is re-requested on the opening tap. */
  function rearmTilt() {
    if (state.tilt && fx.needsOrientationPermission) fx.enableOrientation().then((ok) => { if (!ok) applyTilt(false); });
  }

  function setupSplash() {
    const resume = reader.index;
    $('#splash-open-label').textContent = resume > 0 ? `המשיכו מעמוד ${resume}` : 'פתחו את הספר';
    const returningSilent = store.get('visited', false) && state.sound === 'off';
    if (returningSilent) { enterBook(); return; }

    $('#app').inert = true;
    $('#splash-open').focus({ preventScroll: true });
    $('#splash-open').addEventListener('click', () => {
      applySound(state.sound === 'off' ? 'full' : state.sound, { explicit: true });
      haptics.success();
      audio.unlock({ explicit: true }).then((ok) => { if (ok) audio.open(); });
      rearmTilt();
      enterBook();
    });
    $('#splash-silent').addEventListener('click', () => { applySound('off'); rearmTilt(); enterBook(); });
  }

  // ---------- offline warm-up ----------
  /** After opening, quietly fetch the remaining pages (the service worker keeps them) unless data is scarce. */
  function warmCache() {
    const c = navigator.connection;
    if (!('serviceWorker' in navigator) || (c && (c.saveData || /(^|-)2g$|3g/.test(c.effectiveType || '')))) return;
    const urls = pages.map((p, i) => reader.srcFor(i)).concat(pages.map((p) => p.thumb), ['assets/music/asia.mp3', 'assets/music/sunrise.mp3']);
    let i = 0;
    const next = () => {
      if (i >= urls.length) return;
      fetch(urls[i++]).catch(() => null).finally(() => setTimeout(next, 250));
    };
    setTimeout(next, 6000);
  }

  function hideDevLink() {
    const local = /^(localhost|127\.0\.0\.1|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(location.hostname);
    const link = document.querySelector('a[href="review.html"]');
    if (link && !local) link.hidden = true;
  }

  // ---------- device niceties ----------
  let wakeLock = null;
  async function keepAwake() {
    if (!('wakeLock' in navigator) || document.hidden) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (err) { /* denied (low battery / policy): reading still works */ }
  }

  function registerWorker() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Offline mode unavailable:', err.message));
    });
  }

  // ---------- boot ----------
  function startIndex() {
    const m = /^#(\d{1,2})$/.exec(location.hash);
    const fromHash = m ? Number(m[1]) : null;
    const saved = store.get('page', 0);
    return core.clamp(fromHash !== null ? fromHash : saved, 0, LAST);
  }

  function boot() {
    fx.init($('#fx'), $('#tilt'));
    ui.init();
    reader.init({
      stage: $('#stage'), book: $('#book'), zoomEl: $('#zoom'), ripples: $('#ripples'), live: $('#live'),
      backdrop: [...document.querySelectorAll('#backdrop img')],
      leaves: { prev: $('#leaf-prev'), cur: $('#leaf-cur'), next: $('#leaf-next') }
    });
    scrollview.init($('#scroll-view'), $('#scroll-list'));

    haptics.setEnabled(state.haptics);
    fx.setParticles(state.particles);
    fx.setTilt(state.tilt);
    if (state.tilt && !fx.needsOrientationPermission) fx.enableOrientation();
    audio.setMusic(state.music);
    audio.setMode(state.sound);
    ui.setSoundMode(state.sound);
    setSwitch($('#sw-music'), state.music);
    setSwitch($('#sw-haptics'), state.haptics);
    setSwitch($('#sw-particles'), state.particles);
    setSwitch($('#sw-tilt'), state.tilt);

    bindControls();
    bindKeyboard();
    reader.jump(startIndex());
    setMode(state.mode === 'scroll' ? 'scroll' : 'flip');
    setupSplash();

    keepAwake();
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !wakeLock) keepAwake(); });
    registerWorker();
    warmCache();
    hideDevLink();
  }

  boot();
})();
