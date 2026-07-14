const axios = require("axios");
const fs = require("fs");
const path = require("path");

const outputDir = path.join(__dirname, "../output");

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
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
        throw new Error(
          `${fileName} generation failed after ${maximumAttempts} attempts: ${error.message}`
        );
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