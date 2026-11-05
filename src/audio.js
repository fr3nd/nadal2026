// Chiptune music + sound effects, all synthesized with the Web Audio API
// (no audio files). "Jingle Bells" (J. L. Pierpont, 1857) is public domain.
import { store } from './storage.js';

export const BASE_BPM = 230;
export const SUPER_BPM = 295; // tempo after "Super Speed!"
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

// The "invincible" music while Kai has the star: an original, fast, pumping tune (arpeggios
// bouncing between octaves, a driving bass and a drum beat). Key of A minor, 8 bars, 172 BPM.
export const STAR_BPM = 172;
function buildStarSong() {
  const ev = [];
  const chords = [[69, 72, 76], [65, 69, 72], [60, 64, 67], [67, 71, 74], [69, 72, 76], [65, 69, 72], [67, 71, 74], [64, 68, 71]]; // Am F C G Am F G E
  const roots = [45, 41, 36 + 12, 43, 45, 41, 43, 40];
  const fills = { // bars 4 and 8: fast 16th-note runs
    3: [67, 71, 74, 79, 83, 86, 83, 79, 74, 71, 67, 71, 74, 79, 83, 79],
    7: [76, 80, 83, 88, 83, 80, 76, 71, 76, 80, 83, 88, 92, 88, 83, 80],
  };
  chords.forEach((ch, bar) => {
    const b0 = bar * 4;
    if (fills[bar]) {
      fills[bar].forEach((m, i) => ev.push({ beat: b0 + i * 0.25, midi: m, dur: 0.25, voice: 'pump' }));
    } else {
      const hi = ch[0] + 12;
      [ch[0], hi, ch[1], hi, ch[2], hi, ch[1], hi].forEach((m, i) => ev.push({ beat: b0 + i * 0.5, midi: m, dur: 0.5, voice: 'pump' }));
    }
    [0, 12, 0, 12, 0, 12, 7, 12].forEach((o, i) => ev.push({ beat: b0 + i * 0.5, midi: roots[bar] + o, dur: 0.5, voice: 'sbass' }));
    for (let i = 0; i < 8; i++) ev.push({ beat: b0 + i * 0.5, midi: 0, dur: 0.25, voice: 'hat', accent: i % 2 === 1 });
    [0, 2].forEach((b) => ev.push({ beat: b0 + b, midi: 0, dur: 0.2, voice: 'kick' }));
    [1, 3].forEach((b) => ev.push({ beat: b0 + b, midi: 0, dur: 0.2, voice: 'snare' }));
  });
  ev.sort((a, b) => a.beat - b.beat);
  return { events: ev, total: 32 };
}
const STAR_SONG = buildStarSong();

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = store.get('muted', false);
    this.musicOn = false;
    this.timer = null;
    this.unlocked = false;
    this.onMuteChange = null;
    this.bpm = BASE_BPM;
    this.mainBpm = BASE_BPM; // tempo of the main song (the star song has its own)
    this.song = SONG;
    this.starWanted = false;
  }

  // Must be called from a user gesture (tap / key).
  unlock() {
    if (this.unlocked) { // a page that autostarted may still be waiting for a first tap
      if (this.ctx.state === 'suspended' && !this.muted && !document.hidden) this.ctx.resume();
      return;
    }
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
  // A fresh gain node per song/run, so everything scheduled on it can be cut at once.
  newMusicBus() {
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.55;
    this.musicGain.connect(this.master);
  }

  startMusic() {
    this.wantMusic = true;
    if (!this.ctx || this.musicOn) return;
    this.cut(this.sadGain); // a new run silences the sad song
    this.musicOn = true;
    this.idx = 0;
    this.loopIndex = 0;
    this.newMusicBus();
    // tempo-proof timeline: beat B plays at anchorTime + (B - anchorBeat) * secondsPerBeat
    this.anchorTime = this.ctx.currentTime + 0.1;
    this.anchorBeat = 0;
    this.song = this.starWanted ? STAR_SONG : SONG;
    this.bpm = this.starWanted ? STAR_BPM : this.mainBpm;
    this.timer = setInterval(() => this.schedule(), 40);
    this.schedule();
  }

  // Change the tempo of the main song while playing, without a jump.
  setTempo(bpm) {
    this.mainBpm = bpm;
    if (this.song !== SONG) return; // the star song keeps its own tempo; the main one picks this up later
    if (this.ctx && this.musicOn) {
      const now = this.ctx.currentTime;
      this.anchorBeat += Math.max(0, now - this.anchorTime) / (60 / this.bpm);
      this.anchorTime = Math.max(now, this.anchorTime);
    }
    this.bpm = bpm;
  }

  // Switch to the energetic star music, or back to the main song where it left off.
  setStarMusic(on) {
    this.starWanted = on;
    if (!this.ctx || !this.musicOn) return; // startMusic() will pick it up
    if (on === (this.song === STAR_SONG)) return;
    const now = this.ctx.currentTime;
    if (on) {
      // remember where the main song was, to resume there afterwards
      this.mainBeat = this.anchorBeat + Math.max(0, now - this.anchorTime) / (60 / this.bpm);
      this.cut(this.musicGain);
      this.newMusicBus();
      this.song = STAR_SONG;
      this.bpm = STAR_BPM;
      this.idx = 0;
      this.loopIndex = 0;
      this.anchorBeat = 0;
      this.anchorTime = now + 0.45; // after the pick-up jingle
    } else {
      this.cut(this.musicGain);
      this.newMusicBus();
      this.song = SONG;
      this.bpm = this.mainBpm;
      const beat = this.mainBeat || 0;
      this.loopIndex = Math.floor(beat / SONG.total);
      const within = beat - this.loopIndex * SONG.total;
      this.idx = SONG.events.findIndex((e) => e.beat >= within);
      if (this.idx < 0) { this.idx = 0; this.loopIndex++; }
      this.anchorBeat = beat;
      this.anchorTime = now + 0.12;
    }
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
      const song = this.song;
      const e = song.events[this.idx];
      const beat = this.loopIndex * song.total + e.beat;
      const when = this.anchorTime + (beat - this.anchorBeat) * (60 / this.bpm);
      if (when > horizon) break;
      if (when > ctx.currentTime - 0.05) this.note(e, Math.max(when, ctx.currentTime));
      this.idx++;
      if (this.idx >= song.events.length) {
        this.idx = 0;
        this.loopIndex++;
      }
    }
  }

  note(e, when) {
    const ctx = this.ctx;
    const delay = Math.max(0, when - ctx.currentTime);
    // drums of the star song
    if (e.voice === 'kick') { this.tone('sine', 160, 45, 0.13, 0.55, delay, this.musicGain); return; }
    if (e.voice === 'snare') {
      this.noise(0.1, 0.25, 'bandpass', 1800, delay, this.musicGain);
      this.tone('triangle', 200, 120, 0.07, 0.2, delay, this.musicGain);
      return;
    }
    if (e.voice === 'hat') { this.noise(0.035, e.accent ? 0.1 : 0.05, 'highpass', 7500, delay, this.musicGain); return; }
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const lead = e.voice === 'lead';
    const pump = e.voice === 'pump'; // star song lead: short, punchy square notes
    o.type = lead || pump ? 'square' : 'triangle';
    o.frequency.value = mtof(lead ? e.midi + 12 : e.midi);
    const peak = lead ? 0.1 : pump ? 0.085 : 0.2;
    const dur = Math.max(0.05, e.dur * (60 / this.bpm) * (lead ? 0.92 : pump ? 0.78 : 1));
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

  noise(dur, vol, filterType, freq, delay = 0, dest = null) {
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
    g.connect(dest || this.master);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  // ---- the "you hit something" sound -----------------------------------------
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

  // The "you hit something" sound: a quick arpeggio tumbling down, then a thud.
  sadSong() {
    const bus = this.sadBus(3500);
    for (let i = 0; i < 10; i++) {
      this.sadNote(bus, { type: 'square', f0: mtof(88 - i * 3), at: i * 0.085, len: 0.1, vol: 0.14 });
    }
    this.sadNote(bus, { type: 'sawtooth', f0: 110, f1: 45, at: 0.95, len: 0.45, vol: 0.4 });
    this.noise(0.25, 0.4, 'lowpass', 500, 1.05);
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
      case 'superspeed': // rising arpeggio, a sweep and a whoosh
        [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => this.tone('square', f, f, 0.1, 0.1, i * 0.045));
        this.tone('sawtooth', 120, 900, 0.5, 0.1);
        this.noise(0.7, 0.2, 'highpass', 1800, 0.05);
        break;
      case 'sad':
        this.sadSong();
        break;
      default:
    }
  }
}
