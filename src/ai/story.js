const { DEFAULT_MODEL, requestChatCompletion } = require("./openrouterClient");

const FALLBACK_STORY = "रात 2:13 पर भोपाल पुलिस कंट्रोल रूम में एक कॉल आई, जिसमें सिर्फ सांसों की आवाज और लोहे के दरवाजे पर नाखून रगड़ने जैसी खरोंच सुनाई दे रही थी। लोकेशन पुराने पोस्टमार्टम हाउस के पीछे बंद पड़ी कॉलोनी निकली। सब-इंस्पेक्टर आरव जब बॉडीकैम लेकर अंदर गया, तो हर फ्लैट खाली था, लेकिन तीसरी मंजिल के कमरे में ताजा चाय रखी थी। CCTV में दिखा कि वही कमरा पिछले सात साल से सील था। पहली रिकॉर्डिंग में आरव अकेला था, मगर शीशे में उसके पीछे एक बच्चा खड़ा दिखा। जब टीम ने दरवाजा तोड़ा, अंदर दीवार पर आरव का नाम खून से लिखा था। दूसरी चौंकाने वाली बात यह थी कि emergency call आरव के ही पुराने नंबर से आई थी, जो उसकी मौत के बाद evidence locker में जमा था। सुबह बॉडीकैम मिला, पर आरव नहीं। आखिरी फ्रेम में वह कैमरे की तरफ मुड़कर फुसफुसाया, मैं अभी बाहर नहीं आया।";

async function generateStory() {
  let story;

  try {
    story = await requestChatCompletion({
      moduleName: "src/ai/story.js",
      payload: {
        model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
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
  } catch (error) {
    console.warn(error.message);
    console.warn("⚠️ OpenRouter configuration failed. Using deterministic offline story so the pipeline can continue.");
    story = FALLBACK_STORY;
  }

  if (!story) {
    throw new Error("AI failed to generate the Hindi case story.");
  }

  return story;
}

module.exports = generateStory;
