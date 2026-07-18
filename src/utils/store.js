const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = path.join(ROOT, 'data');
const STORE_PATH = path.join(DATA_DIR, 'midnightos.json');

function initial() {
  return { version: 1, cases: {}, batches: {}, analytics: {}, health: {}, logs: [] };
}

function repairMojibake(value) {
  if (typeof value === 'string') {
    if (!/(?:Ã|Â|â€|ðŸ|à¤|à¥)/.test(value)) return value;
    try {
      const repaired = Buffer.from(value, 'latin1').toString('utf8');
      return repaired.includes('\uFFFD') ? value : repaired;
    } catch {
      return value;
    }
  }
  if (Array.isArray(value)) return value.map(repairMojibake);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, repairMojibake(item)]));
  }
  return value;
}

function backupDamagedFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const backupPath = `${filePath}.corrupt-${new Date().toISOString().replace(/[:.]/g, '-')}.bak`;
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function atomicWriteJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const payload = `${JSON.stringify(data, null, 2)}\n`;
  let fd;
  try {
    fd = fs.openSync(tempPath, 'w');
    fs.writeFileSync(fd, payload, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(tempPath, filePath);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    fs.rmSync(tempPath, { force: true });
  }
}

function readJsonState(filePath, fallbackFactory) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!fs.existsSync(filePath)) return fallbackFactory();

  try {
    const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '').trim();
    if (!raw) throw new Error('file is empty');
    return repairMojibake(JSON.parse(raw));
  } catch (error) {
    const backupPath = backupDamagedFile(filePath);
    const fallback = fallbackFactory();
    atomicWriteJson(filePath, fallback);
    console.warn(`Recovered invalid JSON state at ${filePath}${backupPath ? `; backup: ${backupPath}` : ''}: ${error.message}`);
    return fallback;
  }
}

function toPortablePath(inputPath, root = ROOT) {
  if (!inputPath) return inputPath;
  const value = String(inputPath);
  const isWindowsAbsolute = /^[A-Za-z]:[\\/]/.test(value);
  if (!path.isAbsolute(value) && !isWindowsAbsolute) return value.replace(/\\/g, '/');
  const relative = isWindowsAbsolute && process.platform !== 'win32' ? `../${value}` : path.relative(root, value);
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) return relative.replace(/\\/g, '/');

  // Legacy records may point to the same project on another machine. Preserve the
  // portable project suffix when it is clearly under output/ or data/.
  const portableMatch = value.replace(/\\/g, '/').match(/(?:^|\/)(output|data)\/(.+)$/i);
  if (portableMatch) return `${portableMatch[1].toLowerCase()}/${portableMatch[2]}`;
  return value;
}

function resolvePortablePath(storedPath, root = ROOT) {
  if (!storedPath) return storedPath;
  const value = String(storedPath);
  if (path.isAbsolute(value) || /^[A-Za-z]:[\\/]/.test(value)) return path.normalize(value);
  const normalized = value.replace(/[\\/]+/g, path.sep);
  const resolved = path.resolve(root, normalized);
  const relative = path.relative(root, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Unsafe relative path outside project root: ${storedPath}`);
  }
  return resolved;
}

function normalizeRecordPaths(record) {
  const result = { ...record };
  if (result.outputDir) result.outputDir = toPortablePath(result.outputDir);
  if (result.files && typeof result.files === 'object') {
    result.files = Object.fromEntries(Object.entries(result.files).map(([key, value]) => [key, toPortablePath(value)]));
  }
  return result;
}

function readStore() {
  const stored = readJsonState(STORE_PATH, initial);
  return { ...initial(), ...stored };
}

function atomicWrite(data) {
  atomicWriteJson(STORE_PATH, data);
}

function update(mutator) {
  const data = readStore();
  mutator(data);
  atomicWrite(data);
  return data;
}

function upsertCase(record) {
  const portable = normalizeRecordPaths(record);
  return update((data) => {
    data.cases[portable.caseId] = {
      ...data.cases[portable.caseId],
      ...portable,
      updatedAt: new Date().toISOString(),
    };
  });
}

function upsertBatch(record) {
  return update((data) => {
    data.batches[record.id] = { ...data.batches[record.id], ...record, updatedAt: new Date().toISOString() };
  });
}

function addLog(level, message) {
  return update((data) => {
    data.logs.unshift({ at: new Date().toISOString(), level, message: sanitize(message) });
    data.logs = data.logs.slice(0, 200);
  });
}

function sanitize(value) {
  return String(value || '')
    .replace(/(access[_-]?token|refresh[_-]?token|client[_-]?secret|api[_-]?key)([=:]\s*)[^\s,]+/gi, '$1$2[REDACTED]')
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]');
}

module.exports = {
  ROOT,
  STORE_PATH,
  initial,
  readStore,
  atomicWrite,
  atomicWriteJson,
  readJsonState,
  repairMojibake,
  toPortablePath,
  resolvePortablePath,
  update,
  upsertCase,
  upsertBatch,
  addLog,
  sanitize,
};
