require("dotenv").config();

const fs = require("fs");
const path = require("path");
const https = require("https");
const { Transform } = require("stream");
const { getAccessToken, getMissingCredentialsMessage } = require("./youtubeOAuth");

const DEFAULT_OUTPUT_DIR = path.join(__dirname, "../output");
const VALID_PRIVACY_STATUSES = new Set(["private", "unlisted", "public"]);

function normalizeMode(value) {
  const mode = String(value || "dry-run").trim().toLowerCase();
  if (["live", "upload"].includes(mode)) return "live";
  if (["dry-run", "dryrun", "mock", "test"].includes(mode)) return "dry-run";
  throw new Error(`Invalid YouTube publish mode "${value}". Use dry-run or live.`);
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

function readTextFile(filePath, label) {
  assertReadableFile(filePath, label);
  return fs.readFileSync(filePath, "utf8").trim();
}

function normalizeTags(tagsText) {
  return String(tagsText || "")
    .split(/[\n,]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function ensureShortsDescription(description) {
  const text = String(description || "").trim();
  return /(^|\s)#shorts(\s|$)/i.test(text) ? text : `${text}${text ? "\n\n" : ""}#Shorts`;
}

function loadPublishingInputs(outputDir = DEFAULT_OUTPUT_DIR, options = {}) {
  const videoPath = path.join(outputDir, "horror_video.mp4");
  const thumbnailPath = path.join(outputDir, "thumbnail.png");
  const titlePath = path.join(outputDir, "title.txt");
  const descriptionPath = path.join(outputDir, "description.txt");
  const tagsPath = path.join(outputDir, "tags.txt");

  const videoStats = assertReadableFile(videoPath, "YouTube video");
  const thumbnailStats = assertReadableFile(thumbnailPath, "YouTube thumbnail");
  const title = readTextFile(titlePath, "YouTube title");
  const description = ensureShortsDescription(readTextFile(descriptionPath, "YouTube description"));
  const tags = normalizeTags(readTextFile(tagsPath, "YouTube tags"));
  const privacyStatus = normalizePrivacyStatus(
    options.privacyStatus || process.env.YOUTUBE_PRIVACY_STATUS || "private"
  );

  if (!title) {
    throw new Error("title.txt must include a non-empty title.");
  }

  return {
    outputDir,
    files: {
      video: { path: videoPath, bytes: videoStats.size },
      thumbnail: { path: thumbnailPath, bytes: thumbnailStats.size },
      title: { path: titlePath },
      description: { path: descriptionPath },
      tags: { path: tagsPath },
    },
    metadata: {
      title,
      description,
      tags,
      categoryId: "24",
      category: "Entertainment",
      privacyStatus,
    },
  };
}

function parseJsonResponse(text, label) {
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} returned invalid JSON: ${text}`);
  }
}

function requestJson(url, options = {}, body) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, options, (response) => {
      const chunks = [];

      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let data = {};

        try {
          data = parseJsonResponse(text, "YouTube API");
        } catch (error) {
          reject(error);
          return;
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

function requestStream(url, options, stream) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, options, (response) => {
      const chunks = [];

      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let data = {};

        try {
          data = parseJsonResponse(text, "YouTube upload");
        } catch (error) {
          reject(error);
          return;
        }

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


function createProgressStream(totalBytes, label) {
  let uploadedBytes = 0;
  let lastPrintedPercent = -1;

  return new Transform({
    transform(chunk, encoding, callback) {
      uploadedBytes += chunk.length;
      const percent = totalBytes > 0 ? Math.floor((uploadedBytes / totalBytes) * 100) : 100;
      if (percent !== lastPrintedPercent && (percent === 100 || percent - lastPrintedPercent >= 5)) {
        lastPrintedPercent = percent;
        console.log(`${label} progress: ${Math.min(percent, 100)}% (${uploadedBytes}/${totalBytes} bytes)`);
      }
      callback(null, chunk);
    },
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
  console.log("🚀 Upload Started");
  const accessToken = await getAccessToken();
  const metadata = {
    snippet: {
      title: inputs.metadata.title,
      description: inputs.metadata.description,
      tags: inputs.metadata.tags,
      categoryId: inputs.metadata.categoryId,
    },
    status: {
      privacyStatus: inputs.metadata.privacyStatus,
      selfDeclaredMadeForKids: false,
    },
  };

  console.log("📤 Uploading Video...");

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

  const videoStream = fs.createReadStream(inputs.files.video.path)
    .pipe(createProgressStream(inputs.files.video.bytes, "Video upload"));

  const insertResponse = await requestStream(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Length": inputs.files.video.bytes,
      "Content-Type": "video/mp4",
    },
  }, videoStream);

  const videoId = insertResponse.data.id;
  if (!videoId) {
    throw new Error("YouTube upload did not return a video ID.");
  }

  console.log(`✅ YouTube Video ID: ${videoId}`);
  console.log("🖼 Uploading Thumbnail...");

  const thumbnailMultipart = createMultipartBody({}, inputs.files.thumbnail.path, "image/png", "media");

  await requestJson(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?uploadType=multipart&videoId=${encodeURIComponent(videoId)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${thumbnailMultipart.boundary}`,
      "Content-Length": thumbnailMultipart.body.length,
    },
  }, thumbnailMultipart.body);

  console.log(`Thumbnail upload progress: 100% (${inputs.files.thumbnail.bytes}/${inputs.files.thumbnail.bytes} bytes)`);

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  console.log("✅ Upload Complete");
  console.log(`🔗 Video URL: ${videoUrl}`);

  return {
    uploaded: true,
    videoId,
    url: videoUrl,
    apiResponseStatus: insertResponse.statusCode,
  };
}

