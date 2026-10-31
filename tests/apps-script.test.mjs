// Runs apps-script/Code.gs in Node against a tiny in-memory mock of Google's services.
// Usage: node tests/apps-script.test.mjs
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { makeEnv } from './gas-mock.mjs';

const run = (ctx, code) => vm.runInContext(code, ctx);
const post = (ctx, obj) => JSON.parse(run(ctx, `doPost({postData:{contents:${JSON.stringify(JSON.stringify(obj))}}}).s`));
const get = (ctx, action) => JSON.parse(run(ctx, `doGet({parameter:{action:'${action}'}}).s`));
const at = (ctx, ms, fn) => { const real = ctx.Date.now; ctx.Date.now = () => ms; try { return fn(); } finally { ctx.Date.now = real; } };

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok  -', name); };

test('start returns a token and an empty table', () => {
  const { ctx } = makeEnv();
  const r = get(ctx, 'start');
  assert.ok(r.token.includes('.'));
  assert.deepEqual(r.top, []);
});

test('a plausible run is accepted, ranked and listed', () => {
  const { ctx } = makeEnv();
  const t0 = 1_000_000_000_000;
  const { token } = at(ctx, t0, () => get(ctx, 'start'));
  const r = at(ctx, t0 + 60_000, () => post(ctx, { token, name: 'Kai', gifts: 20, meters: 400 }));
  assert.equal(r.ok, true);
  assert.equal(r.rank, 1);
  assert.deepEqual(r.top, [{ name: 'Kai', score: 600 }]);
});

test('a token cannot be used twice', () => {
  const { ctx } = makeEnv();
  const t0 = 1_000_000_000_000;
  const { token } = at(ctx, t0, () => get(ctx, 'start'));
  at(ctx, t0 + 60_000, () => post(ctx, { token, name: 'A', gifts: 5, meters: 100 }));
  const r = at(ctx, t0 + 61_000, () => post(ctx, { token, name: 'A', gifts: 5, meters: 100 }));
  assert.equal(r.error, 'used');
});

test('a forged or edited token is rejected', () => {
  const { ctx } = makeEnv();
  const t0 = 1_000_000_000_000;
  const { token } = at(ctx, t0, () => get(ctx, 'start'));
  const [payload, sig] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ id: 'x', t: t0 - 600_000 })).toString('base64url');
  assert.equal(at(ctx, t0 + 9_000, () => post(ctx, { token: `${forged}.${sig}`, name: 'A', gifts: 1, meters: 1 })).error, 'bad_token');
  assert.equal(post(ctx, { token: `${payload}.AAAA`, name: 'A', gifts: 1, meters: 1 }).error, 'bad_token');
  assert.equal(post(ctx, { name: 'A', gifts: 1, meters: 1 }).error, 'bad_token');
});

test('an expired token is rejected', () => {
  const { ctx } = makeEnv();
  const t0 = 1_000_000_000_000;
  const { token } = at(ctx, t0, () => get(ctx, 'start'));
  assert.equal(at(ctx, t0 + 31 * 60_000, () => post(ctx, { token, name: 'A', gifts: 1, meters: 50 })).error, 'bad_token');
});

test('submitting without playing long enough is rejected (server-measured time)', () => {
  const { ctx } = makeEnv();
  const t0 = 1_000_000_000_000;
  const { token } = at(ctx, t0, () => get(ctx, 'start'));
  assert.equal(at(ctx, t0 + 2_000, () => post(ctx, { token, name: 'A', gifts: 50, meters: 900 })).error, 'too_fast');
});

test('impossible scores for the elapsed time are rejected', () => {
  const { ctx } = makeEnv();
  const t0 = 1_000_000_000_000;
  for (const [g, m] of [[500, 100], [10, 5000], [1e9, 1e9], [-5, 10], [null, 10], ['5', 10]]) {
    const { token } = at(ctx, t0, () => get(ctx, 'start'));
    const r = at(ctx, t0 + 30_000, () => post(ctx, { token, name: 'A', gifts: g, meters: m }));
    assert.equal(r.ok, false, `gifts=${g} meters=${m}`);
  }
});

test('names are cleaned: length, control chars, HTML, formulas', () => {
  const { ctx, rows } = makeEnv();
  const t0 = 1_000_000_000_000;
  const submit = (name) => {
    const { token } = at(ctx, t0, () => get(ctx, 'start'));
    return at(ctx, t0 + 60_000, () => post(ctx, { token, name, gifts: 5, meters: 100 }));
  };
  submit('=IMPORTXML("http://evil")');
  submit('<b>Pau</b>\n\tlong long long name');
  submit('   ');
  assert.ok(rows[1][1].startsWith("'="), 'formula defused');
  assert.ok(rows[1][1].length <= 13, 'length limited (12 + apostrophe)');
  assert.ok(!/[<>\n\t]/.test(rows[2][1]) && rows[2][1].length <= 12, 'html/control chars removed');
  assert.equal(rows.length, 3); // header + 2 rows: the blank name was refused
});

test('the table is sorted, limited to 20, ties keep the earlier entry first', () => {
  const { ctx } = makeEnv();
  const t0 = 1_000_000_000_000;
  let last;
  for (let i = 0; i < 25; i++) {
    const { token } = at(ctx, t0 + i, () => get(ctx, 'start'));
    last = at(ctx, t0 + i + 60_000, () => post(ctx, { token, name: `P${i}`, gifts: 5, meters: 100 + i }));
  }
  const top = get(ctx, 'top').top;
  assert.equal(top.length, 20);
  assert.equal(top[0].name, 'P24');
  assert.ok(top.every((r, i) => i === 0 || top[i - 1].score >= r.score));
  assert.equal(last.rank, 1);
});

test('flooding is limited', () => {
  const { ctx } = makeEnv();
  const t0 = 1_000_000_000_000;
  let busy = 0;
  for (let i = 0; i < 40; i++) {
    const { token } = at(ctx, t0, () => get(ctx, 'start'));
    const r = at(ctx, t0 + 60_000, () => post(ctx, { token, name: `F${i}`, gifts: 5, meters: 100 }));
    if (r.error === 'busy') busy++;
  }
  assert.ok(busy >= 10);
});

test('garbage requests do not crash', () => {
  const { ctx } = makeEnv();
  assert.equal(JSON.parse(run(ctx, `doPost({postData:{contents:'not json'}}).s`)).error, 'bad_request');
});

console.log(`\n${passed} tests passed`);
