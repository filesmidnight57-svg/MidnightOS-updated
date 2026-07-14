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

const getNextCaseNumber = require("./utils/caseManager");

const outputDir = path.join(__dirname, "../output");

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function prepareOutputFolder() {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, {
      recursive: true,
    });
  }

  const removableFiles = fs
    .readdirSync(outputDir)
    .filter((fileName) => {
      return (
        /^scene_\d{2}\.png$/i.test(fileName) ||
        fileName === "director.json" ||
        fileName === "scenes.json"
      );
    });

  removableFiles.forEach((fileName) => {
    fs.rmSync(path.join(outputDir, fileName), {
      force: true,
    });
  });
}

function saveTextFile(fileName, content) {
  fs.writeFileSync(
    path.join(outputDir, fileName),
    content,
    "utf8"
  );
}

function saveJsonFile(fileName, data) {
  fs.writeFileSync(
    path.join(outputDir, fileName),
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

async function main() {
  console.log("🚀 MidnightOS AI Director Started\n");

  prepareOutputFolder();

  const caseNumber = getNextCaseNumber();

  console.log(`📂 New Case Assigned: ${caseNumber}`);

  console.log("📖 Generating Hindi Case Story...");
  const story = await generateStory();

  console.log("📝 Generating Caption...");
  const caption = await generateCaption(story);

  console.log("#️⃣ Generating Hashtags...");
  const hashtags = await generateHashtags(story);

  console.log("🎬 AI Director is planning the complete film...");
  const directorPlan = await generateDirectorPlan(story);

  if (!directorPlan.caseInfo) {
    directorPlan.caseInfo = {};
  }

  directorPlan.caseInfo.caseNumber = caseNumber;

  const scenes = directorPlan.scenes;

  saveTextFile("story.txt", story);
  saveTextFile("caption.txt", caption);
  saveTextFile("hashtags.txt", hashtags);

  saveTextFile("case_number.txt", caseNumber);

  saveJsonFile("director.json", directorPlan);
  saveJsonFile("scenes.json", scenes);

  console.log("✅ AI Director Plan Created");
  console.log(
    `🎭 Main Character: ${directorPlan.mainCharacter.name}`
  );
  console.log(`📂 Case: ${caseNumber}`);
  console.log(`🎞️ ${scenes.length} Directed Scenes Created`);

  console.log("\n🖼️ Generating Director-Guided Scene Images...");

  const sceneImagePaths = [];

  for (let index = 0; index < scenes.length; index += 1) {
    const scene = scenes[index];

    const sceneNumber = String(index + 1).padStart(2, "0");
    const fileName = `scene_${sceneNumber}.png`;

    console.log(
      `\n🖼️ Generating Scene ${index + 1}/${scenes.length}`
    );
    console.log(`🎥 Camera: ${scene.cameraShot}`);
    console.log(`🎬 Motion: ${scene.cameraMovement}`);
    console.log(`🔍 Lens: ${scene.lens}`);
    console.log(`🌑 Mood: ${scene.mood}`);

    const imagePath = await generateImage(
      scene.imagePrompt,
      fileName
    );

    sceneImagePaths.push(imagePath);

    if (index === 0) {
      fs.copyFileSync(
        imagePath,
        path.join(outputDir, "horror_image.png")
      );
    }

    if (index < scenes.length - 1) {
      await wait(2000);
    }
  }

  console.log("\n🎤 Generating Hindi Voice and Subtitles...");
  await generateVoice(story);

  console.log("\n🎬 Rendering Final Director-Guided Video...");
  await generateVideo(sceneImagePaths);

  console.log(
    "\n✅ MIDNIGHTOS AI DIRECTOR VIDEO GENERATED SUCCESSFULLY!\n"
  );

  console.log("📁 Output Folder:");
  console.log("✔ case_number.txt");
  console.log("✔ story.txt");
  console.log("✔ caption.txt");
  console.log("✔ hashtags.txt");
  console.log("✔ director.json");
  console.log("✔ scenes.json");

  scenes.forEach((_, index) => {
    console.log(
      `✔ scene_${String(index + 1).padStart(2, "0")}.png`
    );
  });

  console.log("✔ horror_image.png");
  console.log("✔ story.mp3");
  console.log("✔ story.srt");
  console.log("✔ horror_video.mp4");
}

main().catch((error) => {
  console.error("\n❌ MIDNIGHTOS AI DIRECTOR ERROR:\n");

  console.error(
    error.response?.data ||
    error.message
  );

  process.exitCode = 1;
});