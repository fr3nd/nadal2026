// Chiptune music + sound effects, all synthesized with the Web Audio API
// (no audio files). "Jingle Bells" (J. L. Pierpont, 1857) is public domain.
import { store } from './storage.js';

const BPM = 230;
const BEAT = 60 / BPM;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// [midi note, beats] — chorus twice (16 bars), key of C.
const CHORUS_A = [
  [64, 1], [64, 1], [64, 2], [64, 1], [64, 1], [64, 2], [64, 1], [67, 1], [60, 1.5], [62, 0.5], [64, 4],
  [65, 1], [65, 1], [65, 1.5], [65, 0.5], [65, 1], [64, 1], [64, 1], [64, 0.5], [64, 0.5],
  [64, 1], [62, 1], [62, 1], [64, 1], [62, 2], [67, 2],
];
const CHORUS_B = [
  [64, 1], [64, 1], [64, 2], [64, 1], [64, 1], [64, 2], [64, 1], [67, 1], [60, 1.5], [62, 0.5], [64, 4],
  [65, 1], [65, 1], [65, 1.5], [65, 0.5], [65, 1], [64, 1], [64, 1], [64, 0.5], [64, 0.5],
  [67, 1], [67, 1], [65, 1], [62, 1], [60, 4],
];
// Bass root per bar (midi), 16 bars. 48=C3, 53=F3, 43=G2
const BASS_BARS = [48, 48, 48, 48, 53, 48, 48, 43, 48, 48, 48, 48, 53, 48, 43, 48];

function buildEvents() {
  const ev = [];
  let beat = 0;
  for (const part of [CHORUS_A, CHORUS_B]) {
    for (const [midi, dur] of part) {
      ev.push({ beat, midi, dur, voice: 'lead' });
      beat += dur;
    }
  }
  BASS_BARS.forEach((root, bar) => {
    for (let i = 0; i < 4; i++) {
      ev.push({ beat: bar * 4 + i, midi: i % 2 === 0 ? root : root + 7, dur: 0.85, voice: 'bass' });
    }
  });
  ev.sort((a, b) => a.beat - b.beat);
  return { events: ev, total: beat };
}
const SONG = buildEvents();