function buildDryRunResult(inputs) {
  return {
    uploaded: false,
    dryRun: true,
    mock: true,
    message: "Dry-run completed. No YouTube API upload was performed.",
    plannedShortsUrl: null,
    validatedAssets: {
      videoBytes: inputs.files.video.bytes,
      thumbnailBytes: inputs.files.thumbnail.bytes,
    },
  };
}

function parseCliOptions(argv = process.argv.slice(2)) {
  const options = {};

  for (const arg of argv) {
    if (arg === "--dry-run") options.mode = "dry-run";
    if (arg === "--live" || arg === "--upload") options.mode = "live";
    if (arg.startsWith("--privacy=")) options.privacyStatus = arg.split("=")[1];
  }

  return options;
}

function writeUploadReport(outputDir, report) {
  const reportPath = path.join(outputDir, "upload_report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  return reportPath;
}

function buildUploadReport(mode, inputs, result, error) {
  return {
    generatedAt: new Date().toISOString(),
    mode,
    platform: "youtube",
    format: "video",
    uploaded: Boolean(result && result.uploaded),
    ...(result && result.url ? { videoUrl: result.url } : {}),
    privacyStatus: inputs ? inputs.metadata.privacyStatus : undefined,
    metadata: inputs ? inputs.metadata : undefined,
    files: inputs ? {
      video: path.basename(inputs.files.video.path),
      thumbnail: path.basename(inputs.files.thumbnail.path),
      title: path.basename(inputs.files.title.path),
      description: path.basename(inputs.files.description.path),
      tags: path.basename(inputs.files.tags.path),
    } : undefined,
    result: result || { uploaded: false },
    ...(error ? { error: { message: error.message } } : {}),
  };
}

async function publishYouTubeShorts(options = {}) {
  const outputDir = options.outputDir || process.env.MIDNIGHTOS_OUTPUT_DIR || DEFAULT_OUTPUT_DIR;
  const mode = normalizeMode(options.mode || process.env.YOUTUBE_PUBLISH_MODE);
  let inputs;

  try {
    inputs = loadPublishingInputs(outputDir, options);
    if (mode === "live" && !process.env.YOUTUBE_CLIENT_ID) {
      throw new Error(getMissingCredentialsMessage());
    }

    const result = mode === "live" ? await uploadLive(inputs) : buildDryRunResult(inputs);
    const report = buildUploadReport(mode, inputs, result);
    const reportPath = writeUploadReport(outputDir, report);
    return { reportPath, report, videoUrl: report.videoUrl, videoId: result.videoId };
  } catch (error) {
    const report = buildUploadReport(mode, inputs, { uploaded: false }, error);
    try {
      const reportPath = writeUploadReport(outputDir, report);
      error.reportPath = reportPath;
    } catch (reportError) {
      error.reportWriteError = reportError.message;
    }
    throw error;
  }
}

if (require.main === module) {
  publishYouTubeShorts(parseCliOptions())
    .then(({ reportPath, report }) => {
      console.log(`✅ YouTube Publisher finished in ${report.mode} mode.`);
      console.log(`📝 Upload report saved: ${reportPath}`);
      if (report.mode === "dry-run") console.log("🧪 No upload was performed.");
      if (report.result.videoId) console.log(`✅ YouTube Video ID: ${report.result.videoId}`);
      if (report.videoUrl) console.log(`🔗 Video URL: ${report.videoUrl}`);
    })
    .catch((error) => {
      console.error(`❌ YouTube Publisher failed: ${error.message}`);
      if (error.reportPath) console.error(`📝 Failure report saved: ${error.reportPath}`);
      if (error.reportWriteError) console.error(`⚠️ Could not save failure report: ${error.reportWriteError}`);
      process.exitCode = 1;
    });
}

module.exports = {
  publishYouTubeShorts,
  loadPublishingInputs,
  normalizeMode,
  normalizePrivacyStatus,
  parseCliOptions,
};
