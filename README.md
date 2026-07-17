# MidnightOS

MidnightOS generates Hindi horror case videos and publishes them through official platform APIs.

## Daily use

1. Open PowerShell in the project folder.
2. Run `npm run morning`.
3. Run/view the dashboard with `npm run dashboard`.
4. Open <http://localhost:3000>.

The morning command sequentially creates three cases Monday–Saturday and ten on Sunday (Asia/Kolkata). Use `npm run morning -- --count=1`, `--dry-run`, or `--youtube-only` when appropriate. A persisted batch record and lock make interrupted batches resumable and prevent concurrent jobs.

`npm start` still creates one complete case and publishes it to YouTube, then tries Meta platforms independently when configured. `npm run doctor` reports setup and local prerequisites without revealing secrets.

## Configuration

Copy `.env.example` to `.env` and enter credentials there; never commit `.env`. YouTube uses its existing official OAuth flow (`npm run youtube:auth`) and preserves public privacy when `YOUTUBE_PRIVACY_STATUS=public`.

Facebook and Instagram are optional. Meta requires one-time app credentials. Instagram additionally requires a public HTTPS URL for each video; a localhost path cannot be supplied to the official API. See [META_SETUP.md](META_SETUP.md).

## Safety

Use `npm run morning -- --dry-run` to validate an orchestrated batch without uploads. Automated tests mock external work and do not generate media or publish content.
