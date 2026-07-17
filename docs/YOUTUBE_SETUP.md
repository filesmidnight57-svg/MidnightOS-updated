# YouTube Publisher OAuth Setup

MidnightOS publishes Shorts through the official Google OAuth 2.0 flow and the YouTube Data API v3. The publisher supports a local desktop/browser login, stores the refresh token in a private file, and keeps `--dry-run` available for validation without uploading.

## 1. Create Google Cloud credentials

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project for MidnightOS.
3. Enable **YouTube Data API v3** for the project.
4. Configure the OAuth consent screen.
5. Create an OAuth 2.0 Client ID:
   - Recommended local setup: **Desktop app**.
   - Web-app setup also works if you add this authorized redirect URI:
     `http://localhost:53682/oauth2callback`
6. Copy the client ID and client secret.

## 2. Configure MidnightOS

Add the OAuth client values to `.env`:

```bash
YOUTUBE_CLIENT_ID=your-google-oauth-client-id
YOUTUBE_CLIENT_SECRET=your-google-oauth-client-secret
YOUTUBE_REDIRECT_URI=http://localhost:53682/oauth2callback
YOUTUBE_PRIVACY_STATUS=private
```

`YOUTUBE_REDIRECT_URI` is optional when using the default local callback above.

## 3. Run local OAuth login

Start the local OAuth setup:

```bash
npm run youtube:auth
```

The command prints a Google authorization URL and starts a local callback server on port `53682`. Open the URL, approve YouTube upload access, and Google redirects back to the local callback.

When successful, MidnightOS saves the refresh token to:

```text
~/.midnightos/youtube-oauth.json
```

The token directory is written with `0700` permissions and the token file is written with `0600` permissions. Keep this file private. You can override the token location with `YOUTUBE_TOKEN_PATH`.

For CI or secret-manager based environments, `YOUTUBE_REFRESH_TOKEN` is still supported and takes precedence over the token file.

## 4. Validate with dry run

Before uploading, validate that the Shorts video, thumbnail, and metadata exist:

```bash
npm run publish -- --dry-run
```

Dry run writes `output/CASE-######/upload_report.json` but does not contact the YouTube upload API.

## 5. Publish live

After OAuth setup and dry-run validation, publish with:

```bash
YOUTUBE_PUBLISH_MODE=live npm run publish
```

or:

```bash
npm run publish -- --live
```

The YouTube Publisher uploads files from the latest `output/CASE-######/` folder, applies metadata from that folder's `youtube.json`, sets `#Shorts` in the description when needed, and writes the result to that folder's `upload_report.json`.

## Missing credentials

If live publishing is requested without credentials, MidnightOS prints setup instructions. Confirm that:

- `YOUTUBE_CLIENT_ID` and `YOUTUBE_CLIENT_SECRET` are set in `.env`.
- `npm run youtube:auth` completed successfully.
- `~/.midnightos/youtube-oauth.json` exists, or `YOUTUBE_REFRESH_TOKEN` is set.
- The YouTube Data API v3 is enabled for the OAuth project.
