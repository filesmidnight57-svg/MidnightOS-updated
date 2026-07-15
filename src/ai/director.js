const { DEFAULT_MODEL, OPENROUTER_API_URL, requestChatCompletion } = require("./openrouterClient");
const {
  getMainCharacter,
  applyPermanentCharacterToDirectorPlan,
} = require("../characterManager");

const DIRECTOR_MODEL = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
const DIRECTOR_API_URL = process.env.OPENROUTER_API_URL || OPENROUTER_API_URL;
const IMAGE_PROMPT_MAX_LENGTH = 900;

function logDirectorJsonFailure(reason, detail) {
  const safeDetail = detail ? ` ${detail}` : "";
  console.warn(`⚠️ Director JSON parse failed: ${reason}.${safeDetail}`);
}

function stripCodeFence(content) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json|javascript|js)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function extractJsonResponse(content) {
  if (!content || typeof content !== "string") {
    return "";
  }

  const unfenced = stripCodeFence(content);
  const firstObject = unfenced.indexOf("{");
  const firstArray = unfenced.indexOf("[");
  const starts = [firstObject, firstArray].filter((index) => index !== -1);

  if (starts.length === 0) {
    return unfenced.trim();
  }

  const start = Math.min(...starts);
  const openChar = unfenced[start];
  const closeChar = openChar === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < unfenced.length; index += 1) {
    const char = unfenced[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\" && inString) {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === openChar) {
      depth += 1;
    } else if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return unfenced.slice(start, index + 1).trim();
      }
    }
  }

  return unfenced.slice(start).trim();
}

