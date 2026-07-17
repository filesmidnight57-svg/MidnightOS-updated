const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = path.join(ROOT, 'data');
const STORE_PATH = path.join(DATA_DIR, 'midnightos.json');
function initial() { return { version: 1, cases: {}, batches: {}, analytics: {}, health: {}, logs: [] }; }
function readStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) return initial();
  try { return { ...initial(), ...JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) }; }
  catch (error) { throw new Error(`Local dashboard store is invalid: ${error.message}`); }
}
function atomicWrite(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const temp = `${STORE_PATH}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.renameSync(temp, STORE_PATH);
}
function update(mutator) { const data = readStore(); mutator(data); atomicWrite(data); return data; }
function upsertCase(record) { return update((d) => { d.cases[record.caseId] = { ...d.cases[record.caseId], ...record, updatedAt: new Date().toISOString() }; }); }
function upsertBatch(record) { return update((d) => { d.batches[record.id] = { ...d.batches[record.id], ...record, updatedAt: new Date().toISOString() }; }); }
function addLog(level, message) { return update((d) => { d.logs.unshift({ at: new Date().toISOString(), level, message: sanitize(message) }); d.logs = d.logs.slice(0, 200); }); }
function sanitize(value) { return String(value || '').replace(/(access[_-]?token|refresh[_-]?token|client[_-]?secret|api[_-]?key)([=:]\s*)[^\s,]+/gi, '$1$2[REDACTED]').replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]'); }
module.exports = { STORE_PATH, readStore, atomicWrite, update, upsertCase, upsertBatch, addLog, sanitize };
