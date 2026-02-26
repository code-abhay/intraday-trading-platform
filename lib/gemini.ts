const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.0-flash";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export function isGeminiConfigured(): boolean {
  return !!API_KEY;
}

export interface GeminiResponse {
  text: string;
}

export async function callGemini(prompt: string): Promise<GeminiResponse | null> {
  if (!API_KEY) return null;

  const url = `${BASE_URL}/${MODEL}:generateContent?key=${API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    console.error("[gemini] API error:", res.status, await res.text().catch(() => ""));
    return null;
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;
  return { text };
}
