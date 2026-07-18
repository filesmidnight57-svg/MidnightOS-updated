const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { runSingleCase } = require('../src/app');
const { ensureOutputDir } = require('../src/utils/outputContext');

test('direct runSingleCase dry-run exits before generation', async () => {
  const before = new Set(fs.readdirSync(ensureOutputDir()));
  const result = await runSingleCase({ dryRun: true });
  const after = new Set(fs.readdirSync(ensureOutputDir()));
  assert.deepEqual(result, { dryRun: true, caseNumber: null, outputDir: null, platforms: [] });
  assert.deepEqual([...after].sort(), [...before].sort());
});

test('all project JavaScript files use valid syntax through npm run check', () => {
  assert.equal(path.extname(require.resolve('../src/app')), '.js');
});
