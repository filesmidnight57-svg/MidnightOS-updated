const { DEFAULT_MODEL, requestChatCompletion } = require("./openrouterClient");

function createFallbackCaption(story) {
  const hook = String(story || "").split(/[।.!?]/)[0].trim();
  return `${hook || "Ek classified horror case phir khul gaya."}\n\nKya aap ending tak sach samajh paaye? Comment karo aur MidnightOS ko follow karo.`;
}

async function generateCaption(story) {
  try {
    return await requestChatCompletion({
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
  } catch (error) {
    console.warn(error.message);
    console.warn("⚠️ OpenRouter configuration failed. Using deterministic offline caption so the pipeline can continue.");
    return createFallbackCaption(story);
  }
}

module.exports = generateCaption;
