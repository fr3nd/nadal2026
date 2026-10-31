// Every text of the game lives here. To add a language (e.g. Spanish):
// add an entry to STRINGS and its code to LANGS. The switch builds itself.
import { store } from './storage.js';

export const LANGS = ['en', 'ca'];

export const STRINGS = {
  en: {
    pageTitle: "Kai's Sled – Merry Christmas 2026",
    title: "Kai's Sled",
    subtitle: 'Merry Christmas 2026',
    hint: 'Swipe or tap the arrows to change lane. Collect gifts and dodge the obstacles!',
    play: 'Play',
    best: 'Best: {n}',
    hoho: 'Ho ho ho!',
    gameOver: 'Game over',
    gifts: 'Gifts',
    meters: 'Meters',
    score: 'Score',
    bestLabel: 'Best',
    newRecord: 'New record!',
    retry: 'Try again',
    unitM: 'm',
    left: 'Move left',
    right: 'Move right',
    soundOn: 'Sound on',
    soundOff: 'Sound off',
    language: 'Language',
    records: 'High scores',
    back: 'Back',
    loading: 'Loading…',
    noRecords: 'No records yet. Be the first!',
    namePrompt: 'You made the top {n}! Enter your name:',
    yourName: 'Your name',
    save: 'Save',
    skip: 'Skip',
    saving: 'Saving…',
    scoreError: 'Could not save your score. Try again later.',
    tableError: 'Could not load the records.',
    youAre: 'You are number {n}!',
  },
  ca: {
    pageTitle: 'El Trineu del Kai – Bon Nadal 2026',
    title: 'El Trineu del Kai',
    subtitle: 'Bon Nadal 2026',
    hint: 'Llisca el dit o toca les fletxes per canviar de carril. Col·lecciona regals i esquiva els obstacles!',
    play: 'Juga',
    best: 'Rècord: {n}',
    hoho: 'Ho ho ho!',
    gameOver: 'Fi de la partida',
    gifts: 'Regals',
    meters: 'Metres',
    score: 'Punts',
    bestLabel: 'Rècord',
    newRecord: 'Nou rècord!',
    retry: 'Torna-ho a provar',
    unitM: 'm',
    left: 'Mou a l’esquerra',
    right: 'Mou a la dreta',
    soundOn: 'Activa el so',
    soundOff: 'Silencia el so',
    language: 'Idioma',
    records: 'Rècords',
    back: 'Enrere',
    loading: 'Carregant…',
    noRecords: 'Encara no hi ha cap rècord. Sigues el primer!',
    namePrompt: 'Has entrat al top {n}! Escriu el teu nom:',
    yourName: 'El teu nom',
    save: 'Desa',
    skip: 'Omet',
    saving: 'Desant…',
    scoreError: 'No s’ha pogut desar la puntuació. Torna-ho a provar més tard.',
    tableError: 'No s’han pogut carregar els rècords.',
    youAre: 'Ets el número {n}!',
  },
};

let lang = 'en';
const listeners = [];

function detect() {
  const list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
  return list.some((l) => /^ca(-|_|$)/i.test(l)) ? 'ca' : 'en';
}

export function initLang() {
  const saved = store.get('lang', null);
  lang = LANGS.includes(saved) ? saved : detect();
  apply();
}

export const getLang = () => lang;

export function setLang(l) {
  if (!LANGS.includes(l) || l === lang) return;
  lang = l;
  store.set('lang', l);
  apply();
  listeners.forEach((fn) => fn(l));
}

export const onLangChange = (fn) => listeners.push(fn);

export function t(key, vars = {}) {
  const s = (STRINGS[lang] && STRINGS[lang][key]) ?? STRINGS.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : ''));
}

// Elements use data-i18n="key" (text) and data-i18n-label="key" (aria-label).
function apply() {
  document.documentElement.lang = lang;
  document.title = t('pageTitle');
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-label]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nLabel));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder));
  });
}

export const applyI18n = apply;
