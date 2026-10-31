// Local stand-in for the Google Apps Script web app, running the real Code.gs.
// Usage: node tests/mock-scores-server.mjs   then open  http://localhost:5173/?scores=http://localhost:8787/
// Optional: SEED=1 pre-fills the table with sample scores.
import http from 'node:http';
import vm from 'node:vm';
import { makeEnv } from './gas-mock.mjs';

const { ctx } = makeEnv();
const call = (code) => JSON.parse(vm.runInContext(code, ctx).s);

if (process.env.SEED) {
  const names = ['Anna', 'Pau', 'Marta', 'Jordi', 'Laia', 'Biel', 'Núria', 'Arnau', 'Júlia', 'Pol', 'Aina', 'Marc', 'Clara', 'Nil', 'Sara', 'Oriol', 'Emma', 'Roger', 'Berta', 'Ona', 'Gerard'];
  const real = Date.now;
  names.forEach((n, i) => {
    const t0 = real() - 3_600_000 + i * 1000;
    ctx.Date.now = () => t0;
    const { token } = call('doGet({parameter:{action:"start"}})');
    ctx.Date.now = () => t0 + 90_000;
    call(`doPost({postData:{contents:${JSON.stringify(JSON.stringify({ token, name: n, gifts: 40 - i, meters: 500 - i * 12 }))}}})`);
  });
  ctx.Date.now = real;
}

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
  const url = new URL(req.url, 'http://x');
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const delay = Number(process.env.DELAY || 400); // Apps Script is not instant either
    setTimeout(() => {
      let out;
      if (req.method === 'POST') out = call(`doPost({postData:{contents:${JSON.stringify(body)}}})`);
      else out = call(`doGet({parameter:{action:${JSON.stringify(url.searchParams.get('action') || 'top')}}})`);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(out));
    }, delay);
  });
}).listen(8787, () => console.log('mock scores server on http://localhost:8787/'));
