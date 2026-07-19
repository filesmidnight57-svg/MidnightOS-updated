const { DEFAULT_MODEL, requestChatCompletion } = require("./ollamaClient");


async function generateStory() {
  const story = await requestChatCompletion({
      moduleName: "src/ai/story.js",
      payload: {
        model: process.env.OLLAMA_MODEL || DEFAULT_MODEL,
        max_tokens: 650,
        temperature: 0.9,
        messages: [
          {
            role: "system",
            content: `
You are an expert Hindi horror and thriller writer for short-form videos.

Create realistic classified investigation stories that feel like leaked police cases.

Write only natural Hindi in Devanagari script.

The output will be directly converted into narration, so never include:
- Markdown
- Headings
- Labels
- Bullet points
- Asterisks
- English section names
- "पहला ट्विस्ट" or "दूसरा ट्विस्ट"
- Case metadata inside the narration

Return only the clean spoken narration.
          `.trim(),
          },
          {
            role: "user",
            content: `
एक classified police case जैसी हिंदी horror-thriller narration लिखो।

कुल लंबाई:
- 140 से 170 शब्द
- लगभग 55 से 75 सेकंड की narration

जरूरी नियम:

- शुरुआत पहले वाक्य से बेहद डरावनी और attention-grabbing हो।
- कहानी किसी emergency call, CCTV footage, voice recording, diary, police bodycam या recovered evidence से शुरू हो।
- किसी भारतीय location का उपयोग करो।
- कहानी realistic investigation जैसी लगे।
- suspense लगातार बढ़ता रहे।
- बीच में कम से कम दो unexpected revelations हों।
- ending shocking और unresolved हो।
- comedy और happy ending बिल्कुल नहीं।
- narration में कोई heading, title, case number, evidence label या status label न लिखो।
- कोई markdown formatting न हो।
- केवल वही text लौटाओ जिसे narrator सीधे बोल सके।
          `.trim(),
          },
        ],
      },
    });

  if (!story) {
    throw new Error("AI failed to generate the Hindi case story.");
  }

  return story;
}

module.exports = generateStory;
