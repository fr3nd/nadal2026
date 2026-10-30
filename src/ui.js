// DOM side of the game: screens, HUD, language switch, mute button.
import { LANGS, getLang, setLang, onLangChange, t } from './i18n.js';
import { toDataURL } from './sprites.js';

const $ = (id) => document.getElementById(id);

export function createUI(sprites, audio) {
  const el = {
    stage: $('stage'), hud: $('hud'), controls: $('controls'), title: $('title'), over: $('over'),
    gifts: $('hud-gifts'), meters: $('hud-m'), toast: $('toast'), mute: $('mute'),
    titleBest: $('title-best'), record: $('record'),
    padLeft: $('pad-left'), padRight: $('pad-right'),
  };

  const urls = {
    soundOn: toDataURL(sprites.iconSoundOn),
    soundOff: toDataURL(sprites.iconSoundOff),
  };
  $('hud-gift-icon').src = toDataURL(sprites.iconGift);
  el.padLeft.querySelector('img').src = toDataURL(sprites.arrowLeft);
  el.padRight.querySelector('img').src = toDataURL(sprites.arrowRight);

  // language switch (built from LANGS, so new languages show up by themselves)
  document.querySelectorAll('.lang').forEach((box) => {
    LANGS.forEach((code, i) => {
      if (i) {
        const sep = document.createElement('span');
        sep.textContent = '|';
        box.appendChild(sep);
      }
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.lang = code;
      b.textContent = code.toUpperCase();
      b.addEventListener('click', () => setLang(code));
      box.appendChild(b);
    });
  });
  const refreshLang = () => {
    document.querySelectorAll('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === getLang())));
    refreshMute();
  };

  function refreshMute() {
    el.mute.querySelector('img').src = audio.muted ? urls.soundOff : urls.soundOn;
    el.mute.setAttribute('aria-label', t(audio.muted ? 'soundOn' : 'soundOff'));
  }
  el.mute.addEventListener('pointerdown', (e) => e.stopPropagation());
  el.mute.addEventListener('click', () => { audio.unlock(); audio.toggleMute(); refreshMute(); });

  let best = 0;
  const refreshBest = () => { el.titleBest.textContent = best > 0 ? t('best', { n: best }) : ''; };
  onLangChange(() => { refreshBest(); refreshLang(); });

  let last = { gifts: -1, m: -1 };

  const ui = {
    el,
    init(bestScore) {
      best = bestScore;
      refreshBest();
      refreshLang();
      this.showTitle();
    },
    setBest(b) { best = b; refreshBest(); },
    showTitle() {
      el.title.hidden = false;
      el.over.hidden = true;
      el.hud.classList.add('hidden');
      el.controls.classList.remove('active');
      refreshBest();
    },
    showGame() {
      el.title.hidden = true;
      el.over.hidden = true;
      el.hud.classList.remove('hidden');
      el.controls.classList.add('active');
      last = { gifts: -1, m: -1 };
    },
    showOver({ gifts, meters, score, best: b, record }) {
      $('r-gifts').textContent = gifts;
      $('r-m').textContent = meters;
      $('r-score').textContent = score;
      $('r-best').textContent = b;
      el.record.hidden = !record;
      el.hud.classList.add('hidden');
      el.controls.classList.remove('active');
      el.over.hidden = false;
      // brief lock so a panicked tap on the pads can't instantly restart
      el.over.classList.add('locked');
      setTimeout(() => el.over.classList.remove('locked'), 700);
    },
    toast(text) {
      el.toast.textContent = text;
      el.toast.classList.remove('show');
      void el.toast.offsetWidth;
      el.toast.classList.add('show');
    },
    // called every frame; only touches the DOM when something changed
    hud(game) {
      if (game.gifts !== last.gifts) { last.gifts = game.gifts; el.gifts.textContent = game.gifts; }
      const m = game.meters();
      if (m !== last.m) { last.m = m; el.meters.textContent = m; }
    },
    get playVisible() { return !el.title.hidden; },
    get overVisible() { return !el.over.hidden && !el.over.classList.contains('locked'); },
  };
  return ui;
}
