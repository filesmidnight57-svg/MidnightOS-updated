require("dotenv").config();

const http = require("http");
const https = require("https");
const { URL } = require("url");

const DEFAULT_REDIRECT_URI = "http://localhost:53682/oauth2callback";
const YOUTUBE_UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload";

function getOAuthConfig() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI || DEFAULT_REDIRECT_URI;

  if (!clientId || !clientSecret) {
    throw new Error("Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET before running OAuth setup.");
  }

  return { clientId, clientSecret, redirectUri };
}

function buildAuthUrl({ clientId, redirectUri }) {
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", YOUTUBE_UPLOAD_SCOPE);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  return authUrl.toString();
}

function requestJson(url, options = {}, body) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, options, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let data = {};
        if (text) {
          try {
            data = JSON.parse(text);
          } catch (error) {
            reject(new Error(`OAuth response was not valid JSON: ${text}`));
            return;
          }
        }

        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`OAuth token exchange failed (${response.statusCode}): ${text}`));
          return;
        }

        resolve(data);
      });
    });

    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
}

async function exchangeCodeForTokens(code, config = getOAuthConfig()) {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
  }).toString();

  return requestJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(body),
    },
  }, body);
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

  if (!tokens.refresh_token) {
    throw new Error("Google did not return a refresh token. Revoke app access and retry with prompt=consent.");
  }

  console.log("\nAdd this value to your .env file:");
  console.log(`YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}`);
}

if (require.main === module) {
  runOAuthSetup().catch((error) => {
    console.error(`❌ YouTube OAuth setup failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  YOUTUBE_UPLOAD_SCOPE,
  buildAuthUrl,
  exchangeCodeForTokens,
};
