// Game state and rules. No drawing and no DOM here (see render.js / ui.js).
import { CONFIG as C } from './config.js';
import { Spawner } from './spawner.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const DEMO_SPEED = 55;

export class Game {
  constructor() {
    this.handlers = {};
    this.geo = { W: 195, H: 420, laneW: 40, roadLeft: 37, roadW: 120, kaiY: 90 };
    this.particles = [];
    this.flakes = [];
    this.scroll = 0;
    this.state = 'title'; // title | play | dying | over
    this.god = false; // debug: Kai can't be hurt
    this.kai = { lane: 1, x: 0, y: 0, fromX: 0, toX: 0, slideT: 1, sliding: false, buffer: [] };
    this.resetRun();
    this.idleTimer = 0;
  }

  // ---- tiny event emitter ---------------------------------------------
  on(name, fn) { this.handlers[name] = fn; }
  emit(name, data) { if (this.handlers[name]) this.handlers[name](data); }

  // ---- geometry --------------------------------------------------------
  setGeometry(geo) {
    this.geo = geo;
    this.kai.y = this.state === 'title' ? this.titleKaiY() : geo.kaiY;
    this.kai.x = this.laneX(this.kai.lane);
    this.kai.toX = this.kai.x;
    this.kai.sliding = false;
    this.kai.slideT = 1;
    this.flakes = [];
    for (let i = 0; i < 55; i++) {
      this.flakes.push({ x: Math.random() * geo.W, y: Math.random() * geo.H, s: 0.6 + Math.random(), big: Math.random() < 0.3 });
    }
  }

  // On the title screen Kai waits in the free space below the buttons (measured in main.js).
  titleKaiY() { return this.geo.titleKaiY ?? Math.floor(this.geo.H * 0.86); }

  laneX(l) { return this.geo.roadLeft + this.geo.laneW * (l + 0.5); }

  // ---- run lifecycle ---------------------------------------------------
  resetRun() {
    this.time = 0;
    this.distance = 0;
    this.gifts = 0;
    this.objects = [];
    this.speed = this.speed || DEMO_SPEED;
    this.starTime = 0;
    this.happyTime = 0;
    this.excitedTime = 0;
    this.superDone = false;
    this.shake = 0;
    this.flash = 0;
    this.deadTimer = 0;
    this.nextMilestone = C.milestoneEvery;
    this.spawner = null;
    this.trailTimer = 0;
  }

  startRun() {
    this.resetRun();
    this.spawner = new Spawner(this, this.geo.H * 0.6);
    this.state = 'play';
    this.kai.buffer.length = 0;
    this.emit('start');
  }

  toTitle() {
    this.resetRun();
    this.state = 'title';
  }

  // Debug: jump ahead in the current run (see README, "Previewing without playing").
  skipTo({ seconds = 0, meters = 0 } = {}) {
    if (seconds > 0) {
      const tMax = (C.speedMax - C.speedStart) / C.speedAccel; // when the top speed is reached
      const t = Math.min(seconds, tMax);
      this.distance = C.speedStart * t + (C.speedAccel * t * t) / 2 + C.speedMax * (seconds - t);
      this.time = seconds;
      this.speed = this.baseSpeed();
    }
    if (meters > 0) this.distance = Math.max(this.distance, meters * C.pxPerMeter);
    this.superDone = this.time >= C.superSpeedSeconds;
    this.nextMilestone = (Math.floor(this.meters() / C.milestoneEvery) + 1) * C.milestoneEvery;
    this.objects.length = 0;
    this.spawner = new Spawner(this, this.geo.H * 0.6); // fresh rows for the new difficulty
  }

  meters() { return Math.floor(this.distance / C.pxPerMeter); }
  score() { return this.gifts * C.giftPoints + this.meters(); }
  difficulty() { return clamp(this.time / C.rampSeconds, 0, 1); }
  // same climb as before (speedAccel), but it continues up to speedMax instead of stopping at 45 s
  baseSpeed() { return Math.min(C.speedMax, C.speedStart + C.speedAccel * this.time); }

