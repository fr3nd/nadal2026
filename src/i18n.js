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
}

export const applyI18n = apply;
