// Generates rows of gifts and obstacles above the screen.
//
// Fairness rule: we track R = the set of lanes the player can be in after
// passing the previous row. A new row's obstacles are only accepted if every
// lane in R still has a free lane within ONE move. So there is always a safe
// path that needs at most one lane change per row.
import { CONFIG as C } from './config.js';

const LANES = [0, 1, 2];
const rand = Math.random;
const lerp = (a, b, t) => a + (b - a) * t;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

// Hitbox half-sizes (w,h) and vertical offset from the sprite center.
const HITBOX = {
  pine: { hw: 5, hh: 5, hy: 5 },
  snowman: { hw: 5, hh: 7, hy: 1 },
  rock: { hw: 6, hh: 3, hy: 1 },
  gift: { hw: 6, hh: 6, hy: 0 },
  star: { hw: 7, hh: 7, hy: 0 },
  heart: { hw: 6, hh: 6, hy: 0 },
};

export class Spawner {
  constructor(game, startY) {
    this.g = game;
    this.lastRowY = startY;
    this.reach = [0, 1, 2];
    this.bonusRows = 0;
    this.lastStar = -999;
    this.lastHeart = -999;
  }

  queueBonus(rows) { this.bonusRows += rows; }

  update(dy) {
    const g = this.g;
    this.lastRowY += dy;
    const gap = g.baseSpeed() * lerp(C.rowGapStart, C.rowGapEnd, g.difficulty());
    while (this.lastRowY > -20 - gap * 0.5) {
      this.lastRowY -= gap;
      this.spawnRow(this.lastRowY, gap);
    }
  }

  add(kind, type, lane, y, extra = {}) {
    this.g.objects.push({
      kind, type, lane, y, ...HITBOX[kind === 'obstacle' ? type : kind], variant: 0, phase: rand() * 6, ...extra,
    });
  }

  spawnRow(y, gap) {
    const g = this.g;
    const d = g.difficulty();

    if (this.bonusRows > 0) {
      this.bonusRows--;
      LANES.forEach((l) => this.add('gift', 'gift', l, y, { variant: Math.floor(rand() * 5) }));
      this.reach = [0, 1, 2];
      return;
    }

    // --- obstacles, respecting the safe-path rule ---
    let obstacles = [];
    if (g.time >= C.graceSeconds && rand() < lerp(C.obstacleChanceStart, C.obstacleChanceEnd, d)) {
      for (let attempt = 0; attempt < 6; attempt++) {
        const count = rand() < lerp(0, C.doubleObstacleChanceEnd, d) ? 2 : 1;
        const cand = LANES.slice().sort(() => rand() - 0.5).slice(0, count);
        const free = LANES.filter((l) => !cand.includes(l));
        if (this.reach.every((r) => free.some((f) => Math.abs(f - r) <= 1))) {
          obstacles = cand;
          break;
        }
      }
    }
    const free = LANES.filter((l) => !obstacles.includes(l));
    const nextReach = free.filter((f) => this.reach.some((r) => Math.abs(f - r) <= 1));
    this.reach = nextReach;

    obstacles.forEach((l) => this.add('obstacle', pick(['pine', 'snowman', 'rock']), l, y));
    if (obstacles.length && rand() < C.giftChanceOnObstacleRow) {
      this.add('gift', 'gift', pick(nextReach), y, { variant: Math.floor(rand() * 5) });
    } else if (!obstacles.length && rand() < 0.35) {
      this.add('gift', 'gift', pick(nextReach), y, { variant: Math.floor(rand() * 5) });
    }

    // --- something between this row and the previous one ---
    const midY = y + gap / 2;
    const safeLane = () => pick(nextReach);
    const lane = rand() < C.giftRiskChance ? pick(LANES) : safeLane();
    if (g.time > C.starMinTime && g.time - this.lastStar > C.starCooldown && rand() < C.starChance) {
      this.lastStar = g.time;
      this.add('star', 'star', safeLane(), midY);
    } else if (g.lives < C.lives && g.time - this.lastHeart > C.heartCooldown && rand() < C.heartChance) {
      this.lastHeart = g.time;
      this.add('heart', 'heart', safeLane(), midY);
    } else if (rand() < C.giftChanceBetweenRows) {
      this.add('gift', 'gift', lane, midY, { variant: Math.floor(rand() * 5) });
    }
  }
}
