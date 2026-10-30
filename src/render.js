// Draws the world on a small canvas (CSS scales it up with crisp pixels).
// The hill scrolls UP the screen; Kai rides down it, near the top.
import { COLORS, buildSprites } from './sprites.js';

const STRIP_H = 192; // height of the scrolling background tile

// Small deterministic random so the forest looks the same on every resize.
function rng(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const canvas = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

export class Renderer {
  constructor(el) {
    this.el = el;
    this.ctx = el.getContext('2d');
    this.sprites = buildSprites();
  }

  resize(geo) {
    this.geo = geo;
    this.el.width = geo.W;
    this.el.height = geo.H;
    this.ctx.imageSmoothingEnabled = false;
    this.bg = this.buildBackground(geo);
  }

  // One full-width tile: forest floor, wavy snowy road, trees on both sides.
  buildBackground({ W, roadLeft, roadW, laneW }) {
    const c = canvas(W, STRIP_H);
    const g = c.getContext('2d');
    const r = rng(7);
    const px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); };

    // forest floor
    px(0, 0, W, STRIP_H, COLORS.forestFloor);
    for (let i = 0; i < W * 1.2; i++) px(r() * W, r() * STRIP_H, 2, 1, COLORS.forestFloorLight);

    // road with wobbly banks (the wobble repeats exactly once per tile)
    const wob = (y, phase) =>
      Math.round(2.4 * Math.sin(((y * 2) / STRIP_H) * Math.PI * 2 + phase) + 1.4 * Math.sin(((y * 5) / STRIP_H) * Math.PI * 2 + phase * 2));
    for (let y = 0; y < STRIP_H; y++) {
      const xl = roadLeft + wob(y, 0);
      const xr = roadLeft + roadW + wob(y, 2);
      px(xl - 1, y, 1, 1, COLORS.bank);
      px(xr, y, 1, 1, COLORS.bank);
      px(xl, y, xr - xl, 1, COLORS.snow);
      px(xl, y, 3, 1, COLORS.snowShade);
      px(xr - 3, y, 3, 1, COLORS.snowShade);
      px(xl, y, 1, 1, COLORS.snowLight);
    }
    // snow tufts, sparkles
    for (let i = 0; i < 38; i++) {
      const x = roadLeft + 6 + r() * (roadW - 14);
      const y = r() * STRIP_H;
      px(x, y + 1, 1, 1, COLORS.snowShade); px(x + 1, y, 2, 1, COLORS.snowShade); px(x + 3, y + 1, 1, 1, COLORS.snowShade);
    }
    for (let i = 0; i < 16; i++) {
      const x = roadLeft + 6 + r() * (roadW - 12);
      const y = r() * STRIP_H;
      px(x, y, 1, 1, COLORS.white); px(x - 1, y, 3, 1, COLORS.snowLight); px(x, y - 1, 1, 3, COLORS.snowLight);
    }
    // faint lane dots
    for (let lane = 1; lane < 3; lane++) {
      for (let y = 0; y < STRIP_H; y += 12) px(roadLeft + lane * laneW, y, 1, 4, '#c3d2f8');
    }

    // trees on both sides, back to front, wrapped so the tile repeats
    const sideW = Math.max(roadLeft - 6, 10);
    const trees = [];
    for (let y = 0; y < STRIP_H; y += 17) {
      trees.push({ x: -6 + r() * (sideW - 6), y: y + r() * 6, s: r() < 0.5 ? 0 : 1 });
      trees.push({ x: W - sideW - 8 + r() * (sideW - 6), y: y + 8 + r() * 6, s: r() < 0.5 ? 0 : 1 });
    }
    trees.sort((a, b) => a.y - b.y);
    for (const t of trees) {
      const img = t.s ? this.sprites.forestPineLight : this.sprites.forestPine;
      for (const oy of [-STRIP_H, 0]) g.drawImage(img, Math.round(t.x), Math.round(t.y + oy));
    }
    return c;
  }

  sprite(img, x, y) {
    this.ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2));
  }

  shadow(x, y, w) {
    const g = this.ctx;
    g.fillStyle = 'rgba(50,70,170,0.34)';
    g.fillRect(Math.round(x - w / 2 + 2), Math.round(y - 1), w - 4, 1);
    g.fillRect(Math.round(x - w / 2), Math.round(y), w, 2);
    g.fillRect(Math.round(x - w / 2 + 2), Math.round(y + 2), w - 4, 1);
  }

  draw(game, now) {
    const g = this.ctx;
    const { W, H } = this.geo;
    const S = this.sprites;

    g.save();
    if (game.shake > 0) {
      const m = Math.ceil(game.shake * 10);
      g.translate(Math.round((Math.random() - 0.5) * m), Math.round((Math.random() - 0.5) * m));
    }

    // ground scrolls upward
    const off = Math.floor(game.scroll) % STRIP_H;
    for (let y = -off; y < H; y += STRIP_H) g.drawImage(this.bg, 0, y);

    // sled trails, under everything
    for (const p of game.particles) if (p.follow) this.particle(p);

    // objects, back to front
    const objs = game.objects.slice().sort((a, b) => a.y - b.y);
    for (const o of objs) {
      if (o.y > H + 40) continue;
      if (o.kind === 'obstacle') {
        const img = S[o.type];
        this.shadow(o.x, o.y + img.height / 2 - 3, img.width - 6);
        this.sprite(img, o.x, o.y);
      } else {
        const bob = Math.round(Math.sin(now * 5 + o.phase) * 1.5);
        const img = o.kind === 'gift' ? S.gifts[o.variant] : S.star;
        this.shadow(o.x, o.y + img.height / 2 + 2, 12);
        this.sprite(img, o.x, o.y + bob);
        if (Math.sin(now * 9 + o.phase) > 0.65) {
          g.fillStyle = COLORS.white;
          g.fillRect(Math.round(o.x + 7), Math.round(o.y + bob - 8), 1, 3);
          g.fillRect(Math.round(o.x + 6), Math.round(o.y + bob - 7), 3, 1);
        }
      }
    }

    this.kai(game, now);
    for (const p of game.particles) if (!p.follow) this.particle(p);

    // snowfall in front
    g.fillStyle = COLORS.white;
    for (const f of game.flakes) {
      const s = f.big ? 2 : 1;
      g.fillRect(Math.round(f.x), Math.round(f.y), s, s);
    }
    g.restore();

    // things fade in from a dusky haze at the bottom
    const steps = 16;
    const bandH = Math.ceil(H / 40);
    for (let i = 0; i < steps; i++) {
      g.fillStyle = `rgba(24,34,71,${0.022 * (i + 1)})`;
      g.fillRect(0, H - bandH * (steps - i), W, bandH);
    }

    if (game.flash > 0) {
      g.fillStyle = `rgba(255,255,255,${Math.min(0.7, game.flash * 3.5)})`;
      g.fillRect(0, 0, W, H);
    }
  }

  particle(p) {
    const g = this.ctx;
    g.globalAlpha = Math.min(1, (p.life / p.max) * 1.6);
    g.fillStyle = p.color;
    g.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    g.globalAlpha = 1;
  }

  kai(game, now) {
    const g = this.ctx;
    const k = game.kai;
    const S = this.sprites;
    const star = game.starTime > 0;
    const dead = game.state === 'dying' || game.state === 'over';

    // contact shadow right under the runners, so the sled sits on the snow
    this.shadow(k.x, k.y + 19, 36);
    if (star) {
      // golden aura
      g.fillStyle = 'rgba(255,210,63,0.25)';
      for (let dy = -26; dy <= 26; dy += 2) {
        const w = Math.round(Math.sqrt(1 - (dy / 27) ** 2) * 24);
        g.fillRect(Math.round(k.x - w), Math.round(k.y + dy), w * 2, 2);
      }
    }
    // blink between normal and golden; in its last 1.5 s it flickers faster
    const ending = star && game.starTime < 1.5;
    const gold = star && (ending ? Math.floor(now * 12) % 2 === 0 : Math.floor(now * 8) % 4 !== 0);
    const happy = game.happyTime > 0;
    let img = gold ? (happy ? S.kaiStarHappy : S.kaiStar) : (happy ? S.kaiHappy : S.kai);
    if (dead) img = S.kaiHurt;
    this.sprite(img, k.x, k.y);

    if (dead) {
      // dizzy stars circling his head
      g.fillStyle = COLORS.gold;
      for (let i = 0; i < 3; i++) {
        const a = now * 5 + (i * Math.PI * 2) / 3;
        g.fillRect(Math.round(k.x + Math.cos(a) * 16), Math.round(k.y - 22 + Math.sin(a) * 4), 3, 3);
      }
    }
  }
}
