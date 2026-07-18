const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  atomicWriteJson,
  readJsonState,
  repairMojibake,
  toPortablePath,
  resolvePortablePath,
} = require('../src/utils/store');

test('repairs common Hindi UTF-8 mojibake without changing valid Hindi', () => {
  const valid = 'बिना हाथों वाला भूत';
  const broken = Buffer.from(valid, 'utf8').toString('latin1');
  assert.equal(repairMojibake(broken), valid);
  assert.equal(repairMojibake(valid), valid);
  assert.deepEqual(repairMojibake({ title: broken }), { title: valid });
});

test('atomic JSON writes produce valid UTF-8 JSON and leave no temp file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'midnightos-state-'));
  const file = path.join(dir, 'state.json');
  atomicWriteJson(file, { title: 'रात का रहस्य' });
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { title: 'रात का रहस्य' });
  assert.equal(fs.readdirSync(dir).some((name) => name.endsWith('.tmp')), false);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('corrupt state is backed up and reset safely', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'midnightos-corrupt-'));
  const file = path.join(dir, 'state.json');
  fs.writeFileSync(file, '{not-json', 'utf8');
  const result = readJsonState(file, () => ({ ok: true }));
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { ok: true });
  assert.equal(fs.readdirSync(dir).some((name) => name.includes('.corrupt-') && name.endsWith('.bak')), true);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('project-local paths become portable and traversal is rejected', () => {
  const root = path.join(os.tmpdir(), 'midnightos-root');
  const local = path.join(root, 'output', 'CASE-000001', 'video.mp4');
  assert.equal(toPortablePath(local, root), 'output/CASE-000001/video.mp4');
  assert.equal(resolvePortablePath('output/CASE-000001/video.mp4', root), local);
  assert.throws(() => resolvePortablePath('../secret.txt', root), /Unsafe relative path/);
  assert.equal(toPortablePath('C:\\OldPC\\MidnightOS\\output\\CASE-000001\\video.mp4', root), 'output/CASE-000001/video.mp4');
  assert.equal(resolvePortablePath('C:\\OldPC\\Outside\\video.mp4', root), path.normalize('C:\\OldPC\\Outside\\video.mp4'));
});
