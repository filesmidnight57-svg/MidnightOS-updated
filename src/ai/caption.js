const { DEFAULT_MODEL, requestChatCompletion } = require("./openrouterClient");

async function generateCaption(story) {
  return requestChatCompletion({
      moduleName: "src/ai/caption.js",
      payload: {
        model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
        max_tokens: 250,
        temperature: 0.7,
        messages: [
          {
            role: "user",
            content: `Create an engaging Instagram caption for this horror story.

${story}

Include a short call to action.

Return only the caption.`,
          },
        ],
      },
    });
}

module.exports = generateCaption;
