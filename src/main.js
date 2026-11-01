import { Game } from './game.js';
import { Renderer } from './render.js';
import { AudioEngine, BASE_BPM, SUPER_BPM } from './audio.js';
import { createUI } from './ui.js';
import { setupInput } from './input.js';
import { initLang, t, onLangChange } from './i18n.js';
import { store } from './storage.js';
import { CONFIG } from './config.js';
import * as scores from './scores.js';

initLang();

// Debug previews via the URL (README: "Previewing without playing"). While one is on,
// nothing is saved or sent: no best score, no shared table.
const q = new URLSearchParams(location.search);
const num = (k) => (q.has(k) ? Number(q.get(k)) || 0 : 0);
const debug = { seconds: num('t'), meters: num('m'), god: q.has('god'), over: q.has('over') };
const debugOn = debug.seconds > 0 || debug.meters > 0 || debug.god || debug.over;

const canvas = document.getElementById('game');
const game = new Game();
const renderer = new Renderer(canvas);
const audio = new AudioEngine();
const ui = createUI(renderer.sprites, audio);

let best = store.get('best', 0);
ui.init();
ui.setRecordsEnabled(scores.enabled());

// ---- layout: a portrait play area drawn at ~130 logical px wide -----------
const LANE_W = 40;
const CONFIG_SUPER = CONFIG.superSpeedSeconds;
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
  // title screen: Kai waits halfway between the last button and the bottom of the screen
  const rect = (el) => el.getBoundingClientRect();
  const lastBtn = ui.el.recordsTitle.hidden ? document.getElementById('btn-play') : ui.el.recordsTitle;
  const titleKaiY = ui.el.title.hidden ? undefined : Math.round((rect(lastBtn).bottom + 8 + rect(ui.el.stage).height - 16) / 2 / ps);
  const geo = { W, H, laneW: LANE_W, roadW, roadLeft, kaiY, titleKaiY: titleKaiY || game.geo.titleKaiY };
  renderer.resize(geo);
  game.setGeometry(geo);
}
onLangChange(() => requestAnimationFrame(layout)); // button text changes size with the language
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(layout, 100);
});

// ---- game events -----------------------------------------------------------
game.on('gift', () => audio.sfx('gift'));
game.on('star', () => audio.sfx('star'));
game.on('hit', () => {
  audio.stopMusic(); // the music cuts off immediately...
  audio.sfx('hit');
  audio.sfx('sad'); // ...and the falling-notes sound plays
});
game.on('smash', () => audio.sfx('smash'));
game.on('superspeed', () => {
  ui.banner(t('superSpeed'));
  audio.sfx('superspeed');
  audio.setTempo(SUPER_BPM); // the music speeds up
});
game.on('milestone', () => { ui.toast(t('hoho')); audio.sfx('hoho'); });
game.on('gameover', () => {
  const score = game.score();
  const record = score > best && !debugOn;
  if (record) { best = score; store.set('best', best); }
  ui.showOver({ gifts: game.gifts, meters: game.meters(), score, best, record });
  // made the shared table? then ask for a name
  if (scores.qualifies(score)) ui.askName(store.get('name', ''));
});

// ---- shared high scores ----------------------------------------------------
ui.onSaveName = async (name) => {
  store.set('name', name);
  ui.setSaving();
  const r = await scores.submit(name, game.gifts, game.meters());
  if (r.ok) ui.showBoard({ top: r.top, highlight: r.rank, buttonKey: 'retry' });
  else ui.endNameStep('scoreError');
};
ui.onSkip = () => ui.endNameStep(null);
// the single board button: "Try again" after a run, "Back" when opened from the title
ui.onBoardButton = () => {
  if (game.state === 'title') ui.showTitle();
  else start();
};
ui.onRecords = async (from) => {
  const buttonKey = from === 'title' ? 'back' : 'retry';
  ui.showBoard({ top: [], buttonKey, messageKey: 'loading' });
  const top = await scores.getTop();
  if (top) ui.showBoard({ top, buttonKey });
  else ui.showBoard({ top: [], buttonKey, messageKey: 'tableError' });
};

function start() {
  audio.unlock();
  if (!debugOn) scores.startRun(); // background: gets this run's token and the current table
  audio.setTempo(BASE_BPM);
  ui.showGame();
  game.startRun();
  if (debugOn) {
    game.god = debug.god;
    game.skipTo({ seconds: debug.seconds, meters: debug.meters });
    if (game.time >= CONFIG_SUPER) audio.setTempo(SUPER_BPM); // already past the Super Speed moment
  }
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
  onGesture: () => { audio.unlock(); if (!audio.musicOn && (game.state === 'title' || game.state === 'play')) audio.startMusic(); },
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
  if (debugOn) {
    const tag = document.getElementById('debugtag');
    tag.hidden = false;
    tag.textContent = `DEBUG${debug.seconds ? ` t=${debug.seconds}s` : ''}${debug.meters ? ` m=${debug.meters}` : ''}${debug.god ? ' god' : ''}${debug.over ? ' over' : ''} · scores off`;
    start(); // no need to press Play; the first tap anywhere turns the sound on
    if (debug.over) setTimeout(() => { game.gifts = 12; game.hit(); }, 1500);
  }
});

// Dev-only hook for debugging in the console (stripped from production builds).
if (import.meta.env.DEV) window.__kai = { game, renderer, start };
