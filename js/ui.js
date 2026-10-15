/* HUD, bottom sheets (with drag-to-dismiss), scrubber, toast and the pages grid. */
(function () {
  'use strict';
  const RCB = (window.RCB = window.RCB || {});
  const { core, bus, data } = RCB;
  const { pages, coverVariants, LAST } = data;

  const $ = (sel) => document.querySelector(sel);
  const pad = (n) => String(n).padStart(2, '0');
  const HUD_IDLE_MS = 5000;

  const el = {};
  let hudVisible = true;
  let hudTimer = 0;
  let toastTimer = 0;
  let openSheetEl = null;
  let lastFocus = null;
  let gridBuilt = false;
  let lastTick = -1;
  let flipMode = true;

  // ---------- HUD ----------
  function setHud(visible) {
    hudVisible = visible;
    document.body.classList.toggle('hud-off', !visible);
  }

  function armHudTimer() {
    clearTimeout(hudTimer);
    if (!flipMode || openSheetEl || document.body.classList.contains('is-splash')) return;
    hudTimer = setTimeout(() => setHud(false), HUD_IDLE_MS);
  }

  const ui = {
    init() {
      Object.assign(el, {
        pill: $('#top-pill'), loc: $('#top-loc'), chipTitle: $('#chip-title'), chipLoc: $('#chip-loc'),
        chipCta: $('#chip-cta'), chipIc: $('#chip-ic use'), scrubber: $('#scrubber'), scrubLabel: $('#scrub-label'),
        scrubPct: $('#scrub-pct'), tip: $('#scrub-tip'), tipImg: $('#scrub-tip-img'), tipText: $('#scrub-tip-text'),
        prev: $('#btn-prev'), next: $('#btn-next'), toast: $('#toast'), scrim: $('#scrim'), app: $('#app'),
        infoTitle: $('#info-title'), infoLoc: $('#info-loc'), infoText: $('#info-text'), grid: $('#pages-grid'),
        zoomText: $('#zoom-chip-text'), soundIc: $('#btn-sound use'), soundBtn: $('#btn-sound'),
        hudHot: [$('#topbar'), $('#dock')]
      });
      el.scrubber.max = String(LAST);

      // any press inside the HUD keeps it alive
      el.hudHot.forEach((h) => {
        h.addEventListener('pointerdown', armHudTimer, { passive: true });
        h.addEventListener('focusin', () => ui.showHud());
      });
      el.scrim.addEventListener('click', () => ui.closeSheet());
      document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => ui.closeSheet()));
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openSheetEl) { e.preventDefault(); ui.closeSheet(); } });

      document.querySelectorAll('.sheet').forEach(enableSheetDrag);
      bindScrubber();
      armHudTimer();
    },

    // ----- HUD visibility -----
    get hudVisible() { return hudVisible; },
    showHud() { setHud(true); armHudTimer(); },
    hideHud() { setHud(false); },
    toggleHud() { if (hudVisible) setHud(false); else { setHud(true); armHudTimer(); } },
    /** Stage interaction while the HUD is up restarts the idle countdown, but never reveals it. */
    touchStage() { if (hudVisible) armHudTimer(); },
    setFlipMode(isFlip) { flipMode = isFlip; if (!isFlip) clearTimeout(hudTimer); else armHudTimer(); },

    // ----- text/state sync -----
    updatePage(index, coverIdx) {
      const page = pages[index];
      const isCover = index === 0;
      const variant = coverVariants[coverIdx];
      document.body.classList.toggle('on-cover', isCover);

      el.pill.textContent = isCover ? `COVER • ${variant.tag}` : `P. ${pad(index)} / ${pad(LAST)}`;
      el.loc.textContent = isCover ? variant.title : page.loc;
      el.chipTitle.textContent = isCover ? `שער הספר · ${variant.tag}` : page.title;
      el.chipLoc.textContent = isCover ? 'הקישו להחלפת שער אקראי (1 מתוך 3)' : page.loc;
      el.chipCta.textContent = isCover ? 'החלף שער' : 'תקציר';
      el.chipIc.setAttribute('href', isCover ? '#i-dice' : '#i-lantern');
      el.infoTitle.textContent = page.title;
      el.infoLoc.textContent = page.loc;
      el.infoText.textContent = page.synopsis;

      el.scrubber.value = String(index);
      setScrubFill(index);
      el.scrubLabel.textContent = isCover ? `עמוד שער (${variant.tag})` : `עמוד ${index} מתוך ${LAST}`;
      el.scrubPct.textContent = `${Math.round((index / LAST) * 100)}% הושלמו`;
      el.prev.disabled = index === 0;
      el.next.disabled = index === LAST;
      el.scrubber.setAttribute('aria-valuetext', core.chapterAnnouncement(index, LAST));
      markCurrentInGrid(index, coverIdx);
    },

    setZoom({ scale, zoomed }) {
      document.body.classList.toggle('is-zoomed', zoomed);
      el.zoomText.textContent = `×${scale.toFixed(1)}`;
    },

    setSoundMode(mode) {
      const map = { full: ['#i-sound-full', 'צליל: אפקטים ואווירה'], fx: ['#i-sound-fx', 'צליל: אפקטים בלבד'], off: ['#i-sound-off', 'צליל: כבוי'] };
      const [icon, label] = map[mode] || map.off;
      el.soundIc.setAttribute('href', icon);
      el.soundBtn.setAttribute('aria-label', label);
      document.querySelectorAll('#seg-sound button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.value === mode)));
    },

    toast(message, ms = 2200) {
      el.toast.textContent = message;
      el.toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => el.toast.classList.remove('show'), ms);
    },

    // ----- sheets -----
    openSheet(id) {
      const sheet = document.getElementById(id);
      if (!sheet || sheet === openSheetEl) return;
      if (openSheetEl) closeNow(openSheetEl, false);
      if (id === 'sheet-pages') buildGrid();
      lastFocus = document.activeElement;
      openSheetEl = sheet;
      sheet.style.removeProperty('--dy');
      sheet.classList.add('open');
      el.scrim.classList.add('on');
      el.app.inert = true;
      document.body.classList.add('has-sheet');
      clearTimeout(hudTimer);
      setHud(true);
      requestAnimationFrame(() => sheet.focus({ preventScroll: true }));
      if (id === 'sheet-pages') {
        const cur = sheet.querySelector('.pg.current');
        if (cur) requestAnimationFrame(() => cur.scrollIntoView({ block: 'center' }));
      }
      bus.emit('sheet:open', { id });
    },

    closeSheet() {
      if (!openSheetEl) return;
      const sheet = openSheetEl;
      closeNow(sheet, true);
      bus.emit('sheet:close', { id: sheet.id });
    },

    get sheetOpen() { return !!openSheetEl; }
  };

  function closeNow(sheet, restoreFocus) {
    sheet.classList.remove('open', 'dragging');
    sheet.style.removeProperty('--dy');
    openSheetEl = null;
    el.scrim.classList.remove('on');
    el.app.inert = false;
    document.body.classList.remove('has-sheet');
    if (restoreFocus && lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    armHudTimer();
  }

  /** Drag the grab zone down to dismiss; a fast flick closes it even if short. */
  function enableSheetDrag(sheet) {
    const grab = sheet.querySelector('.sheet-grab');
    let startY = 0;
    let dy = 0;
    let t0 = 0;
    let active = false;

    grab.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      active = true;
      startY = e.clientY;
      dy = 0;
      t0 = e.timeStamp;
      grab.setPointerCapture(e.pointerId);
      sheet.classList.add('dragging');
    });
    grab.addEventListener('pointermove', (e) => {
      if (!active) return;
      dy = Math.max(0, e.clientY - startY);
      sheet.style.setProperty('--dy', `${dy}px`);
    });
    const end = (e) => {
      if (!active) return;
      active = false;
      sheet.classList.remove('dragging');
      const speed = dy / Math.max(e.timeStamp - t0, 1);
      if (dy > 120 || (dy > 30 && speed > 0.6)) ui.closeSheet();
      else sheet.style.removeProperty('--dy');
    };
    grab.addEventListener('pointerup', end);
    grab.addEventListener('pointercancel', end);
  }

  // ---------- pages grid ----------
  function buildGrid() {
    if (gridBuilt) return;
    gridBuilt = true;
    const frag = document.createDocumentFragment();
    pages.forEach((p, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pg';
      b.dataset.index = String(i);
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.alt = '';
      img.src = i === 0 ? coverVariants[RCB.reader.coverIdx].thumb : p.thumb;
      const num = document.createElement('span');
      num.className = 'pg-num';
      num.textContent = i === 0 ? 'COVER' : `PAGE ${pad(i)}`;
      const title = document.createElement('span');
      title.className = 'pg-title';
      title.textContent = i === 0 ? 'שער הספר' : (p.title.split(':')[1] || p.title).trim();
      title.dir = 'auto';
      b.append(img, num, title);
      b.addEventListener('click', () => bus.emit('grid:pick', { index: i }));
      frag.appendChild(b);
    });
    el.grid.appendChild(frag);
    markCurrentInGrid(RCB.reader.index, RCB.reader.coverIdx);
  }

  function markCurrentInGrid(index, coverIdx) {
    if (!gridBuilt) return;
    el.grid.querySelectorAll('.pg').forEach((b) => {
      const on = Number(b.dataset.index) === index;
      b.classList.toggle('current', on);
      if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
    const coverImg = el.grid.querySelector('.pg[data-index="0"] img');
    if (coverImg) coverImg.src = coverVariants[coverIdx].thumb;
  }

  // ---------- scrubber ----------
  function setScrubFill(value) {
    el.scrubber.style.setProperty('--p', String(value / LAST));
  }

  function showTip(value) {
    const page = pages[value];
    const rect = el.scrubber.getBoundingClientRect();
    const parent = el.scrubber.parentElement.getBoundingClientRect();
    const x = core.thumbFraction(value, 0, LAST, false, rect.width, 26);
    const abs = core.clamp(rect.left + x, 8 + 37, window.innerWidth - 8 - 37);
    el.tip.style.left = `${abs - parent.left}px`;
    el.tipImg.src = value === 0 ? coverVariants[RCB.reader.coverIdx].thumb : page.thumb;
    el.tipText.textContent = value === 0 ? 'שער' : `עמוד ${value}`;
    el.tip.classList.add('show');
  }

  function bindScrubber() {
    const s = el.scrubber;
    s.addEventListener('input', () => {
      const v = Number(s.value);
      setScrubFill(v);
      showTip(v);
      if (v !== lastTick) { lastTick = v; bus.emit('scrub:tick', { value: v }); }
    });
    s.addEventListener('change', () => {
      el.tip.classList.remove('show');
      lastTick = -1;
      bus.emit('scrub:commit', { value: Number(s.value) });
    });
    ['pointerup', 'pointercancel', 'blur'].forEach((ev) => s.addEventListener(ev, () => el.tip.classList.remove('show')));
  }

  RCB.ui = ui;
})();
