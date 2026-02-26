import { NextRequest, NextResponse } from "next/server";
import { isGeminiConfigured, callGemini } from "@/lib/gemini";
import {
  buildAnalysisPrompt,
  type AISignalInput,
  type AIAnalysisResult,
} from "@/lib/ai-prompt";

// In-memory cache: segment → { result, timestamp, biasKey }
const cache = new Map<
  string,
  { result: AIAnalysisResult; timestamp: number; biasKey: string }
>();

const CACHE_TTL_MS = 60_000;
const RATE_LIMIT_MS = 60_000;
const lastCallTime = new Map<string, number>();

function roundLTP(ltp: number, step: number): number {
  return Math.round(ltp / step) * step;
}

// GET /api/ai-analyze — check if Gemini is configured
export async function GET() {
  return NextResponse.json({ enabled: isGeminiConfigured() });
}

// POST /api/ai-analyze — run AI analysis on signal data
export async function POST(req: NextRequest) {
  if (!isGeminiConfigured()) {
    return NextResponse.json(
      { enabled: false, message: "Gemini not configured. Set GEMINI_API_KEY env var." },
      { status: 200 }
    );
  }

  let body: AISignalInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const segment = body.segment || "UNKNOWN";

  // Rate limiting: 1 call per segment per 60s
  const now = Date.now();
  const lastCall = lastCallTime.get(segment) ?? 0;
  if (now - lastCall < RATE_LIMIT_MS) {
    const cached = cache.get(segment);
    if (cached) {
      return NextResponse.json({ enabled: true, cached: true, analysis: cached.result });
    }
  }

  // Cache check: same segment + same bias + similar LTP → return cached
  const biasKey = `${body.bias}_${roundLTP(body.ltp, 10)}`;
  const existing = cache.get(segment);
  if (existing && existing.biasKey === biasKey && now - existing.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ enabled: true, cached: true, analysis: existing.result });
  }

  // Call Gemini
  lastCallTime.set(segment, now);
  const prompt = buildAnalysisPrompt(body);

  try {
    const response = await callGemini(prompt);
    if (!response) {
      return NextResponse.json(
        { enabled: true, error: "Gemini returned no response" },
        { status: 502 }
      );
    }

    let analysis: AIAnalysisResult;
    try {
      analysis = JSON.parse(response.text);
    } catch {
      console.error("[ai-analyze] Failed to parse Gemini response:", response.text.slice(0, 200));
      return NextResponse.json(
        { enabled: true, error: "Invalid AI response format" },
        { status: 502 }
      );
    }

    // Validate and clamp values
    analysis.aiScore = Math.max(1, Math.min(10, Math.round(analysis.aiScore ?? 5)));
    analysis.aiConfidence = Math.max(0, Math.min(100, Math.round(analysis.aiConfidence ?? 50)));
    if (!["LOW", "MEDIUM", "HIGH"].includes(analysis.riskLevel)) {
      analysis.riskLevel = "MEDIUM";
    }
    if (!Array.isArray(analysis.keyFactors)) {
      analysis.keyFactors = [];
    }
    analysis.keyFactors = analysis.keyFactors.slice(0, 5);

    // Cache result
    cache.set(segment, { result: analysis, timestamp: now, biasKey });

    return NextResponse.json({ enabled: true, cached: false, analysis });
  } catch (err) {
    console.error("[ai-analyze] Error:", err);
    return NextResponse.json(
      { enabled: true, error: "AI analysis failed" },
      { status: 500 }
    );
  }
}
