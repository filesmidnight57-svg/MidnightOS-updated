const axios = require("axios");

async function generateHashtags(story) {
  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "deepseek/deepseek-chat-v3-0324",
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
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data.choices[0].message.content;
}

module.exports = generateHashtags;