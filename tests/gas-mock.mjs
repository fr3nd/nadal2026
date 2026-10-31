// In-memory mock of Google's services, so apps-script/Code.gs runs in Node.
import vm from 'node:vm';
import fs from 'node:fs';
import crypto from 'node:crypto';

export function makeEnv() {
  const props = {};
  const cache = {};
  const rows = []; // the script writes its own header row
  const sheet = {
    getLastRow: () => rows.length,
    appendRow: (r) => rows.push(r),
    getRange: (r, c, n, m) => ({ getValues: () => rows.slice(r - 1, r - 1 + n).map((x) => x.slice(c - 1, c - 1 + m)) }),
    setName() {}, setFrozenRows() {}, getParent: () => ({ getUrl: () => 'mock://sheet' }),
  };
  const ss = { getId: () => 'sheet1', getSheets: () => [sheet], getSheetByName: () => sheet, getUrl: () => 'mock://sheet' };
  const b64 = (buf) => Buffer.from(buf).toString('base64url');
  let uuid = 0;
  const ctx = {
    console, Date, Math, JSON, Number, String, isFinite, Error,
    Utilities: {
      getUuid: () => `uuid-${++uuid}-${crypto.randomUUID()}`,
      computeHmacSha256Signature: (payload, key) => [...crypto.createHmac('sha256', key).update(payload).digest()],
      base64EncodeWebSafe: (x) => (typeof x === 'string' ? Buffer.from(x).toString('base64url') : Buffer.from(x).toString('base64url')),
      base64DecodeWebSafe: (s) => [...Buffer.from(s, 'base64url')],
      newBlob: (bytes) => ({ getDataAsString: () => Buffer.from(bytes).toString() }),
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null, setProperty: (k, v) => { props[k] = v; } }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache[k] ?? null, put: (k, v) => { cache[k] = v; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    SpreadsheetApp: { create: () => ss, openById: () => ss },
    ContentService: { createTextOutput: (s) => ({ s, setMimeType() { return this; } }), MimeType: { JSON: 'json' } },
    Logger: { log() {} },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8'), ctx);
  return { ctx, rows };
}
