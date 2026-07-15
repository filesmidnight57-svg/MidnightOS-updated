const { DEFAULT_MODEL, requestChatCompletion } = require("./openrouterClient");

async function generatePrompt(story) {
  return requestChatCompletion({
    moduleName: "src/ai/prompts.js",
    payload: {
      model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
      max_tokens: 250,
      temperature: 0.8,
      messages: [
        {
          role: "user",
          content: `Create one cinematic horror image prompt for this story.

${story}

Requirements:
- Ultra realistic
- 8K
- Dark cinematic lighting
- Horror atmosphere
- Highly detailed

Return only the image prompt.`,
        },
      ],
    },
  });
}

module.exports = generatePrompt;