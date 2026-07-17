require("dotenv").config();

const fs = require("fs");
const path = require("path");
const generateStory = require("./ai/story");
const generateCaption = require("./ai/caption");
const generateHashtags = require("./ai/hashtags");
const generateDirectorPlan = require("./ai/director");
const generateImage = require("./image");
const generateVoice = require("./ai/voice/generateVoice");
const generateVideo = require("./videoGenerator");
const generatePublishingPack = require("./publishing");
const getNextCaseNumber = require("./utils/caseManager");
const { createCaseOutputDir } = require("./utils/outputContext");

const UTF8_ENCODING = "utf8";

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function saveTextFile(outputDir, fileName, content) {
  fs.writeFileSync(path.join(outputDir, fileName), content, { encoding: UTF8_ENCODING });
}

function saveJsonFile(outputDir, fileName, data) {
  fs.writeFileSync(path.join(outputDir, fileName), JSON.stringify(data, null, 2), { encoding: UTF8_ENCODING });
}

function hasSuspiciousMojibake(text) {
  return /(?:à¤|à¥|Ã|Â|â€|ðŸ)/.test(String(text || ""));
}

function hasDevanagari(text) {
  return /[\u0900-\u097F]/.test(String(text || ""));
}

function validatePublishingMetadata(outputDir) {
  const title = fs.readFileSync(path.join(outputDir, "title.txt"), UTF8_ENCODING);
  const youtubeText = fs.readFileSync(path.join(outputDir, "youtube.json"), UTF8_ENCODING);
  if (hasSuspiciousMojibake(title) || hasSuspiciousMojibake(youtubeText)) {
    throw new Error("Publishing metadata is still corrupted: title.txt or youtube.json contains suspicious mojibake patterns.");
  }

  const caption = fs.readFileSync(path.join(outputDir, "caption.txt"), UTF8_ENCODING);
  if (hasDevanagari(caption) && !hasDevanagari(`${title}\n${youtubeText}`)) {
    throw new Error("Publishing metadata validation failed: valid Devanagari source text was not preserved in generated metadata.");
  }
}

async function generateCase() {
  console.log("🚀 MidnightOS AI Director Started\n");
  const caseNumber = getNextCaseNumber();
  const outputDir = createCaseOutputDir(caseNumber);
  console.log(`📂 New Case Assigned: ${caseNumber}`);
  console.log(`📁 Case output: ${outputDir}`);

  console.log("📖 Generating Hindi Case Story...");
  const story = await generateStory();
  console.log("📝 Generating Caption...");
  const caption = await generateCaption(story);
  console.log("#️⃣ Generating Hashtags...");
  const hashtags = await generateHashtags(story);
  console.log("🎬 AI Director is planning the complete film...");
  const directorPlan = await generateDirectorPlan(story);
  directorPlan.caseInfo = directorPlan.caseInfo || {};
  directorPlan.caseInfo.caseNumber = caseNumber;
  const scenes = directorPlan.scenes;

  saveTextFile(outputDir, "story.txt", story);
  saveTextFile(outputDir, "caption.txt", caption);
  saveTextFile(outputDir, "hashtags.txt", hashtags);
  saveTextFile(outputDir, "case_number.txt", caseNumber);
  saveJsonFile(outputDir, "director.json", directorPlan);
  saveJsonFile(outputDir, "scenes.json", scenes);

  console.log("\n🖼️ Generating Director-Guided Scene Images...");
  const sceneImagePaths = [];
  for (let index = 0; index < scenes.length; index += 1) {
    const scene = scenes[index];
    const fileName = `scene_${String(index + 1).padStart(2, "0")}.png`;
    console.log(`\n🖼️ Generating Scene ${index + 1}/${scenes.length}`);
    const imagePath = await generateImage(scene.imagePrompt, fileName, outputDir);
    sceneImagePaths.push(imagePath);
    if (index === 0) fs.copyFileSync(imagePath, path.join(outputDir, "horror_image.png"));
    if (index < scenes.length - 1) await wait(2000);
  }

  console.log("\n🎤 Generating Hindi Voice and Subtitles...");
  await generateVoice(story, outputDir);
  console.log("\n🎬 Rendering Final Director-Guided Video...");
  await generateVideo(sceneImagePaths, outputDir);
  console.log("\n📣 Creating AI Publishing Pack...");
  generatePublishingPack(outputDir);
  validatePublishingMetadata(outputDir);
  console.log(`\n✅ Case generated successfully: ${outputDir}`);
  return { caseNumber, outputDir };
}

if (require.main === module) {
  generateCase().catch((error) => {
    console.error("\n❌ MIDNIGHTOS AI DIRECTOR ERROR:\n");
    console.error(error.response?.data || error.message);
    process.exitCode = 1;
  });
}

module.exports = { generateCase, validatePublishingMetadata };
