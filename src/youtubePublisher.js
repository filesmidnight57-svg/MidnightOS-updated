require("dotenv").config();

const fs = require("fs");
const path = require("path");
const https = require("https");

const DEFAULT_OUTPUT_DIR = path.join(__dirname, "../output");
const VALID_PRIVACY_STATUSES = new Set(["private", "unlisted", "public"]);

function normalizeMode(value) {
  return String(value || "mock").trim().toLowerCase() === "live" ? "live" : "mock";
}

function normalizePrivacyStatus(value) {
  const privacyStatus = String(value || "private").trim().toLowerCase();

  if (!VALID_PRIVACY_STATUSES.has(privacyStatus)) {
    throw new Error(
      `Invalid YouTube privacy status "${value}". Use private, unlisted, or public.`
    );
  }

  return privacyStatus;
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assertReadableFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${label}: ${filePath}`);
  }

  const stats = fs.statSync(filePath);
  if (!stats.isFile()) {
    throw new Error(`${label} is not a file: ${filePath}`);
  }

  return stats;
}

function getStringField(metadata, fieldName, fallback = "") {
  return String(metadata[fieldName] || fallback).trim();
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag).trim()).filter(Boolean);
  }

  if (typeof tags === "string") {
    return tags.split(/[\n,]/).map((tag) => tag.trim()).filter(Boolean);
  }

  return [];
}

function ensureShortsDescription(description) {
  const text = String(description || "").trim();
  return /(^|\s)#shorts(\s|$)/i.test(text) ? text : `${text}${text ? "\n\n" : ""}#Shorts`;
}

function loadPublishingInputs(outputDir = DEFAULT_OUTPUT_DIR) {
  const videoPath = path.join(outputDir, "horror_video.mp4");
  const thumbnailPath = path.join(outputDir, "thumbnail.png");
  const metadataPath = path.join(outputDir, "youtube.json");

  const videoStats = assertReadableFile(videoPath, "YouTube Shorts video");
  const thumbnailStats = assertReadableFile(thumbnailPath, "YouTube thumbnail");
  assertReadableFile(metadataPath, "YouTube metadata");

  const metadata = readJsonFile(metadataPath);
  const title = getStringField(metadata, "title", "MidnightOS Horror Short");
  const description = ensureShortsDescription(getStringField(metadata, "description"));
  const tags = normalizeTags(metadata.tags);
  const privacyStatus = normalizePrivacyStatus(
    process.env.YOUTUBE_PRIVACY_STATUS || metadata.privacyStatus || metadata.privacy || "private"
  );

  if (!title) {
    throw new Error("youtube.json must include a non-empty title.");
  }

  return {
    outputDir,
    files: {
      video: { path: videoPath, bytes: videoStats.size },
      thumbnail: { path: thumbnailPath, bytes: thumbnailStats.size },
      metadata: { path: metadataPath },
    },
    metadata: {
      title,
      description,
      tags,
      privacyStatus,
    },
  };
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
          data = JSON.parse(text);
        }

        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`YouTube API request failed (${response.statusCode}): ${text}`));
          return;
        }

        resolve({ data, headers: response.headers, statusCode: response.statusCode });
      });
    });

    request.on("error", reject);
    if (body) request.write(body);
    request.end();
  });
}

async function getAccessToken() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Live YouTube publishing requires YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REFRESH_TOKEN."
    );
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  }).toString();

  const response = await requestJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(body),
    },
  }, body);

  return response.data.access_token;
}

function requestStream(url, options, stream) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, options, (response) => {
      const chunks = [];

      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        const data = text ? JSON.parse(text) : {};

        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`YouTube upload failed (${response.statusCode}): ${text}`));
          return;
        }

        resolve({ data, headers: response.headers, statusCode: response.statusCode });
      });
    });

    request.on("error", reject);
    stream.on("error", reject);
    stream.pipe(request);
  });
}

