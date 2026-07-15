const fs = require("fs");
const http = require("http");
const path = require("path");
const { URL } = require("url");

const PORT = Number.parseInt(process.env.DASHBOARD_PORT || "3000", 10);
const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "output");

const FILES = {
  video: "horror_video.mp4",
  thumbnail: "thumbnail.png",
  caseNumber: "case_number.txt",
  title: "title.txt",
  youtube: "youtube.json",
  uploadReport: "upload_report.json",
  publishReport: "publish_report.json",
};

function exists(filePath) {
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

function readText(fileName) {
  const filePath = path.join(outputDir, fileName);
  if (!exists(filePath)) return "";
  return fs.readFileSync(filePath, "utf8").trim();
}

function readJson(fileName) {
  const text = readText(fileName);
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch (_error) {
    return null;
  }
}

function getFileInfo(fileName) {
  const filePath = path.join(outputDir, fileName);
  if (!exists(filePath)) return null;
  const stats = fs.statSync(filePath);
  return {
    fileName,
    path: `/assets/${encodeURIComponent(fileName)}`,
    size: stats.size,
    modifiedAt: stats.mtime.toISOString(),
  };
}

function getLatestGeneratedTime(fileInfos, reports) {
  const reportTime = reports
    .map((report) => report?.generatedAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  if (reportTime) return reportTime;

  return fileInfos
    .map((fileInfo) => fileInfo?.modifiedAt)
    .filter(Boolean)
    .sort()
    .at(-1) || null;
}

function getPublishStatus(uploadReport, publishReport) {
  if (uploadReport) {
    if (uploadReport.uploaded) return `Uploaded (${uploadReport.privacyStatus || "unknown"})`;
    if (uploadReport.mode === "mock") return "Mock publish validated";
    return `Publish report ready (${uploadReport.mode || "unknown"})`;
  }

  if (publishReport) return "Publishing pack ready";
  return "Not published";
}

function buildDashboardData() {
  const video = getFileInfo(FILES.video);
  const thumbnail = getFileInfo(FILES.thumbnail);
  const youtube = readJson(FILES.youtube);
  const uploadReport = readJson(FILES.uploadReport);
  const publishReport = readJson(FILES.publishReport);

  return {
    video,
    thumbnail,
    caseNumber: readText(FILES.caseNumber) || "No case generated",
    storyTitle: readText(FILES.title) || youtube?.title || "No story title yet",
    publishStatus: getPublishStatus(uploadReport, publishReport),
    lastGeneratedTime: getLatestGeneratedTime([video, thumbnail], [uploadReport, publishReport]),
    outputFolder: outputDir,
  };
}

function send(response, statusCode, contentType, body, headers = {}) {
  response.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    ...headers,
  });
  response.end(body);
}

