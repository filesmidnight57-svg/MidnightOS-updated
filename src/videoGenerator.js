const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

const outputFolder = path.join(projectRoot, "output");

const audioAssetsFolder = path.join(
  projectRoot,
  "assets",
  "audio"
);

const voicePath = path.join(
  outputFolder,
  "story.mp3"
);

const subtitlePath = path.join(
  outputFolder,
  "story.srt"
);

const backgroundMusicPath = path.join(
  audioAssetsFolder,
  "horror_background.mp3"
);

const logoPath = path.join(
  projectRoot,
  "assets",
  "branding",
  "logo.png"
);

const videoPath = path.join(
  outputFolder,
  "horror_video.mp4"
);

const temporaryFolder = path.join(
  outputFolder,
  "video_temp"
);

const directorPath = path.join(
  outputFolder,
  "director.json"
);

const INTRO_DURATION = 2.0;
const OUTRO_DURATION = 2.0;

function checkRequiredFile(filePath, fileName) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `${fileName} not found at:\n${filePath}`
    );
  }
}

function runCommand(
  command,
  argumentsList,
  progressMessage = "",
  workingDirectory = projectRoot
) {
  return new Promise((resolve, reject) => {
    const childProcess = spawn(
      command,
      argumentsList,
      {
        windowsHide: true,
        cwd: workingDirectory,
      }
    );

    let errorOutput = "";

    childProcess.stderr.on("data", (data) => {
      errorOutput += data.toString();

      if (progressMessage) {
        process.stdout.write(
          `\r${progressMessage}`
        );
      }
    });

    childProcess.on("error", (error) => {
      if (error.code === "ENOENT") {
        reject(
          new Error(
            `${command} nahi mila. FFmpeg aur FFprobe ko Windows PATH mein add karo.`
          )
        );
        return;
      }

      reject(error);
    });

    childProcess.on("close", (exitCode) => {
      if (progressMessage) {
        process.stdout.write("\n");
      }

      if (exitCode !== 0) {
        reject(
          new Error(
            `${command} failed with exit code ${exitCode}.\n\n${errorOutput}`
          )
        );
        return;
      }

      resolve();
    });
  });
}

function getAudioDuration(audioFilePath) {
  return new Promise((resolve, reject) => {
    const ffprobeArguments = [
      "-v",
      "error",

      "-show_entries",
      "format=duration",

      "-of",
      "default=noprint_wrappers=1:nokey=1",

      audioFilePath,
    ];

    const ffprobeProcess = spawn(
      "ffprobe",
      ffprobeArguments,
      {
        windowsHide: true,
      }
    );

    let output = "";
    let errorOutput = "";

    ffprobeProcess.stdout.on("data", (data) => {
      output += data.toString();
    });

    ffprobeProcess.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    ffprobeProcess.on("error", (error) => {
      reject(
        new Error(
          `FFprobe start nahi hua: ${error.message}`
        )
      );
    });

    ffprobeProcess.on("close", (exitCode) => {
      if (exitCode !== 0) {
        reject(
          new Error(
            `Audio duration read nahi hui:\n${errorOutput}`
          )
        );
        return;
      }

      const duration = Number.parseFloat(
        output.trim()
      );

      if (
        !Number.isFinite(duration) ||
        duration <= 0
      ) {
        reject(
          new Error(
            "story.mp3 ki valid duration nahi mili."
          )
        );
        return;
      }

      resolve(duration);
    });
  });
}

function prepareTemporaryFolder() {
  if (fs.existsSync(temporaryFolder)) {
    fs.rmSync(
      temporaryFolder,
      {
        recursive: true,
        force: true,
      }
    );
  }

  fs.mkdirSync(
    temporaryFolder,
    {
      recursive: true,
    }
  );
}

function cleanupTemporaryFolder() {
  if (fs.existsSync(temporaryFolder)) {
    fs.rmSync(
      temporaryFolder,
      {
        recursive: true,
        force: true,
      }
    );
  }
}

