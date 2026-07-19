const { DEFAULT_MODEL, requestChatCompletion } = require("./ollamaClient");

function cleanJsonResponse(content) {
  return content
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
}

async function generateScenes(story) {
  const rawContent = await requestChatCompletion({
    moduleName: "src/ai/scenes.js",
    payload: {
      model: process.env.OLLAMA_MODEL || DEFAULT_MODEL,
      max_tokens: 1800,
      temperature: 0.75,
      messages: [
        {
          role: "system",
          content: `
You are an expert cinematic horror storyboard artist.

Convert Hindi horror case-file stories into exactly 6 visual scenes.

Return only valid JSON.

Each scene must contain:

- sceneNumber
- title
- storyMoment
- imagePrompt

Rules for imagePrompt:

- Write the image prompt only in English.
- Ultra-realistic cinematic horror.
- Vertical composition suitable for 9:16 video.
- Dark lighting and realistic Indian locations.
- Keep characters visually consistent between scenes.
- Mention clothing, age, environment, lighting and camera angle.
- No text, captions, letters, logos, watermarks or written signs.
- Do not place readable words inside the image.
- Every scene must look different and move the story forward.
          `.trim(),
        },
        {
          role: "user",
          content: `
नीचे दी गई हिंदी horror-thriller case story को ठीक 6 cinematic scenes में divide करो.

Story:

${story}

Return exactly this JSON structure:

[
  {
    "sceneNumber": 1,
    "title": "Short Hindi scene title",
    "storyMoment": "The exact Hindi story moment represented by this scene",
    "imagePrompt": "Detailed English cinematic image prompt"
  }
]

Important:

- Exactly 6 scenes.
- Return only the JSON array.
- Do not include markdown.
- Do not include explanation.
          `.trim(),
        },
      ],
    },
    timeout: 120000,
  });

  if (!rawContent) {
    throw new Error("AI ne scenes return nahi kiye.");
  }

  const cleanedContent = cleanJsonResponse(rawContent);

  let scenes;

  try {
    scenes = JSON.parse(cleanedContent);
  } catch (error) {
    throw new Error(
      `Scenes JSON parse nahi hua.\nAI Response:\n${rawContent}`
    );
  }

  if (!Array.isArray(scenes)) {
    throw new Error("Scenes response JSON array nahi hai.");
  }

  if (scenes.length !== 6) {
    throw new Error(
      `AI ne ${scenes.length} scenes generate kiye. Exactly 6 required hain.`
    );
  }

  scenes.forEach((scene, index) => {
    if (!scene.imagePrompt) {
      throw new Error(
        `Scene ${index + 1} mein imagePrompt missing hai.`
      );
    }

    scene.sceneNumber = index + 1;
    scene.title = scene.title || `Scene ${index + 1}`;
    scene.storyMoment = scene.storyMoment || "";
  });

  return scenes;
}

module.exports = generateScenes;