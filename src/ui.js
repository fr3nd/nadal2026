// DOM side of the game: screens, HUD, language switch, mute button.
import { LANGS, getLang, setLang, onLangChange, t } from './i18n.js';
import { toDataURL } from './sprites.js';
import { CONFIG as C } from './config.js';

const $ = (id) => document.getElementById(id);

export function createUI(sprites, audio) {
  const el = {
    stage: $('stage'), hud: $('hud'), controls: $('controls'), title: $('title'), over: $('over'),
    gifts: $('hud-gifts'), meters: $('hud-m'), toast: $('toast'), mute: $('mute'),
    titleBest: $('title-best'), record: $('record'),
    board: $('board'), boardList: $('board-list'), boardBtn: $('btn-board'),
    nameForm: $('name-form'), nameInput: $('name-input'), btnSave: $('btn-save'), saveMsg: $('save-msg'),
    btnRetry: $('btn-retry'), recordsTitle: $('btn-records'), recordsOver: $('btn-records-over'),
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
  let recordsEnabled = false;

  const ui = {
    // callbacks, set by main.js
    onSaveName: null, onSkip: null, onBoardButton: null, onRecords: null,
    el,
    init(bestScore) {
      best = bestScore;
      refreshBest();
      refreshLang();
      this.showTitle();
    },
    setBest(b) { best = b; refreshBest(); },
    setRecordsEnabled(on) {
      recordsEnabled = on;
      el.recordsTitle.hidden = !on;
      el.recordsOver.hidden = !on;
    },
    showTitle() {
      el.title.hidden = false;
      el.over.hidden = true;
      el.board.hidden = true;
      el.hud.classList.add('hidden');
      el.controls.classList.remove('active');
      refreshBest();
    },
    showGame() {
      el.title.hidden = true;
      el.over.hidden = true;
      el.board.hidden = true;
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
      el.nameForm.hidden = true;
      el.saveMsg.hidden = true;
      el.btnRetry.hidden = false;
      el.recordsOver.hidden = !recordsEnabled;
      el.board.hidden = true;
      el.hud.classList.add('hidden');
      el.controls.classList.remove('active');
      el.over.hidden = false;
      // brief lock so a panicked tap on the pads can't instantly restart
      el.over.classList.add('locked');
      setTimeout(() => el.over.classList.remove('locked'), 700);
    },
    // Ask for the player's name (the score made the table).
    askName(prefill) {
      el.nameForm.hidden = false;
      el.btnRetry.hidden = true;
      el.recordsOver.hidden = true;
      el.saveMsg.hidden = true;
      $('name-prompt').textContent = t('namePrompt', { n: C.scoresTop });
      el.nameInput.value = prefill || '';
      el.btnSave.disabled = false;
      // only pop the keyboard up automatically on desktop
      if (matchMedia('(pointer: fine)').matches) setTimeout(() => el.nameInput.focus(), 50);
    },
    setSaving() {
      el.btnSave.disabled = true;
      el.saveMsg.hidden = false;
      el.saveMsg.textContent = t('saving');
    },
    // Back to the normal game over buttons, optionally with a message.
    endNameStep(messageKey) {
      el.nameForm.hidden = true;
      el.btnRetry.hidden = false;
      el.recordsOver.hidden = !recordsEnabled;
      el.saveMsg.hidden = !messageKey;
      if (messageKey) el.saveMsg.textContent = t(messageKey);
    },
    // buttonKey: i18n key of the single button ('retry' after a run, 'back' from the title)
    showBoard({ top, highlight = 0, buttonKey = 'back', messageKey = null }) {
      el.title.hidden = true;
      el.over.hidden = true;
      el.board.hidden = false;
      el.boardBtn.dataset.i18n = buttonKey;
      el.boardBtn.textContent = t(buttonKey);
      const list = el.boardList;
      list.textContent = '';
      if (messageKey || !top || !top.length) {
        const m = document.createElement('div');
        m.className = 'board-msg';
        m.textContent = t(messageKey || 'noRecords');
        list.appendChild(m);
        return;
      }
      top.forEach((r, i) => {
        const row = document.createElement('div');
        row.className = `board-row${i + 1 === highlight ? ' me' : ''}`;
        const rank = document.createElement('span');
        rank.className = 'rank';
        rank.textContent = `${i + 1}.`;
        const who = document.createElement('span');
        who.className = 'who';
        who.textContent = r.name; // textContent: a name can never inject HTML
        const pts = document.createElement('span');
        pts.className = 'pts';
        pts.textContent = r.score;
        row.append(rank, who, pts);
        list.appendChild(row);
      });
      const me = list.querySelector('.me');
      if (me) list.scrollTop = me.offsetTop - list.clientHeight / 2 + me.offsetHeight / 2;
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
    get overVisible() { return !el.over.hidden && !el.over.classList.contains('locked') && el.nameForm.hidden; },
  };
  el.nameForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = el.nameInput.value.trim();
    if (name && ui.onSaveName) ui.onSaveName(name);
  });
  $('btn-skip').addEventListener('click', () => ui.onSkip && ui.onSkip());
  el.boardBtn.addEventListener('click', () => ui.onBoardButton && ui.onBoardButton());
  el.recordsTitle.addEventListener('click', () => ui.onRecords && ui.onRecords('title'));
  el.recordsOver.addEventListener('click', () => ui.onRecords && ui.onRecords('over'));
  return ui;
}