function wrapSubtitleLine(text, maximumLength = 34) {
  const words = text.trim().split(/\s+/);

  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const possibleLine = currentLine
      ? `${currentLine} ${word}`
      : word;

    if (
      possibleLine.length > maximumLength &&
      currentLine
    ) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = possibleLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  if (lines.length <= 2) {
    return lines.join("\n");
  }

  const firstLine = lines[0];

  const secondLine = lines
    .slice(1)
    .join(" ");

  return `${firstLine}\n${secondLine}`;
}

function parseSrtTime(value) {
  const match = value.match(/^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/);

  if (!match) {
    return null;
  }

  const [, hours, minutes, seconds, milliseconds] = match;

  return (
    Number(hours) * 3600000 +
    Number(minutes) * 60000 +
    Number(seconds) * 1000 +
    Number(milliseconds)
  );
}

function formatSrtTime(milliseconds) {
  const safeMilliseconds = Math.max(0, Math.round(milliseconds));
  const hours = Math.floor(safeMilliseconds / 3600000);
  const minutes = Math.floor((safeMilliseconds % 3600000) / 60000);
  const seconds = Math.floor((safeMilliseconds % 60000) / 1000);
  const millisecondsPart = safeMilliseconds % 1000;

  return (
    `${String(hours).padStart(2, "0")}:` +
    `${String(minutes).padStart(2, "0")}:` +
    `${String(seconds).padStart(2, "0")},` +
    `${String(millisecondsPart).padStart(3, "0")}`
  );
}

function shiftSubtitleTiming(timingLine, shiftSeconds) {
  const parts = timingLine.split(" --> ");

  if (parts.length !== 2) {
    return timingLine;
  }

  const startTime = parseSrtTime(parts[0]);
  const endTime = parseSrtTime(parts[1]);

  if (startTime === null || endTime === null) {
    return timingLine;
  }

  const shiftMilliseconds = shiftSeconds * 1000;

  return (
    `${formatSrtTime(startTime + shiftMilliseconds)} --> ` +
    `${formatSrtTime(endTime + shiftMilliseconds)}`
  );
}

function prepareSubtitleFile(introDuration = 0) {
  checkRequiredFile(
    subtitlePath,
    "story.srt"
  );

  const originalSubtitle = fs.readFileSync(
    subtitlePath,
    "utf8"
  );

  const subtitleBlocks = originalSubtitle
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n{2,}/);

  const formattedBlocks = subtitleBlocks.map(
    (block) => {
      const lines = block.split("\n");

      if (lines.length < 3) {
        return block;
      }

      const subtitleNumber = lines[0];
      const subtitleTiming = shiftSubtitleTiming(
        lines[1],
        introDuration
      );

      const subtitleText = lines
        .slice(2)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      const wrappedText =
        wrapSubtitleLine(subtitleText, 30);

      return [
        subtitleNumber,
        subtitleTiming,
        wrappedText,
      ].join("\n");
    }
  );

  const temporarySubtitlePath = path.join(
    temporaryFolder,
    "story_subtitles.srt"
  );

  fs.writeFileSync(
    temporarySubtitlePath,
    `\uFEFF${formattedBlocks.join("\n\n")}\n`,
    "utf8"
  );

  return temporarySubtitlePath;
}

function createSceneBaseFilter(
  sceneNumber,
  sceneDuration
) {
  const fadeDuration = 0.35;

  const fadeOutStart = Math.max(
    sceneDuration - fadeDuration,
    fadeDuration
  ).toFixed(3);

  const movementDirection =
    sceneNumber % 2 === 0 ? -1 : 1;

  const zoomSpeed =
    sceneNumber % 3 === 0
      ? "0.0009"
      : "0.0007";

  return [
    "scale=1400:2489:force_original_aspect_ratio=increase",

    "crop=1400:2489",

    "zoompan=" +
      `z='min(zoom+${zoomSpeed},1.17)':` +
      `x='iw/2-(iw/zoom/2)+sin(on/42)*${12 * movementDirection}':` +
      `y='ih/2-(ih/zoom/2)+cos(on/52)*9':` +
      "d=1:" +
      "s=1080x1920:" +
      "fps=30",

    `fade=t=in:st=0:d=${fadeDuration}`,

    `fade=t=out:st=${fadeOutStart}:d=${fadeDuration}`,

    "setsar=1",

    "format=yuv420p",
  ].join(",");
}

