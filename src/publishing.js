const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const THUMBNAIL_WIDTH = 1280;
const THUMBNAIL_HEIGHT = 720;
const TAG_COUNT = 20;
const UTF8_ENCODING = "utf8";

const FONT = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10011", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  3: ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  5: ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  6: ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  "#": ["01010", "11111", "01010", "01010", "11111", "01010", "01010"],
  ":": ["00000", "00100", "00100", "00000", "00100", "00100", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
};

function readText(outputDir, fileName) {
  return fs.readFileSync(path.join(outputDir, fileName), UTF8_ENCODING).trim();
}

function readJson(outputDir, fileName) {
  return JSON.parse(readText(outputDir, fileName));
}

function hasUnicodeMojibake(text) {
  return /(?:à¤|à¥|Ã|Â|â€|ðŸ)/.test(String(text || ""));
}

function repairUnicodeMojibake(text) {
  const value = String(text || "");
  if (!hasUnicodeMojibake(value)) return value;

  const latin1Text = value.replace(/[\u20ac\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u017d\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u017e\u0178]/g, (char) => String.fromCharCode({
    "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87,
    "ˆ": 0x88, "‰": 0x89, "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91,
    "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "˜": 0x98,
    "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f,
  }[char]));

  return Buffer.from(latin1Text, "latin1").toString("utf8");
}

function normalizeSpaces(text) {
  return repairUnicodeMojibake(text).replace(/\s+/g, " ").trim();
}

function getCaseLabel(directorPlan) {
  const caseNumber = normalizeSpaces(directorPlan.caseInfo?.caseNumber);
  if (!caseNumber) return "";
  const digits = caseNumber.match(/\d+/)?.[0];
  return digits ? `CASE #${digits}` : caseNumber.toUpperCase();
}

function getCaseTitle(directorPlan, story) {
  return normalizeSpaces(directorPlan.caseInfo?.caseTitle)
    || normalizeSpaces(directorPlan.scenes?.[0]?.title)
    || normalizeSpaces(story).split(/[.!?।]/)[0]
    || "Midnight Horror Case";
}

function buildThumbnailText(directorPlan, story) {
  const caseLabel = getCaseLabel(directorPlan);
  if (caseLabel) return caseLabel.split(" ").slice(0, 2).join(" ");

  const titleWords = getCaseTitle(directorPlan, story)
    .replace(/[^a-z0-9#\s]/gi, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4);

  return (titleWords.length ? titleWords : ["MIDNIGHT", "CASE"]).join(" ").toUpperCase();
}

function fitTitle(title) {
  const clean = normalizeSpaces(title).replace(/[\r\n]/g, " ");
  if (clean.length >= 60 && clean.length <= 70) return clean;

  const suffix = " | Hindi Horror Case";
  let expanded = clean.includes("Horror") ? clean : `${clean}${suffix}`;
  if (expanded.length < 60) expanded = `${expanded} | Scary Mystery Story`;
  if (expanded.length > 70) expanded = expanded.slice(0, 70).replace(/\s+\S*$/, "");
  if (expanded.length < 60) expanded = expanded.padEnd(60, " ").trimEnd();
  return expanded;
}

function createTitle(directorPlan, story) {
  const caseLabel = getCaseLabel(directorPlan);
  const caseTitle = getCaseTitle(directorPlan, story);
  return fitTitle(`${caseLabel ? `${caseLabel}: ` : ""}${caseTitle} Horror Mystery`);
}

function parseHashtags(hashtags) {
  return normalizeSpaces(hashtags).split(/\s+/).filter((tag) => tag.startsWith("#"));
}

function createDescription(title, caption, hashtags) {
  const hashtagLine = parseHashtags(hashtags).join(" ");
  return [
    title,
    "",
    normalizeSpaces(caption),
    "",
    "Watch this Hindi horror mystery until the end, then subscribe for more MidnightOS classified cases, scary stories, and cinematic found-footage investigations.",
    "",
    hashtagLine,
  ].filter((line) => line !== undefined).join("\n");
}

function createTags(directorPlan, story) {
  const caseTitle = getCaseTitle(directorPlan, story).toLowerCase();
  const location = normalizeSpaces(directorPlan.caseInfo?.location).toLowerCase();
  const baseTags = [
    "Hindi horror story", "horror story", "scary story", "MidnightOS", "classified case",
    "found footage horror", "Indian horror", "ghost story", "true horror style", "creepy mystery",
    "paranormal investigation", "dark web horror", "short horror film", "horror shorts", "YouTube horror",
    "nightmare story", "urban legend", "case files", caseTitle, location && `${location} horror`,
    "cinematic horror", "psychological horror", "scary Hindi kahani",
  ];

  return [...new Set(baseTags.filter(Boolean))].slice(0, TAG_COUNT);
}

function createPinnedComment(title) {
  return `Which clue scared you the most in ${title}? Comment below, and subscribe for the next MidnightOS classified horror case.`;
}

function makeCrcTable() {
  const table = [];
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = makeCrcTable();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return chunk;
}

function setPixel(buffer, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= THUMBNAIL_WIDTH || y >= THUMBNAIL_HEIGHT) return;
  const rowLength = 1 + THUMBNAIL_WIDTH * 4;
  const index = y * rowLength + 1 + x * 4;
  buffer[index] = r; buffer[index + 1] = g; buffer[index + 2] = b; buffer[index + 3] = a;
}

function fillRect(buffer, x, y, width, height, color) {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) setPixel(buffer, xx, yy, ...color);
  }
}

