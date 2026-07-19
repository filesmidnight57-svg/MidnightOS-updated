require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { ensureOutputDir } = require('./utils/outputContext');
const { upsertBatch, readStore, sanitize } = require('./utils/store');

const LOCK = path.join(ensureOutputDir(), '.morning.lock');

function batchCount(date = new Date()) {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
  }).format(date);
  return weekday === 'Sunday' ? 10 : 3;
}

function parseOptions(argv = process.argv.slice(2)) {
  const options = { count: undefined, dryRun: false, youtubeOnly: false };
  for (const arg of argv) {
    if (arg.startsWith('--count=')) options.count = Number(arg.slice(8));
    if (arg === '--dry-run') options.dryRun = true;
    if (arg === '--youtube-only') options.youtubeOnly = true;
  }
  if (options.count !== undefined && (!Number.isInteger(options.count) || options.count < 1)) {
    throw new Error('--count must be a positive integer.');
  }
  return options;
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function readLock() {
  try {
    return JSON.parse(fs.readFileSync(LOCK, 'utf8'));
  } catch {
    return null;
  }
}

function acquireLock() {
  if (fs.existsSync(LOCK)) {
    const lock = readLock();
    if (lock && isProcessAlive(Number(lock.pid))) {
      throw new Error(`A morning batch is already running (PID ${lock.pid}).`);
    }
    fs.rmSync(LOCK, { force: true });
  }

  try {
    fs.writeFileSync(
      LOCK,
      JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }),
      { encoding: 'utf8', flag: 'wx' }
    );
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error('A morning batch is already running.');
    throw error;
  }
}

function releaseLock() {
  const lock = readLock();
  if (!lock || Number(lock.pid) === process.pid) fs.rmSync(LOCK, { force: true });
}

function report(batch) {
  const dir = path.join(ensureOutputDir(), 'batches', batch.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'batch_report.json'), `${JSON.stringify(batch, null, 2)}\n`, 'utf8');

  const lines = [
    `MidnightOS batch ${batch.id}`,
    `Mode: ${batch.dryRun ? 'DRY RUN' : 'LIVE'}`,
    `Status: ${batch.status}`,
    `Started: ${batch.startedAt}`,
    `Ended: ${batch.completedAt || 'in progress'}`,
    `Cases: ${batch.cases.length}/${batch.targetCount}`,
    '',
  ];

  if (batch.dryRun) {
    lines.push('No AI requests, image generation, voice generation, video rendering, or publishing were performed.', '');
    for (const check of batch.checks || []) lines.push(`${check.ok ? 'PASS' : 'WARN'}: ${check.name}${check.detail ? ` - ${check.detail}` : ''}`);
  } else {
    for (const item of batch.cases) {
      lines.push(
        `${item.caseId || 'failed'}: ${(item.platforms || []).map((p) => `${p.platform}=${p.uploaded ? 'success' : p.error || 'skipped'}`).join('; ')}`,
        item.error ? `  Error: ${item.error}` : ''
      );
    }
  }

  fs.writeFileSync(path.join(dir, 'batch_report.txt'), lines.filter((line) => line !== undefined).join('\n'), 'utf8');
  return dir;
}

function commandAvailable(command) {
  return spawnSync(command, ['-version'], { windowsHide: true, stdio: 'ignore' }).status === 0;
}

function buildDryRunBatch(options, target) {
  const now = new Date().toISOString();
  const checks = [
    { name: 'Output directory writable', ok: (() => {
      const probe = path.join(ensureOutputDir(), `.dry-run-${process.pid}.tmp`);
      try { fs.writeFileSync(probe, 'ok'); fs.rmSync(probe, { force: true }); return true; } catch { return false; }
    })() },
    { name: 'FFmpeg available', ok: commandAvailable('ffmpeg') },
    { name: 'FFprobe available', ok: commandAvailable('ffprobe') },
    { name: 'Ollama model configured', ok: Boolean(process.env.OLLAMA_MODEL || 'qwen2.5:7b'), detail: 'Presence only; no API call made.' },
    { name: 'YouTube credentials present', ok: Boolean(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET), detail: 'Optional unless YouTube publishing is enabled.' },
  ];

  return {
    id: `dry-run-${now.replace(/[:.]/g, '-')}`,
    startedAt: now,
    completedAt: new Date().toISOString(),
    targetCount: target,
    cases: [],
    status: checks.slice(0, 3).every((check) => check.ok) ? 'dry_run_completed' : 'dry_run_with_warnings',
    dryRun: true,
    options,
    plan: Array.from({ length: target }, (_, index) => ({ sequence: index + 1, action: 'generate-and-publish-case', simulated: true })),
    checks,
  };
}

async function runMorning(options = parseOptions()) {
  acquireLock();
  const target = options.count || batchCount();

  try {
    if (options.dryRun) {
      const batch = buildDryRunBatch(options, target);
      upsertBatch(batch);
      report(batch);
      return batch;
    }

    const { runSingleCase } = require('./app');
    const { refreshAnalytics } = require('./analytics');
    const existing = Object.values(readStore().batches).find(
      (batch) => batch.status === 'running' && batch.targetCount === target && !batch.dryRun
    );
    const batch = existing || {
      id: `batch-${new Date().toISOString().replace(/[:.]/g, '-')}`,
      startedAt: new Date().toISOString(),
      targetCount: target,
      cases: [],
      status: 'running',
      options,
    };

    upsertBatch(batch);
    report(batch);

    for (let index = batch.cases.length; index < target; index += 1) {
      console.log(`\nBatch ${index + 1}/${target}\nGenerate`);
      const entry = { startedAt: new Date().toISOString() };
      try {
        const output = await runSingleCase(options);
        entry.caseId = output.caseNumber;
        entry.outputDir = output.outputDir;
        entry.platforms = output.platforms;
        console.log('YouTube\nFacebook\nInstagram\nAnalytics');
        try { await refreshAnalytics(); } catch { /* analytics must not fail the batch */ }
        console.log('Complete');
      } catch (error) {
        entry.error = sanitize(error.message);
        console.error(`Case failed: ${entry.error}`);
      }
      entry.completedAt = new Date().toISOString();
      batch.cases.push(entry);
      upsertBatch(batch);
      report(batch);
    }

    batch.status = batch.cases.some((item) => item.error) ? 'completed_with_errors' : 'completed';
    batch.completedAt = new Date().toISOString();
    upsertBatch(batch);
    report(batch);
    return batch;
  } finally {
    releaseLock();
  }
}

if (require.main === module) {
  runMorning()
    .then((batch) => console.log(`✅ Batch report: output/batches/${batch.id}/batch_report.txt`))
    .catch((error) => {
      console.error(`❌ Morning batch failed: ${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = {
  batchCount,
  parseOptions,
  isProcessAlive,
  acquireLock,
  releaseLock,
  runMorning,
  report,
  buildDryRunBatch,
  LOCK,
};
