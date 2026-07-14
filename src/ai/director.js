const axios = require("axios");

function cleanJsonResponse(content) {
  if (!content || typeof content !== "string") {
    return "";
  }

  return content
    .replace(/```json/gi, "")
    .replace(/```javascript/gi, "")
    .replace(/```/g, "")
    .trim();
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
  });

  return plan;
}

async function generateDirectorPlan(story) {
  if (!story || !story.trim()) {
    throw new Error("Director AI ke liye story empty hai.");
  }

  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "deepseek/deepseek-chat-v3-0324",
      max_tokens: 3500,
      temperature: 0.72,
      messages: [
        {
          role: "system",
          content: `
You are the AI Director and Visual Continuity Supervisor for MidnightOS.

MidnightOS creates realistic Hindi horror investigation videos presented like classified police cases.

Your job is to transform one Hindi horror story into a professional director plan containing exactly 6 cinematic scenes.

You must maintain visual continuity across all scenes.

The same main character must always have:
- the same age
- the same gender
- the same face description
- the same hairstyle
- the same facial hair
- the same clothing
- the same accessories
- the same physical build

Every scene must repeat the complete character description inside its imagePrompt.

Return only valid JSON.
Never return markdown.
Never return explanations.
Never return code fences.
          `.trim(),
        },
        {
          role: "user",
          content: `
Create a complete cinematic director plan for this Hindi horror case story:

${story}

Return exactly this JSON structure:

{
  "caseInfo": {
    "caseNumber": "CASE #0001",
    "caseTitle": "Short Hindi case title",
    "location": "Indian location from the story",
    "evidenceType": "CCTV Footage, Emergency Call, Voice Recording, Police Bodycam, Diary or other evidence",
    "status": "UNSOLVED, CLASSIFIED or RESTRICTED"
  },

  "mainCharacter": {
    "name": "Character name",
    "age": 35,
    "gender": "male or female",
    "nationality": "Indian",
    "role": "Police officer, investigator, victim or other role",
    "faceDescription": "Detailed fixed facial description",
    "hair": "Detailed fixed hairstyle",
    "facialHair": "Detailed fixed facial hair or clean-shaven",
    "bodyBuild": "Detailed fixed body build",
    "clothing": "Detailed fixed clothing",
    "accessories": "Detailed fixed accessories",
    "consistencyPrompt": "One complete English sentence describing the exact same character appearance to repeat in every image"
  },

  "visualBible": {
    "genre": "Found footage psychological horror",
    "aspectRatio": "9:16 vertical",
    "overallStyle": "Ultra-realistic cinematic Indian horror",
    "colorPalette": "Cold blue, desaturated grey and deep black",
    "filmTexture": "Subtle film grain",
    "lightingStyle": "Low-key practical lighting",
    "locationContinuity": "Detailed recurring location description",
    "negativePrompt": "cartoon, illustration, anime, distorted anatomy, extra fingers, duplicate people, text, captions, subtitles, watermark, logo"
  },

  "scenes": [
    {
      "sceneNumber": 1,
      "title": "Short Hindi title",
      "storyMoment": "Exact Hindi story moment shown in this scene",
      "cameraShot": "CCTV wide shot, close-up, POV, bodycam, handheld, over-the-shoulder, extreme close-up or aerial shot",
      "cameraMovement": "Slow push-in, handheld shake, slow pan, tracking shot or locked CCTV frame",
      "lens": "24mm, 35mm, 50mm or 85mm cinematic lens",
      "lighting": "Detailed lighting description",
      "mood": "Detailed emotional horror mood",
      "colorGrade": "Detailed cinematic color grade",
      "soundSuggestion": "Door creak, footsteps, thunder, whisper, heartbeat, wind, radio static or jump scare",
      "imagePrompt": "One highly detailed English image-generation prompt"
    }
  ]
}

Rules:

- Generate exactly 6 scenes.
- Every scene must advance the story.
- Every scene must have a visibly different composition.
- Scene 1 must create an immediate hook.
- Scene 2 must introduce the investigation.
- Scene 3 must reveal the first disturbing clue.
- Scene 4 must intensify the danger.
- Scene 5 must reveal a major twist.
- Scene 6 must show the shocking unresolved ending.
- Use realistic Indian people and Indian locations.
- Every imagePrompt must be written only in English.
- Every imagePrompt must include the full mainCharacter.consistencyPrompt.
- Every imagePrompt must include the recurring location description.
- Every imagePrompt must include camera shot, lens, lighting, mood and color grade.
- Every imagePrompt must say vertical 9:16 composition.
- Every imagePrompt must say ultra-realistic cinematic horror.
- Every imagePrompt must say no text, no captions, no logo and no watermark.
- Do not include readable signs, documents or written messages inside images.
- Return only valid JSON.
          `.trim(),
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: 180000,
    }
  );

  const rawContent =
    response.data?.choices?.[0]?.message?.content?.trim();

  if (!rawContent) {
    throw new Error("Director AI ne empty response diya.");
  }

  const cleanedContent = cleanJsonResponse(rawContent);

  let directorPlan;

  try {
    directorPlan = JSON.parse(cleanedContent);
  } catch (error) {
    throw new Error(
      `Director JSON parse nahi hua.\n\nAI Response:\n${rawContent}`
    );
  }

  return validateDirectorPlan(directorPlan);
}

module.exports = generateDirectorPlan;