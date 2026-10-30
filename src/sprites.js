// Pixel art lives here as text maps: one character = one pixel.
// '.' is transparent; the other letters are looked up in a palette.
import { KAI_ROWS, KAI_PALETTE, KAI_STAR_PALETTE } from './kai.js';

export const COLORS = {
  ink: '#0d1633',
  night: '#0a1030',
  snow: '#dbe8fb',
  snowShade: '#a9bfe6',
  snowDark: '#7d97cf',
  white: '#fbfdff',
  red: '#d62839',
  redDark: '#8f1b2b',
  gold: '#ffd23f',
  goldDark: '#e0951b',
  blue: '#2f6fd0',
  blueDark: '#1f478f',
  wood: '#b07a45',
  woodDark: '#6b3f22',
  pine: '#1f6b4a',
  pineDark: '#134635',
  pineDeep: '#0c2e2b',
  rock: '#8a94aa',
  rockDark: '#5a6580',
  orange: '#ff8c2a',
};

// Shared letters (individual sprites can override any of them).
const BASE = {
  K: COLORS.ink, W: COLORS.white, w: COLORS.snowShade,
  R: COLORS.red, r: COLORS.redDark, Y: COLORS.gold, y: COLORS.goldDark,
  B: COLORS.blue, b: COLORS.blueDark, T: COLORS.wood, N: COLORS.woodDark,
  G: COLORS.pine, d: COLORS.pineDark, O: COLORS.orange,
  X: COLORS.rock, x: COLORS.rockDark,
};

export function makeSprite(rows, palette = {}, { outline = null } = {}) {
  const pal = { ...BASE, ...palette };
  const w = rows[0].length;
  const pad = outline ? 1 : 0;
  rows.forEach((r, i) => {
    if (r.length !== w) throw new Error(`Sprite row ${i} has ${r.length} chars, expected ${w}`);
  });
  const c = document.createElement('canvas');
  c.width = w + pad * 2;
  c.height = rows.length + pad * 2;
  const g = c.getContext('2d');
  if (outline) {
    g.fillStyle = outline;
    rows.forEach((r, y) => {
      for (let x = 0; x < w; x++) {
        if (r[x] === '.') continue;
        g.fillRect(x + pad - 1, y + pad, 3, 1);
        g.fillRect(x + pad, y + pad - 1, 1, 3);
      }
    });
  }
  rows.forEach((r, y) => {
    for (let x = 0; x < w; x++) {
      const ch = r[x];
      if (ch === '.') continue;
      g.fillStyle = pal[ch] || '#f0f';
      g.fillRect(x + pad, y + pad, 1, 1);
    }
  });
  return c;
}

export const toDataURL = (canvas) => canvas.toDataURL();

// ---------------------------------------------------------------- Trees ----
// Built from tiers; left half lighter, right half darker, snow on the left.
function pineRows() {
  const rows = [];
  const tiers = [[2, 8], [4, 12], [6, 16]];
  tiers.forEach(([from, to]) => {
    for (let w = from; w <= to; w += 2) {
      const first = w === from;
      let s = '';
      for (let i = 0; i < w; i++) {
        let ch = i < w / 2 ? 'G' : 'd';
        if (!first && w <= from + 2 && i < w / 2 - 1) ch = 'W';
        if (!first && w <= from + 4 && i < 1) ch = 'W';
        s += ch;
      }
      const pad = '.'.repeat((16 - w) / 2);
      rows.push(pad + s + pad);
    }
  });
  rows.push('......NNTT......', '......NNTT......');
  return rows;
}

const SNOWMAN = [
  '.....KKKK.....',
  '.....KKKK.....',
  '....RRRRRR....',
  '...KKKKKKKK...',
  '....WWWWWW....',
  '...WWKWWKWW...',
  '...WWWOOWWw...',
  '...WWWWWWWw...',
  '....RRRRRR....',
  '..WWWWWWWWWw..',
  '..WWWWKWWWWw..',
  '.WWWWWWWWWWWw.',
  '.WWWWWKWWWWWw.',
  '.WWWWWWWWWWww.',
  '.WWWWWKWWWWww.',
  '..wWWWWWWWww..',
  '....wwwwww....',
];