function drawText(buffer, text, x, y, scale, color, shadowColor) {
  let cursorX = x;
  const drawLayer = (offsetX, offsetY, layerColor) => {
    let layerX = x + offsetX;
    for (const char of text.toUpperCase()) {
      if (char === " ") { layerX += scale * 4; continue; }
      const glyph = FONT[char] || FONT["-"];
      glyph.forEach((row, rowIndex) => {
        [...row].forEach((pixel, columnIndex) => {
          if (pixel === "1") fillRect(buffer, layerX + columnIndex * scale, y + offsetY + rowIndex * scale, scale, scale, layerColor);
        });
      });
      layerX += scale * 6;
    }
  };

  if (shadowColor) drawLayer(scale / 2, scale / 2, shadowColor);
  for (const char of text.toUpperCase()) {
    if (char === " ") { cursorX += scale * 4; continue; }
    const glyph = FONT[char] || FONT["-"];
    glyph.forEach((row, rowIndex) => {
      [...row].forEach((pixel, columnIndex) => {
        if (pixel === "1") fillRect(buffer, cursorX + columnIndex * scale, y + rowIndex * scale, scale, scale, color);
      });
    });
    cursorX += scale * 6;
  }
}

function createThumbnail(thumbnailPath, thumbnailText) {
  const rowLength = 1 + THUMBNAIL_WIDTH * 4;
  const raw = Buffer.alloc(rowLength * THUMBNAIL_HEIGHT);

  for (let y = 0; y < THUMBNAIL_HEIGHT; y += 1) {
    raw[y * rowLength] = 0;
    for (let x = 0; x < THUMBNAIL_WIDTH; x += 1) {
      const vignette = Math.floor(32 * (1 - Math.hypot(x - 640, y - 360) / 735));
      const red = x < 480 ? 36 + vignette : 8 + vignette;
      const green = 5 + Math.floor(vignette / 4);
      const blue = 10 + Math.floor(vignette / 3);
      setPixel(raw, x, y, red, green, blue, 255);
    }
  }

  fillRect(raw, 0, 0, 1280, 28, [120, 0, 0, 255]);
  fillRect(raw, 70, 105, 1140, 510, [0, 0, 0, 165]);
  fillRect(raw, 90, 125, 1100, 470, [18, 0, 0, 220]);
  fillRect(raw, 960, 0, 130, 720, [120, 0, 0, 255]);
  fillRect(raw, 1000, 0, 38, 720, [235, 10, 10, 255]);

  const words = thumbnailText.toUpperCase().split(/\s+/).slice(0, 4);
  const lines = words.length > 2 ? [words.slice(0, 2).join(" "), words.slice(2).join(" ")] : [words.join(" ")];
  const scale = lines.length > 1 ? 34 : 48;
  const startY = lines.length > 1 ? 210 : 255;
  lines.forEach((line, index) => drawText(raw, line, 140, startY + index * 245, scale, [245, 245, 230, 255], [0, 0, 0, 255]));

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(THUMBNAIL_WIDTH, 0);
  ihdr.writeUInt32BE(THUMBNAIL_HEIGHT, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  fs.writeFileSync(thumbnailPath, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]));
}

function writeUtf8Text(filePath, content) {
  fs.writeFileSync(filePath, content, { encoding: UTF8_ENCODING });
}

function writeJson(filePath, data) {
  writeUtf8Text(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function generatePublishingPack(outputDir) {
  const story = readText(outputDir, "story.txt");
  const directorPlan = readJson(outputDir, "director.json");
  const caption = repairUnicodeMojibake(readText(outputDir, "caption.txt"));
  const hashtags = repairUnicodeMojibake(readText(outputDir, "hashtags.txt"));

  const title = repairUnicodeMojibake(createTitle(directorPlan, story));
  const description = repairUnicodeMojibake(createDescription(title, caption, hashtags));
  const tags = createTags(directorPlan, story).map((tag) => repairUnicodeMojibake(tag));
  const pinnedComment = repairUnicodeMojibake(createPinnedComment(title));
  const thumbnailText = buildThumbnailText(directorPlan, story);

  createThumbnail(path.join(outputDir, "thumbnail.png"), thumbnailText);
  writeUtf8Text(path.join(outputDir, "title.txt"), `${title}\n`);
  writeUtf8Text(path.join(outputDir, "description.txt"), `${description}\n`);
  writeUtf8Text(path.join(outputDir, "tags.txt"), `${tags.join("\n")}\n`);
  writeUtf8Text(path.join(outputDir, "pinned_comment.txt"), `${pinnedComment}\n`);

  const youtube = { title, description, tags, thumbnail: "thumbnail.png" };
  writeJson(path.join(outputDir, "youtube.json"), youtube);
  writeJson(path.join(outputDir, "publish_report.json"), {
    generatedAt: new Date().toISOString(),
    sourceInputs: ["story.txt", "director.json", "caption.txt", "hashtags.txt"],
    assets: {
      thumbnail: { file: "thumbnail.png", size: "1280x720", style: "CTR-optimized horror, mobile-friendly, large readable text", text: thumbnailText },
      title: { file: "title.txt", characterCount: title.length, seoFocus: "Hindi horror mystery" },
      description: { file: "description.txt", includesHashtags: parseHashtags(hashtags).length > 0, includesCallToAction: true },
      tags: { file: "tags.txt", count: tags.length },
      pinnedComment: { file: "pinned_comment.txt" },
      youtubeMetadata: { file: "youtube.json" },
    },
  });

  return youtube;
}

module.exports = generatePublishingPack;