function createMultipartBody(metadata, filePath, contentType, fileFieldName) {
  const boundary = `midnightos-${Date.now()}`;
  const file = fs.readFileSync(filePath);
  const parts = [
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${contentType}\r\nContent-Disposition: form-data; name="${fileFieldName}"; filename="${path.basename(filePath)}"\r\n\r\n`),
    file,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ];

  return { body: Buffer.concat(parts), boundary };
}

async function uploadLive(inputs) {
  const accessToken = await getAccessToken();
  const metadata = {
    snippet: {
      title: inputs.metadata.title,
      description: inputs.metadata.description,
      tags: inputs.metadata.tags,
      categoryId: "24",
    },
    status: {
      privacyStatus: inputs.metadata.privacyStatus,
      selfDeclaredMadeForKids: false,
    },
  };

  const startResponse = await requestJson("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "Content-Length": Buffer.byteLength(JSON.stringify(metadata)),
      "X-Upload-Content-Length": inputs.files.video.bytes,
      "X-Upload-Content-Type": "video/mp4",
    },
  }, JSON.stringify(metadata));

  const uploadUrl = startResponse.headers.location;
  if (!uploadUrl) {
    throw new Error("YouTube did not return a resumable upload URL.");
  }

  const insertResponse = await requestStream(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Length": inputs.files.video.bytes,
      "Content-Type": "video/mp4",
    },
  }, fs.createReadStream(inputs.files.video.path));

  const videoId = insertResponse.data.id;
  const thumbnailMultipart = createMultipartBody({}, inputs.files.thumbnail.path, "image/png", "media");

  await requestJson(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?uploadType=multipart&videoId=${encodeURIComponent(videoId)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${thumbnailMultipart.boundary}`,
      "Content-Length": thumbnailMultipart.body.length,
    },
  }, thumbnailMultipart.body);

  return {
    uploaded: true,
    videoId,
    url: `https://www.youtube.com/shorts/${videoId}`,
    apiResponseStatus: insertResponse.statusCode,
  };
}

function buildMockResult(inputs) {
  return {
    uploaded: false,
    mock: true,
    message: "Mock mode completed. No YouTube API upload was performed.",
    plannedShortsUrl: null,
    validatedAssets: {
      videoBytes: inputs.files.video.bytes,
      thumbnailBytes: inputs.files.thumbnail.bytes,
    },
  };
}

function writeUploadReport(outputDir, report) {
  const reportPath = path.join(outputDir, "upload_report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  return reportPath;
}

async function publishYouTubeShorts(options = {}) {
  const outputDir = options.outputDir || process.env.MIDNIGHTOS_OUTPUT_DIR || DEFAULT_OUTPUT_DIR;
  const mode = normalizeMode(options.mode || process.env.YOUTUBE_PUBLISH_MODE);
  const inputs = loadPublishingInputs(outputDir);
  const result = mode === "live" ? await uploadLive(inputs) : buildMockResult(inputs);

  const report = {
    generatedAt: new Date().toISOString(),
    mode,
    platform: "youtube",
    format: "shorts",
    uploaded: result.uploaded,
    privacyStatus: inputs.metadata.privacyStatus,
    metadata: inputs.metadata,
    files: {
      video: path.basename(inputs.files.video.path),
      thumbnail: path.basename(inputs.files.thumbnail.path),
      youtube: path.basename(inputs.files.metadata.path),
    },
    result,
  };

  const reportPath = writeUploadReport(outputDir, report);
  return { reportPath, report };
}

if (require.main === module) {
  publishYouTubeShorts()
    .then(({ reportPath, report }) => {
      console.log(`✅ YouTube Publisher finished in ${report.mode} mode.`);
      console.log(`📝 Upload report saved: ${reportPath}`);
      if (report.mode === "mock") console.log("🧪 No upload was performed.");
    })
    .catch((error) => {
      console.error(`❌ YouTube Publisher failed: ${error.message}`);
      process.exitCode = 1;
    });
}

module.exports = {
  publishYouTubeShorts,
  loadPublishingInputs,
  normalizePrivacyStatus,
};
