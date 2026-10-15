/* Haptic feedback.
   Android/Chromium: Vibration API.
   iOS Safari 17.4+: toggling a hidden <input type="checkbox" switch> fires the system haptic. Apple only
   allows it inside a user-gesture handler, so calls made from timers/rAF are silently ignored by iOS. */
(function () {
  'use strict';
  const RCB = (window.RCB = window.RCB || {});

  let enabled = true;
  let iosLabel = null;

  const canVibrate = typeof navigator.vibrate === 'function';
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function iosPulse() {
    if (!isIOS) return;
    try {
      if (!iosLabel) {
        iosLabel = document.createElement('label');
        iosLabel.setAttribute('aria-hidden', 'true');
        iosLabel.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.setAttribute('switch', '');
        iosLabel.appendChild(input);
        document.body.appendChild(iosLabel);
      }
      iosLabel.click();
    } catch (err) {
      iosLabel = null;
    }
  }

  function fire(pattern) {
    if (!enabled) return;
    if (canVibrate) {
      try { navigator.vibrate(pattern); } catch (err) { /* blocked by policy: ignore */ }
    } else {
      iosPulse();
    }
  }

  RCB.haptics = {
    get supported() { return canVibrate || isIOS; },
    get enabled() { return enabled; },
    setEnabled(v) { enabled = !!v; },
    tap() { fire(8); },
    tick() { fire(4); },
    turn() { fire(14); },
    thud() { fire([18, 20, 10]); },
    success() { fire([10, 40, 16]); },
    soft() { fire(6); }
  };
})();
