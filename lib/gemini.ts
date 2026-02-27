const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.0-flash";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export function isGeminiConfigured(): boolean {
  return !!API_KEY;
}

export interface GeminiSuccess {
  ok: true;
  text: string;
}

export interface GeminiFailure {
  ok: false;
  status: number;
  error: string;
  retryable: boolean;
}

export type GeminiResponse = GeminiSuccess | GeminiFailure;

export async function callGemini(prompt: string): Promise<GeminiResponse> {
  if (!API_KEY) {
    return {
      ok: false,
      status: 500,
      error: "Missing GEMINI_API_KEY",
      retryable: false,
    };
  }

  const url = `${BASE_URL}/${MODEL}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": API_KEY,
    },
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
    const bodyText = await res.text().catch(() => "");
    console.error("[gemini] API error:", res.status, bodyText);
    return {
      ok: false,
      status: res.status,
      error: bodyText || "Gemini API error",
      retryable: res.status === 429 || res.status >= 500,
    };
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return {
      ok: false,
      status: 502,
      error: "Gemini returned empty response payload",
      retryable: true,
    };
  }
  return { ok: true, text };
}