function createLogoOverlayFilter(
  size = 170,
  opacity = 0.32,
  margin = 46
) {
  return (
    `[1:v]scale=${size}:-1,format=rgba,` +
    `colorchannelmixer=aa=${opacity}[logo];` +
    `[base][logo]overlay=x=W-w-${margin}:` +
    `y=H-h-${margin}:format=auto,format=yuv420p`
  );
}

function createBrandingLogoFilter(
  size = 260,
  yPosition = "h*0.16",
  opacity = 1
) {
  return (
    `[1:v]scale=${size}:-1,format=rgba,` +
    `colorchannelmixer=aa=${opacity}[logo];` +
    `[base][logo]overlay=x=(W-w)/2:y=${yPosition}:` +
    "format=auto[branded]"
  );
}

async function createSceneClip(
  imagePath,
  sceneNumber,
  sceneDuration
) {
  const clipName =
    `scene_clip_${String(sceneNumber).padStart(2, "0")}.mp4`;

  const clipPath = path.join(
    temporaryFolder,
    clipName
  );

  const sceneBaseFilter = createSceneBaseFilter(
    sceneNumber,
    sceneDuration
  );

  const videoFilter =
    `[0:v]${sceneBaseFilter}[base];` +
    createLogoOverlayFilter();

  const ffmpegArguments = [
    "-y",

    "-loop",
    "1",

    "-i",
    imagePath,

    "-i",
    logoPath,

    "-t",
    sceneDuration.toFixed(3),

    "-filter_complex",
    videoFilter,

    "-an",

    "-c:v",
    "libx264",

    "-preset",
    "medium",

    "-crf",
    "20",

    "-r",
    "30",

    "-pix_fmt",
    "yuv420p",

    "-movflags",
    "+faststart",

    clipPath,
  ];

  await runCommand(
    "ffmpeg",
    ffmpegArguments,
    `🎞️ Rendering scene ${sceneNumber}...`
  );

  checkRequiredFile(
    clipPath,
    clipName
  );

  return clipPath;
}

