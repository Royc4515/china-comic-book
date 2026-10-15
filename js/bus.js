/* Tiny event bus so modules (reader, UI, audio, fx) stay decoupled. */
(function () {
  'use strict';
  const RCB = (window.RCB = window.RCB || {});
  const handlers = new Map();

  RCB.bus = {
    on(event, fn) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event).add(fn);
      return () => handlers.get(event).delete(fn);
    },
    emit(event, detail) {
      const set = handlers.get(event);
      if (!set) return;
      [...set].forEach((fn) => {
        try { fn(detail); } catch (err) { console.error(`handler for "${event}" failed:`, err); }
      });
    }
  };
})();
