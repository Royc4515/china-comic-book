/* Vertical "webtoon" reading mode. Tracks the page in view (IntersectionObserver) and
   reports scroll direction so the HUD can hide on scroll-down and return on scroll-up. */
(function () {
  'use strict';
  const RCB = (window.RCB = window.RCB || {});
  const { bus, data } = RCB;
  const { pages } = data;

  let view = null;
  let list = null;
  let built = false;
  let observer = null;
  let lastTop = 0;
  let settleTimer = 0;
  let current = 0;
  const ratios = new Map();

  const pad = (n) => String(n).padStart(2, '0');

  function build() {
    if (built) return;
    built = true;
    const frag = document.createDocumentFragment();
    pages.forEach((p, i) => {
      const card = document.createElement('article');
      card.className = 'v-card';
      card.id = `v-page-${i}`;
      card.dataset.index = String(i);

      const badge = document.createElement('span');
      badge.className = 'v-badge';
      badge.textContent = i === 0 ? 'COVER' : `PAGE ${pad(i)}`;

      const img = document.createElement('img');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.width = 896;
      img.height = 1200;
      img.alt = i === 0 ? 'שער הספר' : `${p.title} — ${p.loc}`;
      img.src = RCB.reader.srcFor(i);
      img.addEventListener('load', () => img.classList.add('ready'));
      if (img.complete && img.naturalWidth) img.classList.add('ready');

      card.append(badge, img);
      frag.appendChild(card);
    });
    list.appendChild(frag);

    observer = new IntersectionObserver((entries) => {
      entries.forEach((e) => ratios.set(Number(e.target.dataset.index), e.isIntersecting ? e.intersectionRatio : 0));
      let best = current;
      let bestRatio = 0;
      ratios.forEach((r, i) => { if (r > bestRatio) { bestRatio = r; best = i; } });
      if (bestRatio > 0.35 && best !== current) {
        current = best;
        clearTimeout(settleTimer);
        // debounce so a smooth scroll across many pages reports only where it lands
        settleTimer = setTimeout(() => bus.emit('scroll:index', { index: current }), 160);
      }
    }, { root: view, threshold: [0, 0.2, 0.35, 0.5, 0.7, 1] });
    list.querySelectorAll('.v-card').forEach((c) => observer.observe(c));

    view.addEventListener('scroll', () => {
      const top = view.scrollTop;
      const delta = top - lastTop;
      if (Math.abs(delta) > 14) {
        bus.emit('scroll:dir', { dir: delta > 0 ? 'down' : 'up', atTop: top < 40 });
        lastTop = top;
      }
    }, { passive: true });
  }

  RCB.scrollview = {
    init(viewEl, listEl) { view = viewEl; list = listEl; },
    show(index) {
      build();
      view.hidden = false;
      current = index;
      requestAnimationFrame(() => this.scrollTo(index, false));
    },
    hide() { if (view) view.hidden = true; },
    scrollTo(index, smooth = true) {
      const card = document.getElementById(`v-page-${index}`);
      if (!card) return;
      current = index;
      const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      card.scrollIntoView({ behavior: smooth && !calm ? 'smooth' : 'auto', block: 'center' });
    },
    refreshCover() {
      const img = document.querySelector('#v-page-0 img');
      if (!img) return;
      img.classList.remove('ready');
      img.src = RCB.reader.srcFor(0);
    },
    get index() { return current; },
    get active() { return !!view && !view.hidden; }
  };
})();