function sanitizeCardText(value, fallback) {
  const safeValue = String(value || fallback)
    .toUpperCase()
    .replace(/[^A-Z0-9 #_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return safeValue || fallback;
}

function getBrandingInfo() {
  const fallback = {
    caseNumber: "CASE #0001",
    status: "UNSOLVED",
  };

  if (!fs.existsSync(directorPath)) {
    return fallback;
  }

  try {
    const directorPlan = JSON.parse(
      fs.readFileSync(directorPath, "utf8")
    );

    return {
      caseNumber: sanitizeCardText(
        directorPlan?.caseInfo?.caseNumber,
        fallback.caseNumber
      ),
      status: sanitizeCardText(
        directorPlan?.caseInfo?.status,
        fallback.status
      ),
    };
  } catch (error) {
    return fallback;
  }
}

async function createBrandingClip(type, duration, brandingInfo) {
  const isIntro = type === "intro";
  const clipName = isIntro
    ? "intro_card.mp4"
    : "outro_card.mp4";
  const clipPath = path.join(temporaryFolder, clipName);

  const firstLine = isIntro ? "MIDNIGHTOS" : "CASE STATUS";
  const secondLine = isIntro
    ? "CLASSIFIED CASE FILE"
    : brandingInfo.status;
  const thirdLine = isIntro
    ? brandingInfo.caseNumber
    : "FOLLOW FOR NEXT CASE";

  const cardFilter = [
    "drawtext=font='Arial':" +
      `text='${firstLine}':` +
      "fontcolor=white:fontsize=82:" +
      "x=(w-text_w)/2:y=h*0.37:" +
      "shadowcolor=black:shadowx=4:shadowy=4",
    "drawtext=font='Arial':" +
      `text='${secondLine}':` +
      "fontcolor=white:fontsize=48:" +
      "x=(w-text_w)/2:y=h*0.49:" +
      "shadowcolor=black:shadowx=3:shadowy=3",
    "drawtext=font='Arial':" +
      `text='${thirdLine}':` +
      "fontcolor=white:fontsize=42:" +
      "x=(w-text_w)/2:y=h*0.59:" +
      "shadowcolor=black:shadowx=3:shadowy=3",
    "fade=t=in:st=0:d=0.35",
    `fade=t=out:st=${Math.max(duration - 0.35, 0).toFixed(2)}:d=0.35`,
  ].join(",");

  const videoFilter =
    `[0:v]${cardFilter}[base];` +
    createBrandingLogoFilter(
      isIntro ? 280 : 235,
      isIntro ? "h*0.13" : "h*0.18"
    ) +
    ";[branded]format=yuv420p";

  const ffmpegArguments = [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=black:s=1080x1920:r=30:d=${duration.toFixed(2)}`,
    "-i",
    logoPath,
    "-filter_complex",
    videoFilter,
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "20",
    "-r",
    "30",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    clipPath,
  ];

  await runCommand(
    "ffmpeg",
    ffmpegArguments,
    isIntro
      ? "🎬 Creating MidnightOS intro..."
      : "📁 Creating case-status outro..."
  );

  checkRequiredFile(clipPath, clipName);
  return clipPath;
}

function createConcatFile(clipPaths) {
  const concatFilePath = path.join(
    temporaryFolder,
    "concat.txt"
  );

  const concatContent = clipPaths
    .map((clipPath) => {
      const safePath = clipPath
        .replace(/\\/g, "/")
        .replace(/'/g, "'\\''");

      return `file '${safePath}'`;
    })
    .join("\n");

  fs.writeFileSync(
    concatFilePath,
    concatContent,
    "utf8"
  );

  return concatFilePath;
}

async function combineSceneClips(clipPaths) {
  const concatFilePath =
    createConcatFile(clipPaths);

  const combinedVideoPath = path.join(
    temporaryFolder,
    "combined_scenes.mp4"
  );

  const ffmpegArguments = [
    "-y",

    "-f",
    "concat",

    "-safe",
    "0",

    "-i",
    concatFilePath,

    "-c",
    "copy",

    combinedVideoPath,
  ];

  await runCommand(
    "ffmpeg",
    ffmpegArguments,
    "🎬 Combining cinematic scenes..."
  );

  checkRequiredFile(
    combinedVideoPath,
    "combined_scenes.mp4"
  );

  return combinedVideoPath;
}

function buildSoundEffectInputs(
  ffmpegArguments,
  sceneCount
) {
  const effectInputs = [];

  for (
    let index = 1;
    index < sceneCount;
    index += 1
  ) {
    ffmpegArguments.push(
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=68:duration=0.45:sample_rate=44100"
    );

    effectInputs.push({
      type: "transition",
      inputIndex: index + 2,
      sceneBoundary: index,
    });
  }

  ffmpegArguments.push(
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=42:duration=0.85:sample_rate=44100"
  );

  effectInputs.push({
    type: "final",
    inputIndex: sceneCount + 2,
  });

  return effectInputs;
}

function buildAudioFilter(
  effectInputs,
  sceneDuration,
  audioDuration,
  introDuration,
  outroDuration
) {
  const introDelayMilliseconds = Math.round(
    introDuration * 1000
  );

  const totalDuration =
    introDuration + audioDuration + outroDuration;

  const filters = [
    `[1:a]volume=1.0,adelay=${introDelayMilliseconds}|${introDelayMilliseconds}[voice]`,
    `[2:a]volume=0.09,atrim=duration=${totalDuration.toFixed(3)}[music]`,
  ];

  const mixedTracks = [
    "[voice]",
    "[music]",
  ];

  let transitionNumber = 1;

  for (const effect of effectInputs) {
    if (effect.type === "transition") {
      const delayMilliseconds = Math.round(
        (
          introDuration +
          sceneDuration * effect.sceneBoundary
        ) * 1000
      );

      const label =
        `transition${transitionNumber}`;

      filters.push(
        `[${effect.inputIndex}:a]` +
          "volume=0.20," +
          "lowpass=f=500," +
          "afade=t=out:st=0:d=0.45," +
          `adelay=${delayMilliseconds}|${delayMilliseconds}` +
          `[${label}]`
      );

      mixedTracks.push(`[${label}]`);
      transitionNumber += 1;
    }
  }

  const finalEffect = effectInputs.find(
    (effect) => effect.type === "final"
  );

  if (finalEffect) {
    const finalDelayMilliseconds = Math.max(
      0,
      Math.round(
        (introDuration + audioDuration - 0.9) * 1000
      )
    );

    filters.push(
      `[${finalEffect.inputIndex}:a]` +
        "volume=0.32," +
        "lowpass=f=350," +
        "afade=t=out:st=0.15:d=0.70," +
        `adelay=${finalDelayMilliseconds}|${finalDelayMilliseconds}` +
        "[finalhit]"
    );

    mixedTracks.push("[finalhit]");
  }

  filters.push(
    `${mixedTracks.join("")}` +
      `amix=inputs=${mixedTracks.length}:` +
      "duration=longest:" +
      "dropout_transition=2:" +
      "normalize=0," +
      `atrim=duration=${totalDuration.toFixed(3)}` +
      "[audio]"
  );

  return filters.join(";");
}

async function addVoiceMusicSubtitlesAndEffects(
  combinedVideoPath,
  sceneCount,
  sceneDuration,
  audioDuration,
  introDuration,
  outroDuration
) {
  prepareSubtitleFile(introDuration);

  const ffmpegArguments = [
    "-y",

    "-i",
    combinedVideoPath,

    "-i",
    voicePath,

    "-stream_loop",
    "-1",

    "-i",
    backgroundMusicPath,
  ];

  const effectInputs =
    buildSoundEffectInputs(
      ffmpegArguments,
      sceneCount
    );

  const audioFilter =
    buildAudioFilter(
      effectInputs,
      sceneDuration,
      audioDuration,
      introDuration,
      outroDuration
    );

  const subtitleFilter =
    "subtitles=story_subtitles.srt:" +
    "charenc=UTF-8:" +
    "force_style='" +
    "FontName=Nirmala UI," +
    "FontSize=16," +
    "PrimaryColour=&H00FFFFFF," +
    "OutlineColour=&H00000000," +
    "BackColour=&H70000000," +
    "BorderStyle=3," +
    "Outline=2," +
    "Shadow=0," +
    "Alignment=2," +
    "MarginL=85," +
    "MarginR=85," +
    "MarginV=42" +
    "'";

  ffmpegArguments.push(
    "-filter_complex",
    audioFilter,

    "-map",
    "0:v:0",

    "-map",
    "[audio]",

    "-vf",
    subtitleFilter,

    "-c:v",
    "libx264",

    "-preset",
    "medium",

    "-crf",
    "20",

    "-c:a",
    "aac",

    "-b:a",
    "192k",

    "-ar",
    "44100",

    "-pix_fmt",
    "yuv420p",

    "-shortest",

    "-movflags",
    "+faststart",

    videoPath
  );

  await runCommand(
    "ffmpeg",
    ffmpegArguments,
    "📝 Adding Hindi subtitles and cinematic sound effects...",
    temporaryFolder
  );

  checkRequiredFile(
    videoPath,
    "horror_video.mp4"
  );
}

function findSceneImages() {
  if (!fs.existsSync(outputFolder)) {
    return [];
  }

  return fs
    .readdirSync(outputFolder)
    .filter((fileName) => {
      return /^scene_\d{2}\.png$/i.test(
        fileName
      );
    })
    .sort()
    .map((fileName) => {
      return path.join(
        outputFolder,
        fileName
      );
    });
}

async function generateVideo(
  suppliedSceneImagePaths = []
) {
  try {
    if (!fs.existsSync(outputFolder)) {
      fs.mkdirSync(
        outputFolder,
        {
          recursive: true,
        }
      );
    }

    checkRequiredFile(
      voicePath,
      "story.mp3"
    );

    checkRequiredFile(
      subtitlePath,
      "story.srt"
    );

    checkRequiredFile(
      backgroundMusicPath,
      "horror_background.mp3"
    );

    checkRequiredFile(
      logoPath,
      "assets/branding/logo.png"
    );

    const sceneImagePaths =
      suppliedSceneImagePaths.length > 0
        ? suppliedSceneImagePaths
        : findSceneImages();

    if (sceneImagePaths.length === 0) {
      throw new Error(
        "Koi scene image nahi mili."
      );
    }

    sceneImagePaths.forEach(
      (sceneImagePath, index) => {
        checkRequiredFile(
          sceneImagePath,
          `scene_${String(index + 1).padStart(2, "0")}.png`
        );
      }
    );

    console.log(
      `🎬 Generating ${sceneImagePaths.length}-scene video with subtitles and sound effects...`
    );

    const audioDuration =
      await getAudioDuration(voicePath);

    const sceneDuration =
      audioDuration /
      sceneImagePaths.length;

    console.log(
      `⏱️ Voice Duration: ${audioDuration.toFixed(2)} seconds`
    );

    console.log(
      `🎞️ Each Scene: approximately ${sceneDuration.toFixed(2)} seconds`
    );

    prepareTemporaryFolder();

    const brandingInfo = getBrandingInfo();

    const introClipPath = await createBrandingClip(
      "intro",
      INTRO_DURATION,
      brandingInfo
    );

    const sceneClipPaths = [];

    for (
      let index = 0;
      index < sceneImagePaths.length;
      index += 1
    ) {
      const clipPath =
        await createSceneClip(
          sceneImagePaths[index],
          index + 1,
          sceneDuration
        );

      sceneClipPaths.push(clipPath);
    }

    const outroClipPath = await createBrandingClip(
      "outro",
      OUTRO_DURATION,
      brandingInfo
    );

    const combinedVideoPath =
      await combineSceneClips([
        introClipPath,
        ...sceneClipPaths,
        outroClipPath,
      ]);

    await addVoiceMusicSubtitlesAndEffects(
      combinedVideoPath,
      sceneImagePaths.length,
      sceneDuration,
      audioDuration,
      INTRO_DURATION,
      OUTRO_DURATION
    );

    const videoSizeInMB = (
      fs.statSync(videoPath).size /
      (1024 * 1024)
    ).toFixed(2);

    cleanupTemporaryFolder();

    console.log(
      "✅ FINAL CINEMATIC VIDEO GENERATED SUCCESSFULLY!"
    );

    console.log(
      `🖼️ ${sceneImagePaths.length} Different AI Scenes Added`
    );

    console.log(
      "🎥 Cinematic Zoom and Pan Added"
    );

    console.log(
      "📝 Hindi Subtitles Added in Bottom Safe Area"
    );

    console.log(
      "🎬 MidnightOS Intro Added"
    );

    console.log(
      "📁 Case Status Outro Added"
    );

    console.log(
      "🎤 Hindi Voice Added"
    );

    console.log(
      "🎵 Horror Background Music Added"
    );

    console.log(
      "💥 Scene Transition Sound Effects Added"
    );

    console.log(
      "😱 Final Jump-Scare Sound Added"
    );

    console.log(
      `📹 File: ${videoPath}`
    );

    console.log(
      `📦 Size: ${videoSizeInMB} MB`
    );

    console.log(
      "📐 Resolution: 1080×1920"
    );

    console.log(
      "🎞️ Frame Rate: 30 FPS"
    );

    return videoPath;
  } catch (error) {
    cleanupTemporaryFolder();
    throw error;
  }
}

async function run() {
  try {
    await generateVideo();
  } catch (error) {
    console.error(
      "\n❌ VIDEO GENERATION ERROR:\n"
    );

    console.error(error.message);

    process.exitCode = 1;
  }
}

if (require.main === module) {
  run();
}

module.exports = generateVideo;