const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

app.use(cors());
app.use(express.json({ limit: "20kb" }));

// Simple in-memory rate limiter: 5 requests per IP per day
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
  // Clean old keys every 1000 requests to avoid memory leak
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

  const prompt = `You are a brutally honest analyst who detects marketing hype. Analyse the following ${typeLabel} and return ONLY a valid JSON object with no markdown, no explanation, no backticks.

JSON structure required:
{
  "score": <integer 0-100, hype percentage>,
  "verdict": <short punchy verdict string, max 8 words, e.g. "Smells like a Series A pitch deck">,
  "concrete_claims": <integer, count of specific verifiable claims>,
  "vague_claims": <integer, count of vague unsubstantiated claims>,
  "missing_data": <integer, count of missing evidence items>,
  "hype_patterns_count": <integer>,
  "flags": [
    {
      "severity": <"red" or "amber">,
      "tag": <short pattern name, max 4 words>,
      "text": <one sentence explanation, max 20 words>
    }
  ],
  "questions": [
    <string, one sharp question to ask, max 18 words>
  ],
  "patterns": [
    {
      "severity": <"red" or "amber">,
      "name": <pattern name like "The Vague Superlative">,
      "text": <one sentence, max 18 words>
    }
  ]
}

Rules:
- flags: 3 to 5 items
- questions: exactly 5 items
- patterns: 3 to 5 items
- Be specific, quote exact phrases from the text
- score 0 = zero hype, 100 = pure marketing fluff
- verdict must be punchy and memorable

Text to analyse:
"""
${text.slice(0, 3000)}
"""`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 1500 },
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

    // Strip any accidental markdown fences
    const cleaned = raw.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("JSON parse failed:", cleaned.slice(0, 200));
      return res.status(502).json({ error: "Could not parse AI response. Please try again." });
    }

    res.json(parsed);
  } catch (err) {
    console.error("Fetch error:", err);
    res.status(500).json({ error: "Server error. Please try again." });
  }
});

app.listen(PORT, () => console.log(`Hype Detector backend running on port ${PORT}`));
