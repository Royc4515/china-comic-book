import { test } from 'node:test';
import assert from 'node:assert/strict';
import core from '../js/core.js';

const {
  clamp, neighbor, rubberBand, dragToTurn, shouldCommit, settleDuration,
  clampPan, zoomAt, thumbFraction, flipGeometry, nextSoundMode, createVelocityTracker,
  tapZone, chapterAnnouncement, hexToRgb
} = core;

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} !~ ${b}`);

test('clamp bounds a value', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(clamp(2, 0, 3), 2);
});

test('neighbor respects both ends of the book', () => {
  assert.equal(neighbor(0, 'prev', 12), null);
  assert.equal(neighbor(12, 'next', 12), null);
  assert.equal(neighbor(3, 'next', 12), 4);
  assert.equal(neighbor(3, 'prev', 12), 2);
});

test('rubberBand is monotonic and never exceeds its limit', () => {
  assert.equal(rubberBand(0, 0.14), 0);
  assert.equal(rubberBand(-3, 0.14), 0);
  let prev = 0;
  for (const x of [0.05, 0.2, 0.6, 1, 5, 100]) {
    const v = rubberBand(x, 0.14);
    assert.ok(v > prev && v < 0.14, `x=${x} v=${v}`);
    prev = v;
  }
});

test('dragToTurn: leftward drag turns forward in a left-to-right book', () => {
  const r = dragToTurn(-170, 400, 3, 12);
  assert.equal(r.dir, 'next');
  assert.equal(r.blocked, false);
  near(r.progress, 170 / (400 * 0.85));
});

test('dragToTurn: rightward drag turns back', () => {
  const r = dragToTurn(120, 400, 3, 12);
  assert.equal(r.dir, 'prev');
  assert.equal(r.blocked, false);
});

test('dragToTurn: dragging past the cover or last page is rubber-banded and blocked', () => {
  const atStart = dragToTurn(300, 400, 0, 12);
  assert.equal(atStart.blocked, true);
  assert.ok(atStart.progress > 0 && atStart.progress < 0.14);
  const atEnd = dragToTurn(-300, 400, 12, 12);
  assert.equal(atEnd.blocked, true);
  assert.ok(atEnd.progress < 0.14);
});

test('dragToTurn: progress never exceeds 1 on a valid turn', () => {
  assert.equal(dragToTurn(-5000, 400, 3, 12).progress, 1);
});

test('shouldCommit: slow drag commits only past the threshold', () => {
  assert.equal(shouldCommit(0.2, 0, false), false);
  assert.equal(shouldCommit(0.45, 0, false), true);
});

test('shouldCommit: a fling commits early, a flick-back cancels late', () => {
  assert.equal(shouldCommit(0.1, 0.002, false), true);
  assert.equal(shouldCommit(0.6, -0.002, false), false);
});

test('shouldCommit: an accidental twitch does not fling', () => {
  assert.equal(shouldCommit(0.01, 0.01, false), false);
});

test('shouldCommit: never commits a blocked edge turn', () => {
  assert.equal(shouldCommit(0.9, 0.01, true), false);
});

test('settleDuration stays within 160-520ms and shrinks with velocity', () => {
  const slow = settleDuration(0.6, 0);
  const fast = settleDuration(0.6, 0.004);
  assert.ok(slow <= 520 && slow >= 160);
  assert.ok(fast < slow);
  assert.equal(settleDuration(0.01, 0), 160);
  assert.equal(settleDuration(5, 0), 520);
});

test('clampPan: no pan at 1x, bounded pan when zoomed', () => {
  assert.deepEqual(clampPan(50, -50, 1, 300, 400), { x: 0, y: 0 });
  assert.deepEqual(clampPan(999, -999, 2, 300, 400), { x: 150, y: -200 });
  assert.deepEqual(clampPan(10, 20, 2, 300, 400), { x: 10, y: 20 });
});

test('zoomAt keeps the focal point fixed', () => {
  const start = { scale: 1, x: 0, y: 0 };
  const z = zoomAt(start, 2, 60, -40, 300, 400);
  // content point under the focal before: c = f; after: t + s*c must equal f.
  near(z.x + z.scale * 60 - 60 * 0, z.x + 120);
  near(z.x + 2 * 60, 60);
  near(z.y + 2 * -40, -40);
});

test('zoomAt clamps scale to [1, 4] and re-centres when returning to 1x', () => {
  const z = zoomAt({ scale: 2, x: 80, y: 60 }, 99, 0, 0, 300, 400);
  assert.equal(z.scale, 4);
  const back = zoomAt({ scale: 2, x: 80, y: 60 }, 0.2, 0, 0, 300, 400);
  assert.deepEqual(back, { scale: 1, x: 0, y: 0 });
});

test('thumbFraction mirrors for RTL and respects the thumb inset', () => {
  near(thumbFraction(0, 0, 12, false, 300, 20), 10);
  near(thumbFraction(12, 0, 12, false, 300, 20), 290);
  near(thumbFraction(0, 0, 12, true, 300, 20), 290);
  near(thumbFraction(12, 0, 12, true, 300, 20), 10);
  near(thumbFraction(6, 0, 12, true, 300, 20), 150);
});

test('flipGeometry runs from flat to edge-on and past', () => {
  const flat = flipGeometry(0);
  assert.equal(flat.angle, 0);
  assert.equal(flat.edgePct, 0);
  const mid = flipGeometry(0.5);
  assert.ok(mid.angle > 40 && mid.angle < 60);
  assert.ok(mid.highlight > 0.9);
  const done = flipGeometry(1);
  assert.ok(done.angle > 90);
  assert.equal(done.edgePct, 100);
  assert.ok(done.curShade <= 1 && done.nextShade >= 0);
});

test('nextSoundMode cycles full -> fx -> off -> full and repairs junk', () => {
  assert.equal(nextSoundMode('full'), 'fx');
  assert.equal(nextSoundMode('fx'), 'off');
  assert.equal(nextSoundMode('off'), 'full');
  assert.equal(nextSoundMode('???'), 'full');
});

test('velocity tracker reports slope over a short window', () => {
  const v = createVelocityTracker(100);
  assert.equal(v.velocity(), 0);
  v.add(0, 0);
  v.add(50, 10);
  v.add(100, 30);
  near(v.velocity(), 0.3);
  v.add(500, 30); // old samples fall out of the window
  assert.equal(v.velocity(), 0);
  v.reset();
  assert.equal(v.velocity(), 0);
});

test('tapZone splits the stage 28/44/28 and mirrors with the book direction', () => {
  assert.equal(tapZone(10, 400, true), 'next');      // left edge = forward in RTL
  assert.equal(tapZone(390, 400, true), 'prev');
  assert.equal(tapZone(200, 400, true), 'center');
  assert.equal(tapZone(10, 400, false), 'prev');
  assert.equal(tapZone(390, 400, false), 'next');
});

test('chapterAnnouncement describes cover and chapters in Hebrew', () => {
  assert.match(chapterAnnouncement(0, 12), /שער/);
  assert.match(chapterAnnouncement(5, 12), /5/);
  assert.match(chapterAnnouncement(5, 12), /12/);
});

test('hexToRgb converts valid hex and falls back to gold on junk', () => {
  assert.equal(hexToRgb('#f5a524'), '245,165,36');
  assert.equal(hexToRgb('7dd3fc'), '125,211,252');
  assert.equal(hexToRgb('not-a-colour'), '245,165,36');
  assert.equal(hexToRgb(undefined), '245,165,36');
});