// The options for the sound played when Kai hits something (pick one in config.js).
export const SAD_VARIANTS = [
  { id: 1, label: 'Sad trombone', desc: 'wah, wah, wah, waaah (the current one)' },
  { id: 2, label: 'Falling slide', desc: 'arcade-style "you died" swoops' },
  { id: 3, label: 'Sad Jingle Bells', desc: 'the first bars of Jingle Bells in a minor key, slowing down' },
  { id: 4, label: 'Tape stop', desc: 'the sound winds down and sinks, like a record stopping' },
  { id: 5, label: 'Cartoon boing', desc: 'a thud and a springy boing' },
  { id: 6, label: 'Falling arpeggio', desc: 'quick notes tumbling down, then a thud' },
  { id: 7, label: 'Music box', desc: 'a soft, melancholy music-box phrase' },
];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = store.get('muted', false);
    this.musicOn = false;
    this.timer = null;
    this.unlocked = false;
    this.onMuteChange = null;
    this.sadVariant = 1;
  }

  // Must be called from a user gesture (tap / key).
  unlock() {
    if (this.unlocked) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    // iOS: play through the "playback" channel so the silent switch doesn't mute us.
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* ignore */ }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 0.6;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.unlocked = true;
    if (this.muted) this.ctx.suspend();
    else this.ctx.resume();
    if (this.wantMusic) this.startMusic();
  }

  // ---- mute / pause -------------------------------------------------------
  setMuted(m) {
    this.muted = m;
    store.set('muted', m);
    if (this.ctx) {
      this.master.gain.value = m ? 0 : 1;
      if (m) this.ctx.suspend();
      else if (!document.hidden) this.ctx.resume();
    }
    if (this.onMuteChange) this.onMuteChange(m);
  }
  toggleMute() { this.setMuted(!this.muted); }

  pause() { if (this.ctx) this.ctx.suspend(); }
  resume() { if (this.ctx && !this.muted) this.ctx.resume(); }

  // ---- music --------------------------------------------------------------
  startMusic() {
    this.wantMusic = true;
    if (!this.ctx || this.musicOn) return;
    this.cut(this.sadGain); // a new run silences the sad song
    this.musicOn = true;
    this.idx = 0;
    // a fresh gain node per run, so stopMusic() can cut every scheduled note at once
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.55;
    this.musicGain.connect(this.master);
    this.loopStart = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 40);
    this.schedule();
  }

  // Immediate stop: notes are scheduled slightly ahead, so we disconnect them all.
  stopMusic() {
    this.wantMusic = false;
    this.musicOn = false;
    clearInterval(this.timer);
    this.cut(this.musicGain);
    this.musicGain = null;
  }

  cut(node) {
    if (!node || !this.ctx) return;
    try {
      node.gain.cancelScheduledValues(this.ctx.currentTime);
      node.gain.setValueAtTime(0, this.ctx.currentTime);
      node.disconnect();
    } catch { /* already disconnected */ }
  }

  schedule() {
    const ctx = this.ctx;
    const horizon = ctx.currentTime + 0.25;
    for (;;) {
      const e = SONG.events[this.idx];
      const when = this.loopStart + e.beat * BEAT;
      if (when > horizon) break;
      if (when > ctx.currentTime - 0.05) this.note(e, Math.max(when, ctx.currentTime));
      this.idx++;
      if (this.idx >= SONG.events.length) {
        this.idx = 0;
        this.loopStart += SONG.total * BEAT;
      }
    }
  }

  note(e, when) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const lead = e.voice === 'lead';
    o.type = lead ? 'square' : 'triangle';
    o.frequency.value = mtof(lead ? e.midi + 12 : e.midi);
    const peak = lead ? 0.1 : 0.2;
    const dur = Math.max(0.06, e.dur * BEAT * (lead ? 0.92 : 1));
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(peak, when + 0.01);
    g.gain.setValueAtTime(peak * 0.8, when + dur * 0.6);
    g.gain.linearRampToValueAtTime(0.0001, when + dur);
    o.connect(g);
    g.connect(this.musicGain);
    o.start(when);
    o.stop(when + dur + 0.02);
  }

  // ---- sound effects ------------------------------------------------------
  tone(type, f0, f1, dur, vol, delay = 0, dest = null) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, vol, filterType, freq, delay = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.master);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  // ---- the "you hit something" sound: several options (see SAD_VARIANTS) -----
  // A small bus (gain -> master) so the whole sound can be cut with cut(this.sadGain).
  sadBus(cutoff = 1100) {
    const ctx = this.ctx;
    this.cut(this.sadGain);
    const out = ctx.createGain();
    out.gain.value = 0.5;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    lp.connect(out);
    out.connect(this.master);
    this.sadGain = out;
    return { lp, t0: ctx.currentTime + 0.12 };
  }

  // One note on the bus. o: {type, f0, f1, at, len, vol, vib, attack, decay}
  sadNote(bus, o) {
    const ctx = this.ctx;
    const t = bus.t0 + o.at;
    const f1 = o.f1 || o.f0;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || 'sawtooth';
    osc.frequency.setValueAtTime(o.f0, t);
    if (f1 !== o.f0) osc.frequency.exponentialRampToValueAtTime(f1, t + o.len);
    if (o.vib) { // wobble
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = 6;
      lg.gain.value = o.f0 * o.vib;
      lfo.connect(lg);
      lg.connect(osc.frequency);
      lfo.start(t + o.len * 0.2);
      lfo.stop(t + o.len + 0.05);
    }
    const vol = o.vol || 0.3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + (o.attack || 0.03));
    if (o.decay) g.gain.exponentialRampToValueAtTime(0.0001, t + o.len); // plucked / bell-like
    else {
      g.gain.setValueAtTime(vol, t + o.len * 0.7);
      g.gain.linearRampToValueAtTime(0.0001, t + o.len);
    }
    osc.connect(g);
    g.connect(bus.lp);
    osc.start(t);
    osc.stop(t + o.len + 0.05);
  }

  sadSong(variant = 1) {
    const f = mtof;
    switch (variant) {
      case 2: { // falling slide, arcade "you died" style
        const bus = this.sadBus(2500);
        [[900, 250, 0], [720, 200, 0.5], [540, 150, 1.0], [400, 55, 1.5, 0.8]].forEach(([f0, f1, at, len]) =>
          this.sadNote(bus, { type: 'square', f0, f1, at, len: len || 0.45, vol: 0.18, vib: 0.01 }));
        break;
      }
      case 3: { // "Jingle Bells" in a minor key, slow and drooping
        const bus = this.sadBus(1800);
        [[63, 0, 0.32], [63, 0.4, 0.32], [63, 0.8, 0.8], [63, 1.8, 0.32], [63, 2.2, 0.32]].forEach(([m, at, len]) =>
          this.sadNote(bus, { type: 'square', f0: f(m + 12), at, len, vol: 0.14 }));
        this.sadNote(bus, { type: 'square', f0: f(63 + 12), f1: f(59 + 12), at: 2.6, len: 1.5, vol: 0.14, vib: 0.012 });
        break;
      }
      case 4: { // tape stop: everything slows down and sinks
        const bus = this.sadBus(3000);
        this.sadNote(bus, { type: 'sawtooth', f0: f(76), f1: 38, at: 0, len: 1.5, vol: 0.2 });
        this.sadNote(bus, { type: 'square', f0: f(80), f1: 48, at: 0, len: 1.5, vol: 0.12 });
        this.noise(0.9, 0.12, 'lowpass', 700, 0.4);
        break;
      }
      case 5: { // cartoon boing
        const bus = this.sadBus(2500);
        this.noise(0.15, 0.4, 'lowpass', 600, 0.1);
        const ctx = this.ctx;
        const curve = new Float32Array(200);
        for (let i = 0; i < 200; i++) {
          const x = i / 199;
          curve[i] = 330 + 280 * Math.sin(2 * Math.PI * 9 * x) * Math.exp(-3.2 * x) - 120 * x;
        }
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueCurveAtTime(curve, bus.t0 + 0.12, 1.1);
        g.gain.setValueAtTime(0.5, bus.t0 + 0.12);
        g.gain.exponentialRampToValueAtTime(0.0001, bus.t0 + 1.3);
        o.connect(g);
        g.connect(bus.lp);
        o.start(bus.t0 + 0.12);
        o.stop(bus.t0 + 1.35);
        break;
      }
      case 6: { // falling arpeggio, then a thud
        const bus = this.sadBus(3500);
        for (let i = 0; i < 10; i++) {
          this.sadNote(bus, { type: 'square', f0: f(88 - i * 3), at: i * 0.085, len: 0.1, vol: 0.14 });
        }
        this.sadNote(bus, { type: 'sawtooth', f0: 110, f1: 45, at: 0.95, len: 0.45, vol: 0.4 });
        this.noise(0.25, 0.4, 'lowpass', 500, 1.05);
        break;
      }
      case 7: { // music box, a little melancholy
        const bus = this.sadBus(5000);
        [[76, 0], [72, 0.5], [69, 1.0], [64, 1.5], [57, 2.1]].forEach(([m, at], i) => {
          const len = i === 4 ? 2.2 : 1.1;
          this.sadNote(bus, { type: 'triangle', f0: f(m), at, len, vol: 0.4, decay: true, attack: 0.005 });
          this.sadNote(bus, { type: 'sine', f0: f(m + 12), at, len: len * 0.6, vol: 0.12, decay: true, attack: 0.005 });
          this.sadNote(bus, { type: 'triangle', f0: f(m), at: at + 0.28, len: len * 0.8, vol: 0.12, decay: true, attack: 0.005 }); // echo
        });
        break;
      }
      default: { // 1: the sad trombone
        const bus = this.sadBus(1100);
        [[63, 0, 0.55, 0.5], [62, 0.6, 0.55, 0.5], [61, 1.2, 0.55, 0.5], [60, 1.8, 2.2, 3]].forEach(([m, at, len, glide], i) =>
          this.sadNote(bus, { type: 'sawtooth', f0: f(m), f1: f(m) * Math.pow(2, -glide / 12), at, len, vol: 0.35, vib: i === 3 ? 0.012 : 0 }));
      }
    }
  }

  sfx(name, arg) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'gift':
        this.tone('square', 988, 988, 0.06, 0.12);
        this.tone('square', 1480, 1480, 0.14, 0.12, 0.06);
        break;
      case 'star':
        [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone('square', f, f, 0.1, 0.12, i * 0.07));
        break;
      case 'hit':
        this.noise(0.3, 0.7, 'lowpass', 900);
        this.tone('sawtooth', 240, 50, 0.35, 0.3);
        break;
      case 'smash':
        this.noise(0.2, 0.6, 'highpass', 1500);
        this.tone('square', 700, 180, 0.14, 0.15);
        this.tone('square', 1400, 1400, 0.08, 0.1, 0.05);
        break;
      case 'hoho':
        [196, 196, 165].forEach((f, i) => this.tone('square', f, f * 0.97, 0.16, 0.16, i * 0.22));
        break;
      case 'sad':
        this.sadSong(arg || this.sadVariant);
        break;
      default:
    }
  }
}
