const { DEFAULT_MODEL, requestChatCompletion } = require("./openrouterClient");


async function generateHashtags(story) {
  return requestChatCompletion({
      moduleName: "src/ai/hashtags.js",
      payload: {
        model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
        max_tokens: 120,
        temperature: 0.7,
        messages: [
          {
            role: "user",
            content: `Give only 20 viral Instagram hashtags for this horror story.

${story}

Return only hashtags.`,
          },
        ],
      },
    });
}

module.exports = generateHashtags;
