const axios = require("axios");

async function generatePrompt(story) {
  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "deepseek/deepseek-chat-v3-0324",
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
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data.choices[0].message.content;
}

module.exports = generatePrompt;