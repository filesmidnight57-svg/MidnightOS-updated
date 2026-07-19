# MidnightOS Repository Audit

## Scope reviewed

Reviewed the application-owned files under `src/`, `test/`, project configuration, documentation, data layout, output layout, and Git state. Third-party `node_modules` source was excluded from code-quality review.

## Verified root cause

The uploaded repository was still at `ae835b2`. The claimed `d958a7a` change was not present. The existing `src/morning.js` parsed `--dry-run` but always called `runSingleCase()`, so it generated a real case. Its lock logic trusted file age for 12 hours and did not verify the recorded PID.

## Repairs included

1. Morning dry-run now exits before importing or calling the content pipeline.
2. Dry-run performs only local checks and creates a simulation report.
3. Lock acquisition now reads the PID and removes dead, invalid, or corrupt locks.
4. Lock creation uses exclusive file creation (`wx`) to reduce race conditions.
5. Lock release only removes the current process lock.
6. Regression and child-process integration tests were added.
7. Test execution is serialized because lock tests intentionally use one shared project lock path.
8. Syntax checking now includes `caseManager.js`.

## Verification completed

- `npm test`: 7/7 passed.
- `npm run check`: passed.
- `node src/morning.js --count=1 --dry-run`: passed.
- Dry-run output contained no AI, Ollama, image, voice, or rendering messages.
- Dry-run created no new `CASE-xxxxxx` directory.
- `.morning.lock` was removed after completion.

## Important remaining findings

### Critical / high priority

- `data/cases.json` allocation is a read-modify-write operation without inter-process locking. Two independent generation processes can allocate the same case number. Keep only one generator process active until this is hardened.
- `data/midnightos.json` updates are atomic at file replacement level but not transaction-safe across concurrent processes. Dashboard analytics and generation could overwrite each other's updates.
- The dashboard POST endpoint can start a live batch without authentication. It binds to `127.0.0.1` by default, which limits exposure, but it must not be exposed publicly in its current form.
- `.env` was included inside the uploaded ZIP. It is Git-ignored, but ZIP sharing can expose credentials. Rotate any credential that may have been shared outside trusted storage.

### Functional inconsistencies

- `src/batch.js` uses a separate pipeline from `src/morning.js` and publishes only to YouTube. Behaviour differs between `npm run batch` and `npm run morning`.
- `npm start -- --dry-run` still generates full content and only skips publishing. The new true no-generation dry-run applies to the morning command.
- A failed case consumes its case number and leaves a partial case folder. This is recoverable but should be represented explicitly as a failed case record.
- Morning resume selects any old running batch with the same target count. A stale database record can resume an unrelated historical batch.

### Reliability and maintainability

- Several core files are compressed into one-line implementations (`dashboard.js`, `doctor.js`, `publishers.js`, old tests), making review and maintenance risky.
- `videoGenerator.js` is about 1,400 lines and combines probing, subtitle handling, filters, rendering, sound, and cleanup. It should be split only after current production behaviour is covered by tests.
- Many synchronous filesystem operations are acceptable for a single-user CLI but block the dashboard event loop when used in server requests.
- Tests previously wrote to the real local dashboard store. Test data paths should eventually be isolated using temporary directories.
- Repeated `dotenv.config()` calls explain the multiple dotenv console messages. This is noisy, not the cause of the dry-run bug.

### Publishing observations

- YouTube publishing has the most complete implementation.
- Facebook upload is implemented but must be tested against the currently approved Graph API permissions and upload requirements.
- Instagram depends on a publicly reachable HTTPS video URL. A local Windows file path cannot be uploaded directly.
- Analytics currently refreshes YouTube channel statistics only; Facebook and Instagram remain configuration placeholders.

## Recommended next order

1. Install and verify this morning repair locally.
2. Commit the verified local change.
3. Add safe atomic case-number allocation.
4. Isolate tests from production data.
5. Add dashboard token authentication before any network exposure.
6. Unify `batch.js` with `runSingleCase()` so there is one generation/publishing path.
7. Add integration tests around a mocked generation pipeline before refactoring `videoGenerator.js`.

## Files changed in this repair

- `src/morning.js`
- `test/morning.integration.test.js`
- `package.json`
