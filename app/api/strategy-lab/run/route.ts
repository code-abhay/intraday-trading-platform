import { NextRequest, NextResponse } from "next/server";
import { SEGMENTS } from "@/lib/segments";
import { getSupabaseAdmin } from "@/lib/supabase";
import { STRATEGY_LAB_RULES } from "@/lib/strategy-lab/rules";
import { parseDays, parseProfile, parseSegments, parseStrategyIds } from "@/lib/strategy-lab/service";
import { createStrategyLabRun } from "@/lib/strategy-lab/store";

function parseBodyValue(input: unknown): string | null {
  if (typeof input === "string") return input;
  if (typeof input === "number" && Number.isFinite(input)) return String(input);
  return null;
}

function parseStrategiesFromBody(input: unknown): string | null {
  if (typeof input === "string") return input;
  if (!Array.isArray(input)) return null;
  return input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .join(",");
}

export async function POST(request: NextRequest) {
  const sb = getSupabaseAdmin();
  if (!sb) {
    return NextResponse.json(
      { error: "Supabase is not configured. Strategy Lab requires storage for async runs." },
      { status: 503 }
    );
  }

  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const days = parseDays(parseBodyValue(payload.days));
  const profile = parseProfile(parseBodyValue(payload.profile));
  const segments = parseSegments(parseBodyValue(payload.segment));
  const strategyIds = parseStrategyIds(parseStrategiesFromBody(payload.strategies));

  if (!segments.length) {
    return NextResponse.json(
      {
        error: "Invalid segment value.",
        allowed: ["ALL", ...SEGMENTS.map((item) => item.id)],
      },
      { status: 400 }
    );
  }
  if (!strategyIds.length) {
    return NextResponse.json(
      {
        error: "No valid strategies selected.",
        allowed: STRATEGY_LAB_RULES.map((rule) => rule.id),
      },
      { status: 400 }
    );
  }

  const toIso = new Date().toISOString();
  const fromIso = new Date(new Date(toIso).getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  const run = await createStrategyLabRun({
    segment: segments.length === SEGMENTS.length ? "ALL" : segments,
    strategyIds,
    days,
    profile,
    from: fromIso,
    to: toIso,
  });

  return NextResponse.json({
    runId: run.runId,
    status: run.status,
    days,
    profile,
    from: fromIso,
    to: toIso,
  });
}
