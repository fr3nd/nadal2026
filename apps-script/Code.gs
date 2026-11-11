// High-score backend for "Kai's Sled", a Google Apps Script web app.
//
//   GET  ?action=start  -> { token, top }   a signed, single-use run token + current top 20
//   GET  ?action=top    -> { top }          the current top 20
//   POST (text/plain JSON) { token, name, gifts, meters } -> { ok, rank, top }
//
// The scores live in the private Google Sheet this script is bound to (never
// shared). The signing key is generated on first use and kept in the script
// properties, so nothing secret is in this file or in the repo.
// Moderation: open the sheet and delete the rows you don't like.

var CFG = {
  topSize: 20,
  nameMax: 12,
  tokenTtlMs: 30 * 60 * 1000,
  minSeconds: 8,            // a run shorter than this can't be submitted
  maxGiftsPerSecond: 3,     // generous upper bounds, see src/config.js
  maxMetersPerSecond: 22,   // 400 px/s / 20 px per meter = 20 m/s at top speed, plus slack (src/config.js)
  maxScore: 100000,
  maxSubmitsPerMinute: 30,  // global flood limit (Apps Script can't see IPs)
  gift: 10,                 // points per gift: keep in sync with src/config.js
  sheetName: 'Scores',
};

// ------------------------------------------------------------ entry points --

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'top';
  if (action === 'start') return json_({ token: makeToken_(), top: topScores_() });
  return json_({ top: topScores_() });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad_request' });
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return json_(submit_(body, Date.now()));
  } finally {
    lock.releaseLock();
  }
}

// ----------------------------------------------------------------- logic ----

function submit_(body, now) {
  if (!rateOk_(now)) return { ok: false, error: 'busy' };

  var tok = verifyToken_(body.token, now);
  if (!tok) return { ok: false, error: 'bad_token' };
  if (usedRun_(tok.id)) return { ok: false, error: 'used' };

  var seconds = (now - tok.t) / 1000; // measured by the server, not the player
  if (typeof body.gifts !== 'number' || typeof body.meters !== 'number') return { ok: false, error: 'bad_score' };
  var gifts = Math.floor(body.gifts);
  var meters = Math.floor(body.meters);
  var check = validate_(gifts, meters, seconds);
  if (check) return { ok: false, error: check };

  var name = cleanName_(body.name);
  if (!name) return { ok: false, error: 'bad_name' };

  markUsed_(tok.id);
  var score = gifts * CFG.gift + meters;
  sheet_().appendRow([new Date(now), name, score, gifts, meters, Math.round(seconds), tok.id]);
  var top = topScores_();
  // Sheets hides the protective apostrophe when reading, so compare without it
  var rank = rankOf_(top, name.replace(/^'(?=[=+\-@])/, ''), score);
  return { ok: true, rank: rank, top: top };
}

// Returns an error code, or '' when the numbers are plausible for that duration.
function validate_(gifts, meters, seconds) {
  if (!isFinite(gifts) || !isFinite(meters) || gifts < 0 || meters < 0) return 'bad_score';
  if (seconds < CFG.minSeconds) return 'too_fast';
  if (gifts > seconds * CFG.maxGiftsPerSecond + 2) return 'implausible';
  if (meters > seconds * CFG.maxMetersPerSecond + 5) return 'implausible';
  if (gifts * CFG.gift + meters > CFG.maxScore) return 'implausible';
  return '';
}

// Trim, limit, strip control chars, and defuse spreadsheet formulas.
function cleanName_(raw) {
  var s = String(raw == null ? '' : raw)
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^'+/, '') // Sheets treats a leading apostrophe as its text marker
    .slice(0, CFG.nameMax)
    .trim();
  if (!s) return '';
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function rankOf_(top, name, score) {
  for (var i = 0; i < top.length; i++) {
    if (top[i].name === name && top[i].score === score) return i + 1;
  }
  return 0; // didn't make the table
}

// ---------------------------------------------------------------- tokens ----

function secret_() {
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('SECRET');
  if (!key) {
    key = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('SECRET', key);
  }
  return key;
}

function sign_(payload) {
  var sig = Utilities.computeHmacSha256Signature(payload, secret_());
  return Utilities.base64EncodeWebSafe(sig).replace(/=+$/, '');
}

function makeToken_() {
  var payload = Utilities.base64EncodeWebSafe(JSON.stringify({ id: Utilities.getUuid(), t: Date.now() })).replace(/=+$/, '');
  return payload + '.' + sign_(payload);
}

// Returns {id, t} for a valid, unexpired token, else null.
function verifyToken_(token, now) {
  if (typeof token !== 'string') return null;
  var parts = token.split('.');
  if (parts.length !== 2 || sign_(parts[0]) !== parts[1]) return null;
  try {
    var data = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
    if (!data.id || !data.t || now - data.t > CFG.tokenTtlMs || now < data.t) return null;
    return data;
  } catch (err) {
    return null;
  }
}

function usedRun_(id) { return CacheService.getScriptCache().get('run_' + id) !== null; }
function markUsed_(id) { CacheService.getScriptCache().put('run_' + id, '1', 6 * 60 * 60); }

function rateOk_(now) {
  var cache = CacheService.getScriptCache();
  var key = 'rate_' + Math.floor(now / 60000);
  var n = Number(cache.get(key) || 0) + 1;
  cache.put(key, String(n), 120);
  return n <= CFG.maxSubmitsPerMinute;
}

// ----------------------------------------------------------------- sheet ----

// The script is bound to the score spreadsheet, so it only ever needs access to
// this one sheet (scope spreadsheets.currentonly), never to the rest of your Drive.
function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CFG.sheetName) || ss.getSheets()[0];
  if (sh.getName() !== CFG.sheetName) sh.setName(CFG.sheetName);
  if (sh.getLastRow() === 0) {
    sh.appendRow(['date', 'name', 'score', 'gifts', 'meters', 'seconds', 'runId']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function topScores_() {
  var sh = sheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  var rows = sh.getRange(2, 2, last - 1, 2).getValues(); // name, score
  var list = rows
    .map(function (r, i) { return { name: String(r[0]), score: Number(r[1]), i: i }; })
    .filter(function (r) { return r.name && isFinite(r.score); });
  // best first; for equal scores the earlier one stays above
  list.sort(function (a, b) { return b.score - a.score || a.i - b.i; });
  return list.slice(0, CFG.topSize).map(function (r) { return { name: r.name, score: r.score }; });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Run once from the editor to authorize the script and prepare the sheet.
function setup() {
  var sh = sheet_();
  secret_();
  Logger.log('Sheet: ' + sh.getParent().getUrl());
}
