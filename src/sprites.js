// All pixel art is painted from shapes (see pixart.js) in a "Minish Cap"
// style: round chunky forms, 3-tone shading, colored outlines.
import { Pix, fromRows, lighten, darken, mix } from './pixart.js';
import { drawKai } from './kai.js';

export const COLORS = {
  ink: '#14183f',
  night: '#182247',
  snow: '#dbe7ff',
  snowLight: '#f2f7ff',
  snowShade: '#b3c4f2',
  snowDeep: '#8aa0e3',
  bank: '#6f86d4',
  white: '#ffffff',
  cream: '#fff3cf',
  red: '#e2323f',
  gold: '#ffd23f',
  forestFloor: '#1f4d47',
  forestFloorLight: '#2a655a',
  pine: '#2f9461',
  pineDark: '#1d6a4a',
  pineDeep: '#154b3e',
  wood: '#8a5a3a',
  rock: '#9aa6c4',
  orange: '#ff9a2e',
};

const GIFT_COLORS = ['#e2323f', '#2fae5a', '#3b82f0', '#b25ad6', '#ff9a2e'];

function pine({ green = COLORS.pine, snow = COLORS.white, trunk = COLORS.wood, snowy = true, size = 1 } = {}) {
  const p = new Pix(30, 40);
  p.box(12, 31, 6, 7, trunk, { round: 1 });
  const tiers = [[15, 27, 13, 6.5], [15, 20, 10.5, 6], [15, 13, 8, 5.5], [15, 7.5, 5, 5]];
  tiers.forEach(([cx, cy, rx, ry], i) => {
    p.blob(cx, cy, rx, ry, green);
    if (snowy) p.blob(cx - 1, cy - ry * 0.4, rx * 0.86, ry * 0.68, snow, { line: false, dark: '#c9d8fb' });
    if (snowy && i === 3) p.blob(15, 4.2, 2.6, 2, snow, { line: false });
  });
  return p.outlined();
}

function snowman() {
  const p = new Pix(26, 38);
  const oy = 4;
  // stick arms
  const arm = '#6b4a38';
  p.line(5, oy + 19, 0, oy + 14, arm); p.line(5, oy + 19, 1, oy + 18, arm); p.line(1, oy + 14, 1, oy + 11, arm);
  p.line(21, oy + 19, 26, oy + 14, arm); p.line(21, oy + 19, 25, oy + 18, arm); p.line(25, oy + 14, 25, oy + 11, arm);
  p.blob(13, oy + 26, 9.5, 7, COLORS.white, { dark: '#c3d2f6' });
  p.blob(13, oy + 19, 7.5, 5.5, COLORS.white, { dark: '#c3d2f6' });
  [[13, 18], [13, 21], [13, 24]].forEach(([x, y]) => p.rect(x - 0.5, oy + y, 2, 2, '#3a2f55'));
  // head, scarf
  p.blob(13, oy + 9, 7.5, 6.5, COLORS.white, { dark: '#c3d2f6' });
  p.blob(13, oy + 16, 7.5, 2, COLORS.red);
  p.box(17, oy + 16, 3, 6, COLORS.red, { round: 1 });
  // face
  p.rect(9, oy + 6, 2, 3, '#2b1d3f'); p.rect(15, oy + 6, 2, 3, '#2b1d3f');
  p.set(9, oy + 6, '#fff'); p.set(15, oy + 6, '#fff');
  p.poly([[12, oy + 9], [14, oy + 9], [14, oy + 11.5], [12, oy + 11.5], [18, oy + 11]], COLORS.orange, { line: '#9a4a12', shade: false });
  [[9, 12], [10, 13], [12, 13.5], [14, 13.5], [16, 12]].forEach(([x, y]) => p.set(x, oy + y, '#4a3a66'));
  // top hat
  p.box(5, oy + 1, 16, 3, '#3a3358', { round: 1 });
  p.box(8, oy - 3, 10, 5, '#4a4270', { round: 1 });
  p.rect(8, oy, 10, 1, COLORS.red);
  return p.outlined();
}

