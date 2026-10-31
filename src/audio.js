// Chiptune music + sound effects, all synthesized with the Web Audio API
// (no audio files). "Jingle Bells" (J. L. Pierpont, 1857) is public domain.
import { store } from './storage.js';

const BPM = 190;
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

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = store.get('muted', false);
    this.musicOn = false;
    this.timer = null;
    this.unlocked = false;
    this.onMuteChange = null;
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

  // The "sad trombone": three sagging notes, then a long falling one with vibrato.
  sadSong() {
    const ctx = this.ctx;
    this.cut(this.sadGain);
    const out = ctx.createGain();
    out.gain.value = 0.5;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1100;
    lp.connect(out);
    out.connect(this.master);
    this.sadGain = out;
    const t0 = ctx.currentTime + 0.12;
    // [midi, start, length, glide down in semitones]
    [[63, 0, 0.55, 0.5], [62, 0.6, 0.55, 0.5], [61, 1.2, 0.55, 0.5], [60, 1.8, 2.2, 3]].forEach(([m, at, len, glide], i) => {
      const f = mtof(m);
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, t0 + at);
      o.frequency.exponentialRampToValueAtTime(f * Math.pow(2, -glide / 12), t0 + at + len);
      if (i === 3) { // wobble on the last note
        const lfo = ctx.createOscillator();
        const lg = ctx.createGain();
        lfo.frequency.value = 6;
        lg.gain.value = f * 0.012;
        lfo.connect(lg);
        lg.connect(o.frequency);
        lfo.start(t0 + at + 0.4);
        lfo.stop(t0 + at + len + 0.05);
      }
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.linearRampToValueAtTime(0.35, t0 + at + 0.04);
      g.gain.setValueAtTime(0.35, t0 + at + len * 0.7);
      g.gain.linearRampToValueAtTime(0.0001, t0 + at + len);
      o.connect(g);
      g.connect(lp);
      o.start(t0 + at);
      o.stop(t0 + at + len + 0.05);
    });
  }

  sfx(name) {
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
        this.sadSong();
        break;
      default:
    }
  }
}
