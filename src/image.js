const axios = require("axios");
const fs = require("fs");
const path = require("path");

const outputDir = path.join(__dirname, "../output");

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function createFallbackPng(imagePath, prompt) {
  const width = 720;
  const height = 1280;
  const zlib = require("zlib");
  const rowLength = 1 + width * 3;
  const raw = Buffer.alloc(rowLength * height);

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * rowLength;
    raw[rowStart] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = rowStart + 1 + x * 3;
      const glow = Math.max(0, 120 - Math.abs(x - width / 2) / 3 - Math.abs(y - height / 2) / 6);
      raw[offset] = Math.floor(8 + glow / 3);
      raw[offset + 1] = Math.floor(10 + glow / 5);
      raw[offset + 2] = Math.floor(18 + glow / 2);
    }
  }

  function crc32(buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer) {
      crc ^= byte;
      for (let index = 0; index < 8; index += 1) {
        crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const typeBuffer = Buffer.from(type);
    const output = Buffer.alloc(12 + data.length);
    output.writeUInt32BE(data.length, 0);
    typeBuffer.copy(output, 4);
    data.copy(output, 8);
    output.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
    return output;
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const metadata = Buffer.from(String(prompt || "MidnightOS fallback horror frame").slice(0, 200));
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("tEXt", Buffer.concat([Buffer.from("Prompt\0"), metadata])),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);

  fs.writeFileSync(imagePath, png);
}

async function downloadImage(prompt, imagePath) {
  const imageUrl =
    `https://image.pollinations.ai/prompt/` +
    encodeURIComponent(prompt);

  const response = await axios({
    url: imageUrl,
    method: "GET",
    responseType: "arraybuffer",
    timeout: 180000,
    headers: {
      "User-Agent": "MidnightOS/1.0",
      Accept: "image/*",
    },
  });

  if (!response.data || response.data.length < 1000) {
    throw new Error("Pollinations ne valid image return nahi ki.");
  }

  fs.writeFileSync(imagePath, response.data);

  if (!fs.existsSync(imagePath)) {
    throw new Error("Image file save nahi hui.");
  }

  return imagePath;
}

async function generateImage(
  prompt,
  fileName = "horror_image.png"
) {
  if (!prompt || !prompt.trim()) {
    throw new Error("Image prompt empty hai.");
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const imagePath = path.join(outputDir, fileName);

  const maximumAttempts = 3;

  for (
    let attempt = 1;
    attempt <= maximumAttempts;
    attempt += 1
  ) {
    try {
      await downloadImage(prompt, imagePath);

      console.log(`🖼️ ${fileName} Generated Successfully!`);

      return imagePath;
    } catch (error) {
      if (attempt === maximumAttempts) {
        console.warn(
          `⚠️ ${fileName} remote image generation failed after ${maximumAttempts} attempts: ${error.message}`
        );
        console.warn("⚠️ Using deterministic offline fallback image so the pipeline can continue.");
        createFallbackPng(imagePath, prompt);
        return imagePath;
      }

      console.log(
        `⚠️ ${fileName} attempt ${attempt} failed. Retrying...`
      );

      await wait(3000);
    }
  }

  throw new Error(`${fileName} generate nahi hui.`);
}

module.exports = generateImage;