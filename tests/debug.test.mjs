// The URL cheats must only work on localhost. Usage: node tests/debug.test.mjs
import assert from 'node:assert/strict';
import { readDebug } from '../src/debug.js';

const cheats = '?t=43&m=240&god&over&star';
for (const host of ['localhost', '127.0.0.1', '[::1]']) {
  const d = readDebug(cheats, host);
  assert.equal(d.on, true, host);
  assert.deepEqual([d.seconds, d.meters, d.god, d.over, d.star], [43, 240, true, true, true], host);
}
for (const host of ['nadal2026.fr3nd.net', 'fr3nd.github.io', '192.168.1.78', 'localhost.evil.com', 'evil-localhost', '127.0.0.1.nip.io', '', 'LOCALHOST.example.org']) {
  const d = readDebug(cheats, host);
  assert.equal(d.on, false, `cheats must be OFF on "${host}"`);
  assert.deepEqual([d.seconds, d.meters, d.god, d.over, d.star], [0, 0, false, false, false], host);
}
assert.equal(readDebug('', 'localhost').on, false, 'no params = off');
assert.equal(readDebug('?t=abc', 'localhost').on, false, 'garbage = off');
console.log('debug gate: ok (cheats only on localhost)');
