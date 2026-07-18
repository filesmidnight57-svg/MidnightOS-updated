const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { LOCK, acquireLock, releaseLock } = require('../src/morning');
const { ensureOutputDir } = require('../src/utils/outputContext');

test('stale and corrupt morning locks are recovered', () => {
  fs.mkdirSync(path.dirname(LOCK), { recursive: true });
  fs.writeFileSync(LOCK, '{corrupt', 'utf8');
  acquireLock();
  releaseLock();
  assert.equal(fs.existsSync(LOCK), false);

  fs.writeFileSync(LOCK, JSON.stringify({ pid: 99999999 }), 'utf8');
  acquireLock();
  releaseLock();
  assert.equal(fs.existsSync(LOCK), false);
});

test('morning dry-run does not create a case or invoke content pipeline', () => {
  const output = ensureOutputDir();
  const before = new Set(fs.readdirSync(output).filter((name) => /^CASE-\d{6}$/.test(name)));
  const result = spawnSync(process.execPath, ['src/morning.js', '--count=1', '--dry-run'], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    env: { ...process.env },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const combined = `${result.stdout}\n${result.stderr}`;
  assert.doesNotMatch(combined, /Generating Hindi Case Story|OpenRouter request|Generating Scene|Rendering Final/i);
  const after = new Set(fs.readdirSync(output).filter((name) => /^CASE-\d{6}$/.test(name)));
  assert.deepEqual(after, before);
  assert.equal(fs.existsSync(LOCK), false);
  assert.match(combined, /dry-run-/i);
});
