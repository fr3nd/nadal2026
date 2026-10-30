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
const renderer = new Renderer(canvas);
const audio = new AudioEngine();
const ui = createUI(renderer.sprites, audio);

let best = store.get('best', 0);
ui.init(best);

// ---- layout: a portrait play area drawn at ~130 logical px wide -----------
const TARGET_W = 130;
function layout() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cssW = Math.min(vw, Math.floor(vh * 0.62));
  const ps = Math.max(2, Math.round(cssW / TARGET_W)); // CSS px per logical px
  const W = Math.floor(cssW / ps);
  const H = Math.floor(vh / ps);
  const stage = ui.el.stage;
  stage.style.width = `${W * ps}px`;
  stage.style.height = `${H * ps}px`;
  stage.style.setProperty('--u', `${(W * ps) / 100}px`);

  const laneW = Math.floor((W * 0.72) / 3);
  const roadW = laneW * 3;
  const roadLeft = Math.floor((W - roadW) / 2);
  const kaiY = Math.min(Math.floor(H * 0.8), Math.floor(ui.controlsTop() / ps) - 17);
  const geo = { W, H, laneW, roadW, roadLeft, kaiY };
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
game.on('heart', () => audio.sfx('heart'));
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