const ROCK = [
  '....WWWWW.....',
  '..WWWWWWWxx...',
  '.WWWXXXXXXxxx.',
  '.XXXXXXXXXxxx.',
  'XXXXXXXXXXxxxx',
  'XXXXXXXXXXxxxx',
  'XXXXXXXXXxxxxx',
  '.xxxxxxxxxxxx.',
  '..xxxxxxxxxx..',
];

const GIFT = [
  '..RR..RR..',
  '...RRRR...',
  'bbbbRRbbbb',
  'BBBBRRBBBB',
  'RRRRRRRRRR',
  'BBBBRRBBBb',
  'BBBBRRBBBb',
  'BBBBRRBBbb',
  'bbbbRRbbbb',
];

const STAR = [
  '.....YY.....',
  '.....YY.....',
  '....YYYY....',
  'YYYYYYYYYYYY',
  '.YYYWYYYYYY.',
  '..YYYYYYYY..',
  '...YYYYYY...',
  '..YYYYYYYY..',
  '..YYY..YYY..',
  '.YYY....YYY.',
  '.YY......YY.',
  'YY........YY',
];

const HEART = [
  '.RRR.RRR.',
  'RRRRRRRRR',
  'RWRRRRRRr',
  'RWRRRRRRr',
  '.RRRRRRr.',
  '..RRRRr..',
  '...RRr...',
  '....r....',
];

const SPEAKER_ON = [
  '....W.....',
  '...WW..W..',
  'WWWWW...W.',
  'WWWWW.W.W.',
  'WWWWW.W.W.',
  'WWWWW...W.',
  '...WW..W..',
  '....W.....',
];
const SPEAKER_OFF = [
  '....W.....',
  '...WW.....',
  'WWWWW.R..R',
  'WWWWW..RR.',
  'WWWWW..RR.',
  'WWWWW.R..R',
  '...WW.....',
  '....W.....',
];

function arrowRows(h = 11) {
  const rows = [];
  for (let i = 0; i < h; i++) {
    const n = Math.min(i, h - 1 - i) + 1;
    rows.push('.'.repeat(Math.ceil(h / 2) - n) + 'W'.repeat(n));
  }
  return rows;
}
const mirror = (rows) => rows.map((r) => [...r].reverse().join(''));

export const GIFT_COLORS = [
  { B: '#d62839', b: '#8f1b2b', R: '#ffd23f' },
  { B: '#2fa84f', b: '#1d7035', R: '#fbfdff' },
  { B: '#3a86ff', b: '#235bb8', R: '#ffd23f' },
  { B: '#b44fd6', b: '#7a2f94', R: '#ffd23f' },
  { B: '#ff9f1c', b: '#c4730a', R: '#d62839' },
];

const OUT = { outline: COLORS.ink };

export function buildSprites() {
  const pine = pineRows();
  const darkPine = { G: COLORS.pineDark, d: COLORS.pineDeep };
  return {
    kai: makeSprite(KAI_ROWS, KAI_PALETTE, OUT),
    kaiStar: makeSprite(KAI_ROWS, KAI_STAR_PALETTE, OUT),
    pine: makeSprite(pine, {}, OUT),
    snowman: makeSprite(SNOWMAN, {}, OUT),
    rock: makeSprite(ROCK, {}, OUT),
    gifts: GIFT_COLORS.map((p) => makeSprite(GIFT, p, OUT)),
    star: makeSprite(STAR, {}, OUT),
    heart: makeSprite(HEART, {}, OUT),
    forestPine: makeSprite(pine, darkPine),
    // UI icons (used as <img> via data URLs)
    iconGift: makeSprite(GIFT, GIFT_COLORS[0]),
    iconHeart: makeSprite(HEART),
    iconHeartOff: makeSprite(HEART, { R: '#2a3563', r: '#1b2447', W: '#3a4678' }),
    iconSoundOn: makeSprite(SPEAKER_ON),
    iconSoundOff: makeSprite(SPEAKER_OFF),
    arrowLeft: makeSprite(arrowRows(), {}),
    arrowRight: makeSprite(mirror(arrowRows()), {}),
  };
}