  // ---- input -----------------------------------------------------------
  move(dir) {
    if (this.state !== 'play') return;
    const k = this.kai;
    if (k.sliding) {
      if (k.buffer.length < C.inputBuffer) k.buffer.push(dir);
      return;
    }
    this.applyMove(dir);
  }

  applyMove(dir) {
    const k = this.kai;
    const lane = clamp(k.lane + dir, 0, C.lanes - 1);
    if (lane === k.lane) return false;
    k.lane = lane;
    k.fromX = k.x;
    k.toX = this.laneX(lane);
    k.slideT = 0;
    k.sliding = true;
    return true;
  }

  updateSlide(dt) {
    const k = this.kai;
    if (!k.sliding) return;
    k.slideT += dt / (C.slideMs / 1000);
    const t = Math.min(1, k.slideT);
    k.x = lerp(k.fromX, k.toX, 1 - (1 - t) * (1 - t));
    if (t >= 1) {
      k.sliding = false;
      k.x = k.toX;
      while (k.buffer.length && !k.sliding) this.applyMove(k.buffer.shift());
    }
  }

  // ---- main update -----------------------------------------------------
  update(dt) {
    const ky = this.state === 'title' ? this.titleKaiY() : this.geo.kaiY;
    this.kai.y += (ky - this.kai.y) * Math.min(1, 6 * dt);
    this.updateFlakes(dt);
    this.updateParticles(dt);
    this.updateSlide(dt);

    if (this.state === 'title' || this.state === 'over') {
      const target = this.state === 'title' ? DEMO_SPEED : 0;
      this.speed += (target - this.speed) * Math.min(1, 3 * dt);
      this.scroll += this.speed * dt;
      this.demoKai(dt);
      this.emitTrail(dt);
      return;
    }

    const playing = this.state === 'play';
    if (playing) this.time += dt;

    // speed: eases toward its target, so hits and the final stop feel smooth
    const target = playing ? this.baseSpeed() : 0;
    this.speed += (target - this.speed) * Math.min(1, (playing ? 5 : 3.2) * dt);
    if (!playing && this.speed < 0.5) this.speed = 0;

    const dy = this.speed * dt;
    this.scroll += dy;
    this.distance += dy;
    if (playing) this.spawner.update(dy);

    for (const o of this.objects) {
      o.y -= dy; // the hill scrolls up, Kai rides down
      o.x = this.laneX(o.lane);
    }
    this.objects = this.objects.filter((o) => o.y > -40 && !o.dead);

    this.starTime = Math.max(0, this.starTime - dt);
    this.happyTime = Math.max(0, this.happyTime - dt);
    this.excitedTime = Math.max(0, this.excitedTime - dt);
    this.shake = Math.max(0, this.shake - dt);
    this.flash = Math.max(0, this.flash - dt);

    if (playing) {
      if (!this.superDone && this.time >= C.superSpeedSeconds) {
        this.superDone = true;
        this.excitedTime = C.excitedSeconds;
        this.emit('superspeed');
      }
      this.collide();
      if (this.meters() >= this.nextMilestone) {
        this.nextMilestone += C.milestoneEvery;
        this.spawner.queueBonus(C.milestoneRows);
        this.emit('milestone');
      }
    } else if (this.state === 'dying') {
      if (this.speed === 0) {
        this.deadTimer += dt;
        if (this.deadTimer > C.dyingStopSeconds) {
          this.state = 'over';
          this.emit('gameover');
        }
      }
    }
    this.emitTrail(dt);
  }

  demoKai(dt) {
    this.idleTimer -= dt;
    if (this.idleTimer <= 0 && this.state === 'title') {
      this.idleTimer = 1.1 + Math.random() * 1.2;
      const dir = this.kai.lane === 0 ? 1 : this.kai.lane === 2 ? -1 : Math.random() < 0.5 ? -1 : 1;
      this.applyMove(dir);
    }
  }