function isProbablyIncompleteJson(jsonText, parseError) {
  if (!jsonText) {
    return false;
  }

  const message = parseError?.message || "";
  if (/unterminated|string|unexpected end|end of json|bad control character/i.test(message)) {
    return true;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (const char of jsonText) {
    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\" && inString) {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === "{" || char === "[") {
      depth += 1;
    } else if (char === "}" || char === "]") {
      depth -= 1;
    }
  }

  return inString || depth > 0;
}

function truncateText(value, maxLength) {
  if (typeof value !== "string" || value.length <= maxLength) {
    return value;
  }

  return value.slice(0, maxLength - 1).trimEnd();
}

function normalizeImagePrompt(prompt) {
  const safePrompt = typeof prompt === "string" ? prompt.trim() : "";
  const requiredEnding = " vertical 9:16 composition, ultra-realistic cinematic horror, no text, no captions, no logo, no watermark.";
  const availableLength = IMAGE_PROMPT_MAX_LENGTH - requiredEnding.length;
  const shortened = truncateText(safePrompt, Math.max(120, availableLength));

  if (/vertical 9:16/i.test(shortened) && /no text/i.test(shortened)) {
    return truncateText(shortened, IMAGE_PROMPT_MAX_LENGTH);
  }

  return truncateText(`${shortened}${requiredEnding}`, IMAGE_PROMPT_MAX_LENGTH);
}

function createFallbackDirectorPlan(story) {
  const shortStory = truncateText(story.replace(/\s+/g, " ").trim(), 260) || "Hindi horror investigation";
  const mainCharacter = getMainCharacter();
  const characterPrompt = mainCharacter.consistencyPrompt;
  const location = "a dark Indian neighborhood with narrow lanes, damp concrete walls, weak tube lights, and heavy night fog";

  return validateDirectorPlan({
    caseInfo: {
      caseNumber: "CASE #0001",
      caseTitle: "Adhoori Raat Ka Case",
      location: "India",
      evidenceType: "Police Bodycam",
      status: "CLASSIFIED",
    },
    mainCharacter,
    visualBible: {
      genre: "Found footage psychological horror",
      aspectRatio: "9:16 vertical",
      overallStyle: "Ultra-realistic cinematic Indian horror",
      colorPalette: "Cold blue, desaturated grey and deep black",
      filmTexture: "Subtle film grain",
      lightingStyle: "Low-key practical lighting",
      locationContinuity: location,
      negativePrompt: "cartoon, illustration, anime, distorted anatomy, extra fingers, duplicate people, text, captions, subtitles, watermark, logo",
    },
    scenes: Array.from({ length: 6 }, (_, index) => ({
      sceneNumber: index + 1,
      title: `Scene ${index + 1}`,
      storyMoment: index === 0 ? shortStory : `Investigation beat ${index + 1} from the case`,
      cameraShot: ["CCTV wide shot", "bodycam POV", "close-up", "handheld tracking shot", "over-the-shoulder shot", "extreme close-up"][index],
      cameraMovement: ["locked CCTV frame", "slow push-in", "slow pan", "handheld shake", "tracking shot", "sudden still frame"][index],
      lens: ["24mm", "35mm", "50mm", "35mm", "85mm", "50mm"][index],
      lighting: "Low-key practical lighting with weak tube light spill and deep shadows",
      mood: "Psychological horror tension",
      colorGrade: "Cold blue desaturated cinematic grade",
      soundSuggestion: ["radio static", "footsteps", "door creak", "whisper", "heartbeat", "wind"][index],
      imagePrompt: `${characterPrompt} Scene ${index + 1} in ${location}, ${shortStory}, cinematic horror investigation, vertical 9:16 composition, ultra-realistic cinematic horror, no text, no captions, no logo, no watermark.`,
    })),
  });
}

function validateDirectorPlan(plan) {
  if (!plan || typeof plan !== "object") {
    throw new Error("Director plan valid object nahi hai.");
  }

  if (!plan.caseInfo || typeof plan.caseInfo !== "object") {
    throw new Error("Director plan mein caseInfo missing hai.");
  }

  if (!plan.mainCharacter || typeof plan.mainCharacter !== "object") {
    throw new Error("Director plan mein mainCharacter missing hai.");
  }

  if (!plan.visualBible || typeof plan.visualBible !== "object") {
    throw new Error("Director plan mein visualBible missing hai.");
  }

  if (!Array.isArray(plan.scenes)) {
    throw new Error("Director plan mein scenes array missing hai.");
  }

  if (plan.scenes.length !== 6) {
    throw new Error(
      `Director AI ne ${plan.scenes.length} scenes generate kiye. Exactly 6 required hain.`
    );
  }

  const mainCharacter = getMainCharacter();
  applyPermanentCharacterToDirectorPlan(plan, mainCharacter);

  plan.scenes.forEach((scene, index) => {
    if (!scene || typeof scene !== "object") {
      throw new Error(`Scene ${index + 1} valid object nahi hai.`);
    }

    if (!scene.imagePrompt || typeof scene.imagePrompt !== "string") {
      throw new Error(`Scene ${index + 1} ka imagePrompt missing hai.`);
    }

    scene.sceneNumber = index + 1;
    scene.title = scene.title || `Scene ${index + 1}`;
    scene.storyMoment = scene.storyMoment || "";
    scene.cameraShot = scene.cameraShot || "cinematic medium shot";
    scene.cameraMovement = scene.cameraMovement || "slow push-in";
    scene.lens = scene.lens || "35mm cinematic lens";
    scene.lighting = scene.lighting || "dark cinematic lighting";
    scene.mood = scene.mood || "psychological horror";
    scene.colorGrade = scene.colorGrade || "cold blue cinematic grade";
    scene.soundSuggestion = scene.soundSuggestion || "dark ambient tension";
    scene.imagePrompt = normalizeImagePrompt(scene.imagePrompt);
  });

  return plan;
}

function buildDirectorMessages(story, mode = "normal") {
  const shorter = mode === "short";
  const imagePromptLimit = shorter ? 520 : IMAGE_PROMPT_MAX_LENGTH;
  const mainCharacter = getMainCharacter();
  const characterJson = JSON.stringify({
    name: mainCharacter.name,
    age: mainCharacter.age,
    gender: mainCharacter.gender,
    nationality: mainCharacter.nationality,
    role: mainCharacter.role,
    faceDescription: mainCharacter.faceDescription,
    hair: mainCharacter.hair,
    facialHair: mainCharacter.facialHair,
    bodyBuild: mainCharacter.bodyBuild,
    clothing: mainCharacter.clothing,
    accessories: mainCharacter.accessories,
    consistencyPrompt: mainCharacter.consistencyPrompt,
  });

  return [
    {
      role: "system",
      content: [
        "You are MidnightOS AI Director for realistic Hindi horror case videos.",
        "Return only valid JSON, no markdown, no code fences, no explanations.",
        "Keep the exact requested schema and exactly 6 scenes.",
        `Each imagePrompt must be English and under ${imagePromptLimit} characters.`,
        "Use only the permanent main character profile supplied by the user. Never invent or alter the character name, age, face, hairstyle, moustache, body type, clothing, or accessories.",
      ].join(" "),
    },
    {
      role: "user",
      content: `Permanent main character profile (copy these exact details into mainCharacter and every imagePrompt):\n${characterJson}\n\nStory:\n${story}\n\nReturn JSON with this exact schema: {"caseInfo":{"caseNumber":"CASE #0001","caseTitle":"Short Hindi case title","location":"Indian location","evidenceType":"CCTV Footage, Emergency Call, Voice Recording, Police Bodycam, Diary or other evidence","status":"UNSOLVED, CLASSIFIED or RESTRICTED"},"mainCharacter":{"name":"Character name","age":35,"gender":"male or female","nationality":"Indian","role":"role","faceDescription":"fixed face","hair":"fixed hair","facialHair":"fixed facial hair or clean-shaven","bodyBuild":"fixed build","clothing":"fixed clothing","accessories":"fixed accessories","consistencyPrompt":"one complete English sentence with exact same appearance"},"visualBible":{"genre":"Found footage psychological horror","aspectRatio":"9:16 vertical","overallStyle":"Ultra-realistic cinematic Indian horror","colorPalette":"Cold blue, desaturated grey and deep black","filmTexture":"Subtle film grain","lightingStyle":"Low-key practical lighting","locationContinuity":"recurring location description","negativePrompt":"cartoon, illustration, anime, distorted anatomy, extra fingers, duplicate people, text, captions, subtitles, watermark, logo"},"scenes":[{"sceneNumber":1,"title":"Short Hindi title","storyMoment":"Hindi story moment","cameraShot":"shot type","cameraMovement":"movement","lens":"24mm/35mm/50mm/85mm","lighting":"lighting","mood":"mood","colorGrade":"grade","soundSuggestion":"sound","imagePrompt":"English prompt"}]} Rules: scenes 1-6 = hook, investigation, first clue, danger, twist, unresolved ending. Use realistic Indian people/locations. Every imagePrompt must begin with the permanent character consistency prompt exactly as supplied, then include the recurring location, camera, lens, lighting, mood, color grade, vertical 9:16, ultra-realistic cinematic horror, no text/captions/logo/watermark. No readable signs/documents/messages.${shorter ? " Make all string values concise." : ""}`,
    },
  ];
}

async function requestDirectorPlan(story, mode = "normal") {
  return requestChatCompletion({
    moduleName: "src/ai/director.js",
    payload: {
      model: DIRECTOR_MODEL,
      max_tokens: mode === "short" ? 2200 : 3200,
      temperature: mode === "short" ? 0.35 : 0.6,
      messages: buildDirectorMessages(story, mode),
    },
    timeout: 180000,
  });
}

function parseDirectorResponse(rawContent) {
  if (!rawContent) {
    throw new Error("Director AI ne empty response diya.");
  }

  const jsonContent = extractJsonResponse(rawContent);

  try {
    return validateDirectorPlan(JSON.parse(jsonContent));
  } catch (error) {
    error.directorJson = jsonContent;
    error.incompleteJson = isProbablyIncompleteJson(jsonContent, error);
    throw error;
  }
}

async function generateDirectorPlan(story) {
  if (!story || !story.trim()) {
    throw new Error("Director AI ke liye story empty hai.");
  }

  const attempts = [
    { mode: "normal", reason: "initial request" },
    { mode: "normal", reason: "automatic retry after incomplete or malformed JSON" },
    { mode: "short", reason: "short JSON recovery request" },
  ];
  let lastError;

  for (const attempt of attempts) {
    try {
      const rawContent = await requestDirectorPlan(story, attempt.mode);
      return parseDirectorResponse(rawContent);
    } catch (error) {
      lastError = error;
      const detail = error.incompleteJson
        ? "Response appears truncated or ended inside a JSON string."
        : error.message;
      logDirectorJsonFailure(attempt.reason, detail);
    }
  }

  console.warn(
    `⚠️ Director JSON recovery failed after ${attempts.length} attempts. Using safe fallback plan instead of crashing. Last error: ${lastError?.message || "unknown error"}`
  );
  return createFallbackDirectorPlan(story);
}

module.exports = generateDirectorPlan;
module.exports._private = {
  extractJsonResponse,
  isProbablyIncompleteJson,
  normalizeImagePrompt,
  parseDirectorResponse,
};