function rock() {
  const p = new Pix(30, 22);
  p.blob(16, 14, 12, 7, COLORS.rock, { dark: '#6f7ba2' });
  p.blob(8, 15, 7, 5, mix(COLORS.rock, '#8c7aa8', 0.25), { dark: '#6f7ba2' });
  p.blob(19, 8, 7, 3, COLORS.white, { line: false, dark: '#c3d2f6' });
  p.blob(9, 11, 4, 1.8, COLORS.white, { line: false, dark: '#c3d2f6' });
  p.line(15, 13, 17, 17, '#58628b');
  p.line(17, 17, 15, 18, '#58628b');
  return p.outlined();
}

function gift(color) {
  const p = new Pix(18, 18);
  const light = lighten(color, 0.3);
  p.box(2, 8, 14, 9, color, { round: 1 });
  p.box(1, 5, 16, 5, light, { round: 1, light: lighten(light, 0.4) });
  p.box(8, 5, 3, 12, COLORS.gold, { round: 0, light: '#fff1a0' });
  p.blob(6, 3, 3.2, 2.4, COLORS.gold);
  p.blob(12, 3, 3.2, 2.4, COLORS.gold);
  p.rect(8, 3, 3, 3, '#e0951b');
  p.set(4, 9, '#ffffff'); p.set(4, 10, '#ffffff');
  return p.outlined();
}

function star() {
  const p = new Pix(24, 24);
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 10.5 : 4.6;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push([12 + Math.cos(a) * r, 12.5 + Math.sin(a) * r]);
  }
  p.poly(pts, COLORS.gold, { light: '#fff08a', dark: '#f0a21e' });
  p.set(9, 9, '#ffffff'); p.set(10, 8, '#ffffff'); p.set(9, 10, '#fff7c2');
  p.rect(10, 12, 2, 2, '#2b1d3f'); p.rect(14, 12, 2, 2, '#2b1d3f');
  p.set(10, 12, '#fff'); p.set(14, 12, '#fff');
  p.rect(12, 15, 2, 1, '#9a3b4a');
  return p.outlined();
}

const SPEAKER_ON = [
  '....W.....', '...WW..W..', 'WWWWW...W.', 'WWWWW.W.W.', 'WWWWW.W.W.', 'WWWWW...W.', '...WW..W..', '....W.....',
];
const SPEAKER_OFF = [
  '....W.....', '...WW.....', 'WWWWW.R..R', 'WWWWW..RR.', 'WWWWW..RR.', 'WWWWW.R..R', '...WW.....', '....W.....',
];

function arrow(dir) {
  const p = new Pix(12, 20);
  const pts = dir < 0 ? [[10, 1], [10, 19], [1, 10]] : [[2, 1], [2, 19], [11, 10]];
  p.poly(pts, '#fff3cf', { line: '#7a4a1e', shade: false });
  return p;
}

// Everything as Pix objects (no DOM) — handy for previews.
export function buildPix() {
  const darkForest = { green: '#1f6b4c', snow: '#cfe0ff', trunk: '#5a3b2a' };
  return {
    kai: drawKai('normal'),
    kaiStar: drawKai('star'),
    kaiHurt: drawKai('hurt'),
    pine: pine(),
    snowman: snowman(),
    rock: rock(),
    gifts: GIFT_COLORS.map(gift),
    star: star(),
    forestPine: pine(darkForest),
    forestPineLight: pine({ green: '#2f8a5d', snow: '#e6f0ff', trunk: '#6a4630' }),
    iconGift: gift(GIFT_COLORS[0]),
    iconSoundOn: fromRows(SPEAKER_ON, { W: '#fff3cf' }),
    iconSoundOff: fromRows(SPEAKER_OFF, { W: '#fff3cf', R: '#ff6b6b' }),
    arrowLeft: arrow(-1),
    arrowRight: arrow(1),
  };
}

export function buildSprites() {
  const px = buildPix();
  const out = {};
  for (const [k, v] of Object.entries(px)) out[k] = Array.isArray(v) ? v.map((x) => x.toCanvas()) : v.toCanvas();
  return out;
}

export const toDataURL = (canvas) => canvas.toDataURL();
export { darken };