  collide() {
    const k = this.kai;
    const bonus = 3; // collecting is a bit more generous than dodging
    for (const o of this.objects) {
      if (o.dead) continue;
      const collectible = o.kind !== 'obstacle';
      const pad = collectible ? bonus : 0;
      if (
        Math.abs(o.x - k.x) < C.kaiHitW + o.hw + pad &&
        Math.abs(o.y + o.hy - (k.y + 4)) < C.kaiHitH + o.hh + pad
      ) {
        this.touch(o);
        if (this.state !== 'play') return;
      }
    }
  }

  touch(o) {
    switch (o.kind) {
      case 'gift':
        o.dead = true;
        this.gifts++;
        this.happyTime = 0.6; // Kai's eyes turn happy for a moment
        this.burst(o.x, o.y, ['#ffd23f', '#fbfdff', '#ff8c2a'], 8, 40);
        this.emit('gift');
        break;
      case 'star':
        o.dead = true;
        this.starTime = C.starSeconds;
        this.burst(o.x, o.y, ['#ffd23f', '#fbfdff'], 14, 60);
        this.emit('star');
        break;
      case 'obstacle':
        if (this.starTime > 0) {
          o.dead = true;
          this.shake = Math.max(this.shake, 0.12);
          this.burst(o.x, o.y, o.type === 'rock' ? ['#8a94aa', '#5a6580', '#fbfdff'] : o.type === 'pine' ? ['#1f6b4a', '#134635', '#fbfdff'] : ['#fbfdff', '#a9bfe6', '#ff8c2a'], 16, 80);
          this.emit('smash');
        } else if (!this.god) {
          this.hit();
        }
        break;
      default:
    }
  }

  // One hit and the run is over (the star protects you).
  hit() {
    this.shake = C.hitShakeSeconds;
    this.flash = 0.2;
    this.state = 'dying';
    this.kai.buffer.length = 0;
    this.burst(this.kai.x, this.kai.y + 4, ['#ffffff', '#b3c4f2', '#e2323f'], 18, 90);
    this.emit('hit');
  }

  // ---- particles -------------------------------------------------------
  burst(x, y, colors, n, power) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = power * (0.4 + Math.random() * 0.8);
      this.addParticle({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 10, life: 0.35 + Math.random() * 0.35,
        color: colors[Math.floor(Math.random() * colors.length)], size: Math.random() < 0.4 ? 2 : 1, grav: 60,
      });
    }
  }

  addParticle(p) {
    if (this.particles.length > 260) return;
    p.max = p.life;
    this.particles.push(p);
  }

  emitTrail(dt) {
    this.trailTimer -= dt;
    if (this.trailTimer > 0 || this.speed < 8 || this.state === 'over') return;
    this.trailTimer = 0.025;
    const k = this.kai;
    // grooves left by the runners (they start under the sled and scroll away)
    for (const side of [-12, 12]) {
      this.addParticle({
        x: k.x + side - 1, y: k.y + 8, vx: 0, vy: -this.speed, life: 0.8,
        color: '#9db2ea', size: 2, grav: 0, follow: true,
      });
    }
    // snow spray where the runners touch the ground
    if (Math.random() < 0.5) {
      const side = Math.random() < 0.5 ? -12 : 12;
      this.addParticle({
        x: k.x + side, y: k.y + 17, vx: side * 1.5 + (Math.random() - 0.5) * 10, vy: -18 - Math.random() * 14, life: 0.3,
        color: '#ffffff', size: 1, grav: 60,
      });
    }
    if (this.starTime > 0 && Math.random() < 0.6) {
      this.addParticle({
        x: k.x + (Math.random() - 0.5) * 30, y: k.y + (Math.random() - 0.5) * 36, vx: 0, vy: 10, life: 0.4,
        color: Math.random() < 0.5 ? '#ffd23f' : '#fbfdff', size: 1, grav: 0,
      });
    }
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.grav * dt;
      // trail dots are glued to the hill, so they follow the current speed
      if (p.follow) p.vy = -this.speed;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  updateFlakes(dt) {
    const { W, H } = this.geo;
    for (const f of this.flakes) {
      f.y += (22 + this.speed * 0.25) * f.s * dt;
      f.x += Math.sin((f.y + f.s * 40) / 14) * 6 * dt;
      if (f.y > H) { f.y = -2; f.x = Math.random() * W; }
    }
  }
}
