const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

async function generateVoice(text, outputDir = path.join(__dirname, "../../../output")) {
  return new Promise((resolve, reject) => {
    const outputFile = path.join(outputDir, "story.mp3");
    const subtitleFile = path.join(outputDir, "story.srt");

    if (!text || !text.trim()) {
      reject(new Error("Voice generation ke liye story empty hai."));
      return;
    }

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    if (fs.existsSync(outputFile)) {
      fs.rmSync(outputFile, { force: true });
    }

    if (fs.existsSync(subtitleFile)) {
      fs.rmSync(subtitleFile, { force: true });
    }

    const argumentsList = [
      "-m",
      "edge_tts",

      "--voice",
      "hi-IN-MadhurNeural",

      "--rate=-5%",
      "--pitch=-2Hz",
      "--volume=+0%",

      "--text",
      text.trim(),

      "--write-media",
      outputFile,

      "--write-subtitles",
      subtitleFile,
    ];

    const pythonProcess = spawn(
      "python",
      argumentsList,
      {
        windowsHide: true,
      }
    );

    let errorOutput = "";
    let standardOutput = "";

    pythonProcess.stdout.on("data", (data) => {
      standardOutput += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on("error", (error) => {
      reject(
        new Error(
          `Python start nahi hua: ${error.message}`
        )
      );
    });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(errorOutput || standardOutput || `Voice process exit code: ${code}`)
        );
        return;
      }

      if (!fs.existsSync(outputFile)) {
        reject(
          new Error("story.mp3 generate nahi hui.")
        );
        return;
      }

      if (!fs.existsSync(subtitleFile)) {
        reject(
          new Error("story.srt subtitle file generate nahi hui.")
        );
        return;
      }

      const audioSize = fs.statSync(outputFile).size;
      const subtitleSize = fs.statSync(subtitleFile).size;

      if (audioSize < 1000) {
        reject(
          new Error("Generated story.mp3 valid nahi hai.")
        );
        return;
      }

      if (subtitleSize < 10) {
        reject(
          new Error("Generated story.srt valid nahi hai.")
        );
        return;
      }

      console.log("🎤 Hindi Voice Generated Successfully!");
      console.log("📝 Hindi Subtitle Timing Generated Successfully!");

      resolve({
        audioPath: outputFile,
        subtitlePath: subtitleFile,
      });
    });
  });
}

module.exports = generateVoice;
