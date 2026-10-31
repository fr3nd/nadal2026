// Shared high-score table, backed by a Google Apps Script web app (apps-script/).
// Every call can fail (offline, slow, not configured): callers must cope, and
// the game always keeps working with the device's own best score.
import { CONFIG as C } from './config.js';

// In dev you can point at a local mock: http://localhost:5173/?scores=http://localhost:8787/
const override = import.meta.env.DEV ? new URLSearchParams(location.search).get('scores') : null;
const URL_ = override || C.scoresUrl;

export const enabled = () => Boolean(URL_);

let run = { token: null, top: null };

async function request(url, options = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), C.scoresTimeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Called when a run starts. Runs in the background: the player never waits.
export async function startRun() {
  run = { token: null, top: null };
  if (!enabled()) return;
  try {
    const r = await request(`${URL_}${URL_.includes('?') ? '&' : '?'}action=start`);
    if (r && r.token && Array.isArray(r.top)) run = { token: r.token, top: r.top };
  } catch {
    /* no shared table for this run */
  }
}

// Does this score make the table? (needs the token and table from startRun)
export function qualifies(score) {
  if (!run.token || !run.top || score <= 0) return false;
  return run.top.length < C.scoresTop || score > run.top[run.top.length - 1].score;
}

export async function getTop() {
  if (!enabled()) return null;
  try {
    const r = await request(`${URL_}${URL_.includes('?') ? '&' : '?'}action=top`);
    return Array.isArray(r.top) ? r.top : null;
  } catch {
    return null;
  }
}

// -> { ok: true, rank, top } or { ok: false, error }
export async function submit(name, gifts, meters) {
  if (!run.token) return { ok: false, error: 'no_token' };
  try {
    // text/plain keeps this a "simple" request, so the browser skips the CORS preflight
    const r = await request(URL_, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: run.token, name, gifts, meters }),
    });
    if (r.ok) run = { token: null, top: r.top }; // a token is single use
    return r;
  } catch {
    return { ok: false, error: 'network' };
  }
}
