const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

function writeFallbackSubtitles(text, subtitleFile) {
  const cleanText = String(text || "").replace(/\s+/g, " ").trim();
  const sentences = cleanText.split(/(?<=[।.!?])\s+/).filter(Boolean).slice(0, 6);
  const lines = sentences.length ? sentences : [cleanText || "MidnightOS horror story"];

  function timestamp(seconds) {
    const wholeSeconds = Math.floor(seconds);
    const milliseconds = Math.floor((seconds - wholeSeconds) * 1000);
    const hh = String(Math.floor(wholeSeconds / 3600)).padStart(2, "0");
    const mm = String(Math.floor((wholeSeconds % 3600) / 60)).padStart(2, "0");
    const ss = String(wholeSeconds % 60).padStart(2, "0");
    return `${hh}:${mm}:${ss},${String(milliseconds).padStart(3, "0")}`;
  }

  const durationPerLine = 5;
  const content = lines.map((line, index) => {
    const start = index * durationPerLine;
    const end = start + durationPerLine;
    return `${index + 1}\n${timestamp(start)} --> ${timestamp(end)}\n${line}`;
  }).join("\n\n");

  fs.writeFileSync(subtitleFile, `${content}\n`, "utf8");
}

function writeFallbackMp3(outputFile) {
  const id3 = Buffer.from("ID3\x03\x00\x00\x00\x00\x00\x21TIT2\x00\x00\x00\x17\x00\x00MidnightOS fallback audio");
  const silenceFrame = Buffer.from([0xff, 0xfb, 0x90, 0x64, ...Array(413).fill(0)]);
  fs.writeFileSync(outputFile, Buffer.concat([id3, ...Array(8).fill(silenceFrame)]));
}

function generateFallbackVoice(text, outputFile, subtitleFile) {
  return new Promise((resolve, reject) => {
    writeFallbackSubtitles(text, subtitleFile);

    const ffmpegProcess = spawn("ffmpeg", [
      "-y",
      "-f", "lavfi",
      "-i", "sine=frequency=180:duration=30",
      "-f", "lavfi",
      "-i", "anoisesrc=color=pink:amplitude=0.04:duration=30",
      "-filter_complex", "[0:a][1:a]amix=inputs=2:duration=shortest,volume=0.35",
      "-codec:a", "libmp3lame",
      "-q:a", "4",
      outputFile,
    ], { windowsHide: true });

    let errorOutput = "";
    ffmpegProcess.stderr.on("data", (data) => { errorOutput += data.toString(); });
    ffmpegProcess.on("error", (error) => {
      if (error.code === "ENOENT") {
        writeFallbackMp3(outputFile);
        resolve({ audioPath: outputFile, subtitlePath: subtitleFile });
        return;
      }
      reject(error);
    });
    ffmpegProcess.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(errorOutput || `Fallback FFmpeg voice exit code: ${code}`));
        return;
      }
      resolve({ audioPath: outputFile, subtitlePath: subtitleFile });
    });
  });
}

async function generateVoice(text) {
  return new Promise((resolve, reject) => {
    const outputDir = path.join(__dirname, "../../../output");

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
        console.warn(errorOutput || standardOutput || `Voice process exit code: ${code}`);
        console.warn("⚠️ Edge TTS unavailable. Using deterministic offline fallback audio so the pipeline can continue.");
        generateFallbackVoice(text, outputFile, subtitleFile).then(resolve).catch(reject);
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