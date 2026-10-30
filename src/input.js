// Swipe (anywhere on the stage), on-screen buttons and keyboard.
import { CONFIG as C } from './config.js';

export function setupInput({ stage, padLeft, padRight, onMove, onGesture, onConfirm }) {
  // --- swipe ----------------------------------------------------------
  // A swipe fires as soon as the finger has moved `swipePx`, without waiting
  // for it to lift. One swipe = one lane. Reversing direction starts a new one.
  const touches = new Map();

  stage.addEventListener('pointerdown', (e) => {
    onGesture();
    if (e.target.closest('button')) return;
    touches.set(e.pointerId, { x0: e.clientX, y0: e.clientY, extreme: e.clientX, used: false });
  });

  stage.addEventListener('pointermove', (e) => {
    const s = touches.get(e.pointerId);
    if (!s) return;
    const dx = e.clientX - s.x0;
    const dy = e.clientY - s.y0;
    if (!s.used) {
      if (Math.abs(dx) >= C.swipePx && Math.abs(dx) > Math.abs(dy) * 0.7) {
        s.used = true;
        s.dir = Math.sign(dx);
        s.extreme = e.clientX;
        onMove(s.dir);
      }
    } else {
      // keep track of the furthest point; coming back far enough = new swipe
      if ((e.clientX - s.extreme) * s.dir > 0) s.extreme = e.clientX;
      else if (Math.abs(e.clientX - s.extreme) >= C.swipePx) {
        s.used = false;
        s.x0 = e.clientX;
        s.y0 = e.clientY;
      }
    }
  });

  const end = (e) => touches.delete(e.pointerId);
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
  stage.addEventListener('lostpointercapture', end);

  // --- on-screen buttons ----------------------------------------------
  const wirePad = (el, dir) => {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation(); // never counts as a swipe start
      onGesture();
      el.classList.add('down');
      onMove(dir);
    });
    const up = () => el.classList.remove('down');
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((n) => el.addEventListener(n, up));
  };
  wirePad(padLeft, -1);
  wirePad(padRight, 1);

  // --- keyboard -------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    onGesture();
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { onMove(-1); padLeft.classList.add('down'); e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { onMove(1); padRight.classList.add('down'); e.preventDefault(); }
    else if (k === 'Enter' || k === ' ') { onConfirm(); e.preventDefault(); }
  });
  window.addEventListener('keyup', () => {
    padLeft.classList.remove('down');
    padRight.classList.remove('down');
  });

  // --- no scrolling, zooming, selecting, context menus ----------------
  const stop = (e) => e.preventDefault();
  ['gesturestart', 'gesturechange', 'contextmenu', 'dblclick', 'selectstart', 'dragstart'].forEach((n) =>
    document.addEventListener(n, stop));
  document.addEventListener('touchmove', stop, { passive: false });
  document.addEventListener('touchstart', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
}
