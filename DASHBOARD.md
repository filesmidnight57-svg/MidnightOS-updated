# Dashboard

Run `npm run dashboard` and open <http://localhost:3000>. It binds to `127.0.0.1` by default; use `DASHBOARD_HOST` and `DASHBOARD_PORT` only when needed. `GET /health` is available for local checks.

The dashboard reads `data/midnightos.json`, the same atomically-written data store used by the batch. It shows real generated cases, per-platform results/links, last batch state, settings variable names that are missing, sanitized errors, and factual monetization thresholds. It does not invent analytics or expose `.env` values.

The Run Morning Batch button starts the same locked sequential command and returns a conflict if another batch is active. The page refreshes automatically every ten seconds.
