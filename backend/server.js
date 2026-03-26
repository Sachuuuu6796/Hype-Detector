const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.use(cors());
app.use(express.json({ limit: "20kb" }));

const ratemap = new Map();

function rateLimit(req, res, next) {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
  const today = new Date().toISOString().slice(0, 10);
  const key = `${ip}::${today}`;
  const count = ratemap.get(key) || 0;
  if (count >= 5) {
    return res.status(429).json({ error: "Daily limit reached (5 analyses/day). Come back tomorrow." });
  }
  ratemap.set(key, count + 1);
  if (ratemap.size > 1000) {
    for (const [k] of ratemap) {
      if (!k.endsWith(today)) ratemap.delete(k);
    }
  }
  next();
}

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.post("/analyse", rateLimit, async (req, res) => {
  const { text, type } = req.body;

  if (!text || text.trim().length < 20) {
    return res.status(400).json({ error: "Please provide at least 20 characters of text." });
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: "API key not configured on server." });
  }

  const typeLabel = {
    text: "product landing page / blog post",
    url: "product landing page",
    job: "job listing",
    app: "App Store / Product Hunt description",
  }[type] || "content";

  const prompt = `You are a brutally honest analyst who detects marketing hype.

Analyse the following ${typeLabel}. Your response must be ONLY a raw JSON object.
Do NOT use markdown. Do NOT use backticks or code fences. Do NOT add any text before or after.
Your entire response must start with { and end with }

Use this exact JSON structure:
{
  "score": 73,
  "verdict": "Smells like a Series A pitch deck",
  "concrete_claims": 2,
  "vague_claims": 9,
  "missing_data": 5,
  "hype_patterns_count": 4,
  "flags": [
    { "severity": "red", "tag": "No evidence", "text": "One sentence explanation quoting the exact phrase from the text." },
    { "severity": "amber", "tag": "Undefined term", "text": "One sentence explanation quoting the exact phrase from the text." }
  ],
  "questions": [
    "Sharp question 1 the reader should ask?",
    "Sharp question 2 the reader should ask?",
    "Sharp question 3 the reader should ask?",
    "Sharp question 4 the reader should ask?",
    "Sharp question 5 the reader should ask?"
  ],
  "patterns": [
    { "severity": "red", "name": "The Vague Superlative", "text": "One sentence describing where this appears in the text." },
    { "severity": "amber", "name": "The Naked Number", "text": "One sentence describing where this appears in the text." }
  ]
}

Rules:
- score: 0 = fully grounded, 100 = pure marketing fluff
- verdict: max 8 words, punchy and memorable
- flags: 3 to 5 items, quote exact phrases from the text
- questions: exactly 5 items
- patterns: 3 to 5 items

Text to analyse:
"""
${text.slice(0, 3000)}
"""`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 3000,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("Gemini error:", err);
      return res.status(502).json({ error: "AI service error. Please try again." });
    }

    const data = await response.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let cleaned = raw.trim();
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    if (!cleaned.startsWith("{")) {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) cleaned = match[0];
    }

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("JSON parse failed. Raw:", raw.slice(0, 500));
      return res.status(502).json({ error: "Could not parse AI response. Please try again." });
    }

    res.json(parsed);
  } catch (err) {
    console.error("Fetch error:", err);
    res.status(500).json({ error: "Server error. Please try again." });
  }
});

app.listen(PORT, () => console.log(`Hype Detector backend running on port ${PORT}`));
