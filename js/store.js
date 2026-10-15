/* localStorage wrapper that never throws (private mode, blocked storage, quota). */
(function () {
  'use strict';
  const RCB = (window.RCB = window.RCB || {});
  const PREFIX = 'rcb:';

  RCB.store = {
    get(key, fallback) {
      try {
        const raw = window.localStorage.getItem(PREFIX + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (err) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
        return true;
      } catch (err) {
        return false;
      }
    }
  };
})();
