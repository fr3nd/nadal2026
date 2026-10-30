import { Game } from './game.js';
import { Renderer } from './render.js';
import { AudioEngine } from './audio.js';
import { createUI } from './ui.js';
import { setupInput } from './input.js';
import { initLang, t } from './i18n.js';
import { store } from './storage.js';

initLang();

const canvas = document.getElementById('game');
const game = new Game();
// ?kai=a|b|c|d previews the Kai options (see src/kai.js)
const renderer = new Renderer(canvas, new URLSearchParams(location.search).get('kai'));
const audio = new AudioEngine();
const ui = createUI(renderer.sprites, audio);

let best = store.get('best', 0);
ui.init(best);

// ---- layout: a portrait play area drawn at ~130 logical px wide -----------
const LANE_W = 40;
function layout() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cssW = Math.min(vw, Math.floor(vh * 0.62));
  const ps = Math.max(2, Math.floor(cssW / 150)); // CSS px per logical px
  const W = Math.floor(cssW / ps);
  const H = Math.floor(vh / ps);
  const stage = ui.el.stage;
  stage.style.width = `${W * ps}px`;
  stage.style.height = `${H * ps}px`;
  stage.style.setProperty('--u', `${(W * ps) / 100}px`);

  const roadW = LANE_W * 3;
  const roadLeft = Math.floor((W - roadW) / 2);
  // Kai rides near the top, just under the HUD
  // (and never under the score box, whatever its size)
  const hudBottom = ui.el.hud.querySelector('.hud-panel').getBoundingClientRect().bottom;
  const kaiY = Math.max(Math.floor(H * 0.2), Math.ceil(hudBottom / ps) + 30);
  const geo = { W, H, laneW: LANE_W, roadW, roadLeft, kaiY };
  renderer.resize(geo);
  game.setGeometry(geo);
}
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(layout, 100);
});

// ---- game events -----------------------------------------------------------
game.on('gift', () => audio.sfx('gift'));
game.on('star', () => audio.sfx('star'));
game.on('hit', () => audio.sfx('hit'));
game.on('smash', () => audio.sfx('smash'));
game.on('milestone', () => { ui.toast(t('hoho')); audio.sfx('hoho'); });
game.on('gameover', () => {
  const score = game.score();
  const record = score > best;
  if (record) { best = score; store.set('best', best); }
  ui.setBest(best);
  audio.stopMusic();
  audio.sfx('gameover');
  ui.showOver({ gifts: game.gifts, meters: game.meters(), score, best, record });
});

function start() {
  audio.unlock();
  ui.showGame();
  game.startRun();
  audio.startMusic();
}

// ---- input -----------------------------------------------------------------
document.getElementById('btn-play').addEventListener('click', start);
document.getElementById('btn-retry').addEventListener('click', start);
setupInput({
  stage: ui.el.stage,
  padLeft: ui.el.padLeft,
  padRight: ui.el.padRight,
  onMove: (dir) => game.move(dir),
  onGesture: () => { audio.unlock(); if (!audio.musicOn && game.state === 'title') audio.startMusic(); },
  onConfirm: () => {
    if (game.state === 'title') start();
    else if (game.state === 'over' && ui.overVisible) start();
  },
});

// ---- pause sound in the background ----------------------------------------
document.addEventListener('visibilitychange', () => {
  if (document.hidden) audio.pause();
  else { audio.resume(); last = performance.now(); }
});

// ---- main loop -------------------------------------------------------------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  renderer.draw(game, now / 1000);
  if (game.state !== 'title') ui.hud(game);
  requestAnimationFrame(frame);
}

const fontReady = document.fonts && document.fonts.load ? document.fonts.load('16px "Press Start 2P"') : Promise.resolve();
fontReady.catch(() => {}).then(() => {
  layout();
  requestAnimationFrame(frame);
});

// Dev-only hook for debugging in the console (stripped from production builds).
if (import.meta.env.DEV) window.__kai = { game, renderer, start };
