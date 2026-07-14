const axios = require("axios");

async function generateCaption(story) {
  const response = await axios.post(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      model: "deepseek/deepseek-chat-v3-0324",
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
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );

  return response.data.choices[0].message.content;
}

module.exports = generateCaption;