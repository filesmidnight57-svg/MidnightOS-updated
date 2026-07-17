require("dotenv").config();

const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { URL } = require("url");
const { OAuth2Client } = require("google-auth-library");

const DEFAULT_REDIRECT_URI = "http://localhost:53682/oauth2callback";
const YOUTUBE_UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload";
const YOUTUBE_ANALYTICS_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";
const DEFAULT_TOKEN_PATH = path.join(os.homedir(), ".midnightos", "youtube-oauth.json");

function getTokenPath() {
  return process.env.YOUTUBE_TOKEN_PATH || DEFAULT_TOKEN_PATH;
}

function getOAuthConfig() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI || DEFAULT_REDIRECT_URI;

  if (!clientId || !clientSecret) {
    throw new Error(getMissingCredentialsMessage());
  }

  return { clientId, clientSecret, redirectUri };
}

function createOAuthClient(config = getOAuthConfig()) {
  return new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri);
}

function buildAuthUrl(config = getOAuthConfig()) {
  const client = createOAuthClient(config);
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [YOUTUBE_UPLOAD_SCOPE, YOUTUBE_ANALYTICS_SCOPE],
  });
}

async function exchangeCodeForTokens(code, config = getOAuthConfig()) {
  const client = createOAuthClient(config);
  const { tokens } = await client.getToken(code);
  return tokens;
}

function ensurePrivateDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true, mode: 0o700 });
  fs.chmodSync(directoryPath, 0o700);
}

function saveTokens(tokens, tokenPath = getTokenPath()) {
  if (!tokens.refresh_token) {
    throw new Error("Google did not return a refresh token. Revoke app access and retry with prompt=consent.");
  }

  ensurePrivateDirectory(path.dirname(tokenPath));
  const tokenRecord = {
    type: "authorized_user",
    client_id: process.env.YOUTUBE_CLIENT_ID,
    client_secret: process.env.YOUTUBE_CLIENT_SECRET,
    refresh_token: tokens.refresh_token,
    scope: tokens.scope || YOUTUBE_UPLOAD_SCOPE,
    token_uri: "https://oauth2.googleapis.com/token",
    saved_at: new Date().toISOString(),
  };

  fs.writeFileSync(tokenPath, JSON.stringify(tokenRecord, null, 2), { mode: 0o600 });
  fs.chmodSync(tokenPath, 0o600);
  return tokenPath;
}

function loadSavedTokens(tokenPath = getTokenPath()) {
  if (!fs.existsSync(tokenPath)) return null;
  return JSON.parse(fs.readFileSync(tokenPath, "utf8"));
}

function getMissingCredentialsMessage() {
  return [
    "Missing YouTube OAuth credentials.",
    "1. Create a Google Cloud OAuth client for a Desktop app or Web app with redirect URI http://localhost:53682/oauth2callback.",
    "2. Enable the YouTube Data API v3 and set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in .env.",
    "3. Run npm run youtube:auth to complete local browser login and securely save the refresh token.",
    "4. Run npm run publish -- --dry-run to validate assets, then YOUTUBE_PUBLISH_MODE=live npm run publish to upload.",
    "See docs/YOUTUBE_SETUP.md for full setup instructions.",
  ].join("\n");
}

function getRefreshToken() {
  if (process.env.YOUTUBE_REFRESH_TOKEN) return process.env.YOUTUBE_REFRESH_TOKEN;
  const savedTokens = loadSavedTokens();
  return savedTokens && savedTokens.refresh_token;
}

async function getAccessToken() {
  const config = getOAuthConfig();
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    throw new Error(getMissingCredentialsMessage());
  }

  const client = createOAuthClient(config);
  client.setCredentials({ refresh_token: refreshToken });
  const accessTokenResponse = await client.getAccessToken();
  const accessToken = accessTokenResponse && accessTokenResponse.token;

  if (!accessToken) {
    throw new Error("Google OAuth did not return an access token.");
  }

  return accessToken;
}

function waitForCode(redirectUri) {
  const callbackUrl = new URL(redirectUri);
  const port = Number(callbackUrl.port || 80);
  const pathname = callbackUrl.pathname;

  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const requestUrl = new URL(request.url, redirectUri);
      if (requestUrl.pathname !== pathname) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }

      const error = requestUrl.searchParams.get("error");
      const code = requestUrl.searchParams.get("code");
      if (error || !code) {
        response.writeHead(400, { "Content-Type": "text/plain" });
        response.end(`OAuth failed: ${error || "missing code"}`);
        server.close();
        reject(new Error(`OAuth failed: ${error || "missing code"}`));
        return;
      }

      response.writeHead(200, { "Content-Type": "text/plain" });
      response.end("MidnightOS YouTube OAuth complete. You can close this tab.");
      server.close();
      resolve(code);
    });

    server.on("error", reject);
    server.listen(port, callbackUrl.hostname || "localhost");
  });
}

async function runOAuthSetup() {
  const config = getOAuthConfig();
  console.log("Open this URL in a browser and approve YouTube upload access:\n");
  console.log(buildAuthUrl(config));
  console.log("\nWaiting for Google OAuth callback...");

  const code = await waitForCode(config.redirectUri);
  const tokens = await exchangeCodeForTokens(code, config);
  const tokenPath = saveTokens(tokens);

  console.log(`\n✅ Refresh token saved securely to ${tokenPath}`);
  console.log("Keep this file private. It is chmod 600 and is used automatically by the YouTube Publisher.");
}

if (require.main === module) {
  runOAuthSetup().catch((error) => {
    console.error(`❌ YouTube OAuth setup failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_TOKEN_PATH,
  YOUTUBE_UPLOAD_SCOPE,
  YOUTUBE_ANALYTICS_SCOPE,
  buildAuthUrl,
  exchangeCodeForTokens,
  getAccessToken,
  getMissingCredentialsMessage,
  getRefreshToken,
  getTokenPath,
  loadSavedTokens,
  saveTokens,
};
