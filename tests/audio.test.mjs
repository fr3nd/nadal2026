// Music switching (main song <-> star song), against a mock of the Web Audio API.
// Usage: node tests/audio.test.mjs
import assert from 'node:assert/strict';

let now = 1;
const events = []; // everything started: {kind, when, freq, bus}
const disconnected = new Set();
const mkNode = (kind) => {
  const n = { kind, id: Math.random(), freq: 0, outs: [] };
  n.gain = { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} };
  n.frequency = { set value(v) { n.freq = v; }, get value() { return n.freq; }, setValueAtTime(v) { n.freq = v; }, exponentialRampToValueAtTime() {} };
  n.connect = (to) => { n.outs.push(to); return to; };
  n.disconnect = () => { disconnected.add(n); };
  n.start = (when) => { events.push({ kind, when, freq: n.freq, node: n }); };
  n.stop = () => {};
  return n;
};
class Ctx {
  constructor() { this.sampleRate = 8000; this.destination = {}; }
  get currentTime() { return now; }
  createGain() { return mkNode('gain'); }
  createOscillator() { return mkNode('osc'); }
  createBiquadFilter() { return mkNode('filter'); }
  createBufferSource() { return mkNode('noise'); }
  createBuffer() { return { getChannelData: () => new Float32Array(10) }; }
  suspend() {} resume() {}
}
globalThis.window = { AudioContext: Ctx };
globalThis.document = { hidden: false };
globalThis.localStorage = { getItem: () => null, setItem() {} };
const { AudioEngine, STAR_BPM } = await import('../src/audio.js');

const step = (sec) => { const end = now + sec; while (now < end) { now += 0.04; a.schedule(); } };
// which music bus does a started node end up on? (walk its outputs until the music gain)
const busOf = (node) => {
  const seen = new Set(); const walk = (n) => { if (!n || seen.has(n)) return null; seen.add(n); if (n === a.musicGain) return 'current'; for (const o of n.outs) { const r = walk(o); if (r) return r; } return null; };
  return walk(node);
};

const a = new AudioEngine();
a.unlock(); a.startMusic();
const leadFreqs = () => events.filter((e) => e.kind === 'osc' && e.freq > 300).map((e) => Math.round(e.freq));

// 1. main song plays
step(5);
const mainBefore = events.filter((e) => e.kind === 'osc').length;
assert.ok(mainBefore > 10, 'main song is scheduling notes');
const lastMainFreqs = leadFreqs().slice(-6);

// 2. star: the old music is cut at once, the star song starts after the pick-up jingle
const tStar = now; events.length = 0; disconnected.clear();
const oldBus = a.musicGain;
a.setStarMusic(true);
assert.ok(disconnected.has(oldBus), 'the main music bus is disconnected immediately');
assert.notEqual(a.musicGain, oldBus, 'the star song uses a fresh bus');
step(3);
const starStarts = events.filter((e) => e.kind === 'osc' || e.kind === 'noise');
assert.ok(starStarts.length > 20, 'star song (notes + drums) is playing');
assert.ok(Math.min(...starStarts.map((e) => e.when)) >= tStar + 0.44, 'star music waits for the pick-up jingle (0.45 s)');
assert.ok(events.some((e) => e.kind === 'noise'), 'drums (noise: hats, snare) are playing');
assert.equal(a.bpm, STAR_BPM);

// 3. the star song loops (8 bars at 172 BPM = 11.2 s)
step(13);
const times = events.filter((e) => e.kind === 'osc').map((e) => e.when);
assert.ok(Math.max(...times) > tStar + 12.5, 'the star song keeps looping past its length');

// 4. a tempo change during the star (Super Speed) must not touch the star tempo, only the main song's
a.setTempo(295);
assert.equal(a.bpm, STAR_BPM, 'star tempo unchanged by Super Speed');

// 5. star ends: back to the main song, resumed where it was, at the (new) main tempo
const tEnd = now; events.length = 0;
const starBus = a.musicGain;
a.setStarMusic(false);
assert.ok(disconnected.has(starBus), 'the star bus is cut when the star ends');
assert.equal(a.bpm, 295, 'main song comes back at the Super Speed tempo');
step(2);
const resumed = events.filter((e) => e.kind === 'osc');
assert.ok(resumed.length > 3, 'main song is playing again');
assert.ok(Math.min(...resumed.map((e) => e.when)) >= tEnd + 0.1, 'resumes shortly after the switch');
assert.ok(events.every((e) => e.kind !== 'noise'), 'no drums in the main song');

// 6. stopMusic cuts whatever is playing (the hit)
const cur = a.musicGain; a.stopMusic();
assert.ok(disconnected.has(cur), 'stopMusic cuts the current bus');

// 7. star picked up before the music started: it starts straight into the star song
const b = new AudioEngine(); b.unlock(); b.setStarMusic(true); b.startMusic();
assert.equal(b.bpm, STAR_BPM, 'starts directly with the star song');
b.setStarMusic(false); assert.equal(b.bpm, 230, 'and returns to the main song');
b.stopMusic();

console.log('audio: ok (star song starts, loops, and hands back to the main song)');
process.exit(0);
