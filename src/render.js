// Draws the world on a small canvas (CSS scales it up with crisp pixels).
import { COLORS, buildSprites } from './sprites.js';

const STRIP_H = 144; // height of the scrolling background tiles

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

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

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
    this.road = this.buildRoad(geo);
    this.forestL = this.buildForest(geo, geo.roadLeft, 11);
    this.forestR = this.buildForest(geo, geo.W - geo.roadLeft - geo.roadW, 23);
  }

  buildRoad({ roadW, laneW }) {
    const c = canvas(roadW, STRIP_H);
    const g = c.getContext('2d');
    const r = rng(7);
    g.fillStyle = COLORS.snow;
    g.fillRect(0, 0, roadW, STRIP_H);
    // subtle texture
    for (let i = 0; i < 70; i++) {
      g.fillStyle = r() < 0.7 ? COLORS.snowShade : COLORS.white;
      g.fillRect(Math.floor(r() * roadW), Math.floor(r() * STRIP_H), r() < 0.5 ? 2 : 1, 1);
    }
    // faint lane lines (dashed, period divides the strip height)
    g.fillStyle = COLORS.snowShade;
    for (let lane = 1; lane < 3; lane++) {
      for (let y = 0; y < STRIP_H; y += 16) g.fillRect(lane * laneW, y, 1, 6);
    }
    // snowbank at the edges
    g.fillStyle = COLORS.snowShade;
    g.fillRect(0, 0, 2, STRIP_H);
    g.fillRect(roadW - 2, 0, 2, STRIP_H);
    g.fillStyle = COLORS.snowDark;
    g.fillRect(0, 0, 1, STRIP_H);
    g.fillRect(roadW - 1, 0, 1, STRIP_H);
    return c;
  }

  buildForest(geo, w, seed) {
    const c = canvas(Math.max(1, w), STRIP_H);
    const g = c.getContext('2d');
    const r = rng(seed);
    g.fillStyle = COLORS.pineDeep;
    g.fillRect(0, 0, w, STRIP_H);
    const tree = this.sprites.forestPine;
    const trees = [];
    for (let y = -8; y < STRIP_H; y += 10) {
      trees.push({ x: Math.floor(r() * (w + 6)) - 8, y: y + Math.floor(r() * 6) });
    }
    trees.forEach((t) => {
      for (const oy of [0, -STRIP_H]) g.drawImage(tree, t.x, t.y + oy + STRIP_H);
    });
    // snow specks on the forest floor
    for (let i = 0; i < 18; i++) {
      g.fillStyle = COLORS.snowShade;
      g.fillRect(Math.floor(r() * w), Math.floor(r() * STRIP_H), 1, 1);
    }
    return c;
  }

  tile(strip, x, scroll) {
    const g = this.ctx;
    const off = Math.floor(scroll) % STRIP_H;
    for (let y = off - STRIP_H; y < this.geo.H; y += STRIP_H) g.drawImage(strip, x, y);
  }

  sprite(img, x, y) {
    this.ctx.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height / 2));
  }

  shadow(x, y, w) {
    const g = this.ctx;
    g.fillStyle = 'rgba(40,60,120,0.28)';
    g.fillRect(Math.round(x - w / 2), Math.round(y), w, 2);
  }

  draw(game, now) {
    const g = this.ctx;
    const { W, H, roadLeft, roadW } = this.geo;
    const S = this.sprites;

    g.save();
    if (game.shake > 0) {
      const m = Math.ceil(game.shake * 8);
      g.translate(Math.round((Math.random() - 0.5) * m), Math.round((Math.random() - 0.5) * m));
    }

    // background
    g.fillStyle = COLORS.night;
    g.fillRect(-4, -4, W + 8, H + 8);
    this.tile(this.road, roadLeft, game.scroll);
    this.tile(this.forestL, 0, game.scroll);
    this.tile(this.forestR, roadLeft + roadW, game.scroll);

    // trails go under everything
    for (const p of game.particles) if (p.follow) this.particle(p);

    // objects, back to front
    const objs = game.objects.slice().sort((a, b) => a.y - b.y);
    for (const o of objs) {
      const bob = o.kind === 'gift' || o.kind === 'star' || o.kind === 'heart' ? Math.round(Math.sin(now * 5 + o.phase) * 1) : 0;
      if (o.kind === 'obstacle') {
        const img = S[o.type];
        this.shadow(o.x, o.y + img.height / 2 - 3, img.width - 4);
        this.sprite(img, o.x, o.y);
      } else if (o.kind === 'gift') {
        this.shadow(o.x, o.y + 5, 9);
        this.sprite(S.gifts[o.variant], o.x, o.y + bob);
      } else {
        const img = S[o.kind];
        this.shadow(o.x, o.y + img.height / 2 - 1, 9);
        this.sprite(img, o.x, o.y + bob);
        if (Math.sin(now * 9 + o.phase) > 0.6) {
          g.fillStyle = COLORS.white;
          g.fillRect(Math.round(o.x + 5), Math.round(o.y + bob - 6), 1, 1);
          g.fillRect(Math.round(o.x - 6), Math.round(o.y + bob + 3), 1, 1);
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

    // dusk: darker toward the top
    for (let i = 0; i < 5; i++) {
      g.fillStyle = `rgba(10,16,48,${0.035 * (5 - i)})`;
      g.fillRect(0, Math.round((H * i) / 18), W, Math.ceil(H / 18));
    }

    if (game.flash > 0) {
      g.fillStyle = `rgba(214,40,57,${game.flash * 1.6})`;
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

    // blink while invincible after a hit
    if (game.invincible > 0 && Math.floor(now * 14) % 2 === 0) return;

    this.shadow(k.x, k.y + 8, 12);
    if (star) {
      g.fillStyle = 'rgba(255,210,63,0.28)';
      g.fillRect(Math.round(k.x - 12), Math.round(k.y - 9), 24, 20);
      g.fillRect(Math.round(k.x - 10), Math.round(k.y - 12), 20, 26);
    }
    const gold = star && !(game.starTime < 1.5 && Math.floor(now * 10) % 2 === 0) && Math.floor(now * 12) % 3 !== 0;
    let img = gold ? S.kaiStar : S.kai;
    if (dead) img = S.kai;
    this.sprite(img, k.x, k.y);
  }
}
