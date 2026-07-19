const { DEFAULT_MODEL, OPENROUTER_API_URL, requestChatCompletion } = require("./openrouterClient");
const {
  getMainCharacter,
  applyPermanentCharacterToDirectorPlan,
} = require("../characterManager");

const DIRECTOR_MODEL = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
const DIRECTOR_API_URL = process.env.OPENROUTER_API_URL || OPENROUTER_API_URL;
const IMAGE_PROMPT_MAX_LENGTH = 620;
const DIRECTOR_MAX_TOKENS = 1800;
const STORY_CONTEXT_MAX_LENGTH = 3600;

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
  const requiredEnding = " vertical 9:16, ultra-realistic cinematic horror, no text, no captions, no logo, no watermark.";
  const availableLength = IMAGE_PROMPT_MAX_LENGTH - requiredEnding.length;
  const shortened = truncateText(safePrompt, Math.max(120, availableLength));

  if (/vertical 9:16/i.test(shortened) && /no text/i.test(shortened)) {
    return truncateText(shortened, IMAGE_PROMPT_MAX_LENGTH);
  }

  return truncateText(`${shortened}${requiredEnding}`, IMAGE_PROMPT_MAX_LENGTH);
}

function compactStory(story) {
  return truncateText(String(story || "").replace(/\s+/g, " ").trim(), STORY_CONTEXT_MAX_LENGTH);
}

function compactCharacter(character) {
  return JSON.stringify({
    name: character.name,
    age: character.age,
    gender: character.gender,
    nationality: character.nationality,
    role: character.role,
    faceDescription: character.faceDescription,
    hair: character.hair,
    facialHair: character.facialHair,
    bodyBuild: character.bodyBuild,
    clothing: character.clothing,
    accessories: character.accessories,
    consistencyPrompt: character.consistencyPrompt,
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

function buildDirectorMessages(story) {
  const mainCharacter = getMainCharacter();
  const characterJson = compactCharacter(mainCharacter);
  const compactInputStory = compactStory(story);

  return [
    {
      role: "system",
      content:
        "MidnightOS director. Return ONLY minified valid JSON. No markdown. Exactly 6 scenes. Use supplied character exactly. Short values. English imagePrompt <=620 chars.",
    },
    {
      role: "user",
      content: `CHAR=${characterJson}\nSTORY=${compactInputStory}\nJSON schema: {"caseInfo":{"caseNumber":"CASE #0001","caseTitle":"Hindi title","location":"Indian location","evidenceType":"CCTV Footage/Emergency Call/Voice Recording/Police Bodycam/Diary/Other","status":"UNSOLVED/CLASSIFIED/RESTRICTED"},"mainCharacter":CHAR,"visualBible":{"genre":"Found footage psychological horror","aspectRatio":"9:16 vertical","overallStyle":"Ultra-realistic cinematic Indian horror","colorPalette":"Cold blue, desaturated grey, deep black","filmTexture":"Subtle film grain","lightingStyle":"Low-key practical lighting","locationContinuity":"recurring location","negativePrompt":"cartoon,anime,text,captions,subtitles,watermark,logo,distorted anatomy,extra fingers,duplicate people"},"scenes":[{"sceneNumber":1,"title":"Hindi","storyMoment":"Hindi","cameraShot":"shot","cameraMovement":"move","lens":"24mm/35mm/50mm/85mm","lighting":"light","mood":"mood","colorGrade":"grade","soundSuggestion":"sound","imagePrompt":"CHAR.consistencyPrompt + location + shot/lens/light/mood/grade + vertical 9:16 + no text/captions/logo/watermark"}]} Make scenes 1-6: hook, investigation, first clue, danger, twist, unresolved ending. Return compact JSON only.`,
    },
  ];
}

async function requestDirectorPlan(story) {
  return requestChatCompletion({
    moduleName: "src/ai/director.js",
    payload: {
      model: DIRECTOR_MODEL,
      max_tokens: DIRECTOR_MAX_TOKENS,
      temperature: 0.25,
      response_format: { type: "json_object" },
      messages: buildDirectorMessages(story),
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

  try {
    const rawContent = await requestDirectorPlan(story);
    return parseDirectorResponse(rawContent);
  } catch (error) {
    const detail = error.incompleteJson
      ? "Response appears truncated or ended inside a JSON string."
      : error.message;
    logDirectorJsonFailure("compact JSON request", detail);
    throw error;
  }
}

module.exports = generateDirectorPlan;
module.exports._private = {
  extractJsonResponse,
  isProbablyIncompleteJson,
  normalizeImagePrompt,
  parseDirectorResponse,
};