function serveAsset(response, fileName) {
  const safeFileName = path.basename(fileName);
  const filePath = path.join(outputDir, safeFileName);

  if (!exists(filePath)) {
    send(response, 404, "text/plain; charset=utf-8", "Asset not found");
    return;
  }

  const extension = path.extname(safeFileName).toLowerCase();
  const contentTypes = {
    ".mp4": "video/mp4",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
  };

  response.writeHead(200, {
    "Content-Type": contentTypes[extension] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  fs.createReadStream(filePath).pipe(response);
}

function html() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MidnightOS Dashboard</title>
  <style>
    :root { color-scheme: dark; --blood:#b20812; --ember:#ff3434; --ink:#040406; --fog:#a8a0a0; }
    * { box-sizing: border-box; }
    body { margin:0; min-height:100vh; font-family: Georgia, 'Times New Roman', serif; background: radial-gradient(circle at 50% 0%, #2a0508, var(--ink) 44%, #000 100%); color:#f3eeee; }
    body::before { content:""; position:fixed; inset:0; pointer-events:none; background: repeating-linear-gradient(0deg, rgba(255,255,255,.025), rgba(255,255,255,.025) 1px, transparent 1px, transparent 4px); mix-blend-mode:screen; }
    main { width:min(1180px, 94vw); margin:0 auto; padding:38px 0 52px; }
    header { border:1px solid rgba(178,8,18,.55); background:linear-gradient(135deg, rgba(25,0,3,.9), rgba(4,4,6,.78)); box-shadow:0 0 60px rgba(178,8,18,.22); padding:28px; position:relative; overflow:hidden; }
    header::after { content:"CLASSIFIED"; position:absolute; right:-14px; top:16px; transform:rotate(12deg); color:rgba(255,52,52,.16); font-size:64px; letter-spacing:8px; font-weight:900; }
    h1 { margin:0; letter-spacing:5px; text-transform:uppercase; font-size:clamp(2rem, 5vw, 4.5rem); }
    .subtitle { margin:8px 0 0; color:var(--fog); letter-spacing:3px; text-transform:uppercase; }
    .grid { display:grid; grid-template-columns: 1.3fr .7fr; gap:22px; margin-top:22px; }
    .panel { border:1px solid rgba(178,8,18,.42); background:rgba(5,5,8,.82); box-shadow:inset 0 0 28px rgba(178,8,18,.08), 0 18px 50px rgba(0,0,0,.5); padding:20px; }
    .panel h2 { margin:0 0 16px; color:#fff; letter-spacing:2px; text-transform:uppercase; font-size:1rem; }
    video, img { width:100%; display:block; border:1px solid rgba(255,255,255,.12); background:#090909; }
    video { aspect-ratio:9 / 16; max-height:70vh; object-fit:contain; }
    img { aspect-ratio:16 / 9; object-fit:cover; }
    .empty { min-height:260px; border:1px dashed rgba(255,52,52,.35); display:grid; place-items:center; color:#9a8f8f; text-align:center; padding:24px; background:rgba(0,0,0,.35); }
    dl { margin:0; display:grid; gap:14px; }
    dt { color:#9a8f8f; text-transform:uppercase; letter-spacing:2px; font-size:.72rem; }
    dd { margin:4px 0 0; font-size:1.12rem; line-height:1.35; }
    .status { color:var(--ember); text-shadow:0 0 18px rgba(255,52,52,.45); }
    .case { font-size:2.15rem; letter-spacing:3px; }
    footer { margin-top:18px; color:#7f7373; font-size:.9rem; text-align:center; }
    @media (max-width: 860px) { .grid { grid-template-columns:1fr; } header::after { display:none; } }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>MidnightOS</h1>
      <p class="subtitle">Local generation dashboard // output folder feed</p>
    </header>
    <section class="grid">
      <article class="panel">
        <h2>Latest Generated Video</h2>
        <div id="videoSlot" class="empty">Waiting for horror_video.mp4 in output folder...</div>
      </article>
      <aside class="panel">
        <h2>Case Telemetry</h2>
        <dl>
          <div><dt>Current Case Number</dt><dd id="caseNumber" class="case">—</dd></div>
          <div><dt>Story Title</dt><dd id="storyTitle">—</dd></div>
          <div><dt>Publish Status</dt><dd id="publishStatus" class="status">—</dd></div>
          <div><dt>Last Generated Time</dt><dd id="lastGeneratedTime">—</dd></div>
        </dl>
        <h2 style="margin-top:24px">Latest Thumbnail</h2>
        <div id="thumbnailSlot" class="empty">Waiting for thumbnail.png...</div>
      </aside>
    </section>
    <footer id="outputFolder"></footer>
  </main>
  <script>
    function formatDate(value) {
      if (!value) return "No generated assets found";
      return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value));
    }
    async function refresh() {
      const response = await fetch('/api/dashboard', { cache: 'no-store' });
      const data = await response.json();
      document.getElementById('caseNumber').textContent = data.caseNumber;
      document.getElementById('storyTitle').textContent = data.storyTitle;
      document.getElementById('publishStatus').textContent = data.publishStatus;
      document.getElementById('lastGeneratedTime').textContent = formatDate(data.lastGeneratedTime);
      document.getElementById('outputFolder').textContent = 'Reading: ' + data.outputFolder;
      document.getElementById('videoSlot').outerHTML = data.video ? '<video id="videoSlot" controls preload="metadata" src="' + data.video.path + '?t=' + Date.now() + '"></video>' : '<div id="videoSlot" class="empty">Waiting for horror_video.mp4 in output folder...</div>';
      document.getElementById('thumbnailSlot').outerHTML = data.thumbnail ? '<img id="thumbnailSlot" alt="Latest MidnightOS thumbnail" src="' + data.thumbnail.path + '?t=' + Date.now() + '">' : '<div id="thumbnailSlot" class="empty">Waiting for thumbnail.png...</div>';
    }
    refresh();
    setInterval(refresh, 15000);
  </script>
</body>
</html>`;
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);

  if (requestUrl.pathname === "/") {
    send(response, 200, "text/html; charset=utf-8", html());
    return;
  }

  if (requestUrl.pathname === "/api/dashboard") {
    send(response, 200, "application/json; charset=utf-8", JSON.stringify(buildDashboardData(), null, 2));
    return;
  }

  if (requestUrl.pathname.startsWith("/assets/")) {
    serveAsset(response, decodeURIComponent(requestUrl.pathname.replace("/assets/", "")));
    return;
  }

  send(response, 404, "text/plain; charset=utf-8", "Not found");
});

server.listen(PORT, () => {
  console.log(`🩸 MidnightOS Dashboard running at http://localhost:${PORT}`);
  console.log(`📁 Reading output folder: ${outputDir}`);
});
