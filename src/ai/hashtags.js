const { DEFAULT_MODEL, requestChatCompletion } = require("./openrouterClient");

const FALLBACK_HASHTAGS = "#HindiHorror #HorrorStory #ScaryStory #MidnightOS #ClassifiedCase #FoundFootage #IndianHorror #GhostStory #CreepyMystery #Paranormal #HorrorShorts #ScaryHindi #TrueHorrorStyle #DarkMystery #ShortHorror #YouTubeShorts #HorrorReels #UnsolvedCase #Nightmare #Bhoot";

async function generateHashtags(story) {
  try {
    return await requestChatCompletion({
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
  } catch (error) {
    console.warn(error.message);
    console.warn("⚠️ OpenRouter configuration failed. Using deterministic offline hashtags so the pipeline can continue.");
    return FALLBACK_HASHTAGS;
  }
}

module.exports = generateHashtags;
