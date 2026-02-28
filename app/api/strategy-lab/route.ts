import { NextRequest, NextResponse } from "next/server";
import { SEGMENTS, type SegmentId } from "@/lib/segments";
import { getSupabaseAdmin } from "@/lib/supabase";
import { STRATEGY_LAB_RULES } from "@/lib/strategy-lab/rules";
import type { StrategyLabApiResponse } from "@/lib/strategy-lab/types";
import {
  STRATEGY_LAB_MAX_DIRECT_DAYS,
  STRATEGY_LAB_PAGE_SIZE,
  evaluateStrategyLab,
  parseDays,
  parseProfile,
  parseSegments,
  parseStrategyIds,
} from "@/lib/strategy-lab/service";
import { createStrategyLabRun } from "@/lib/strategy-lab/store";

export async function GET(request: NextRequest) {
  const sb = getSupabaseAdmin();
  if (!sb) {
    return NextResponse.json(
      {
        error:
          "Supabase is not configured. Strategy Lab requires market snapshots and one-minute candles.",
      },
      { status: 503 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const days = parseDays(searchParams.get("days"));
  const profile = parseProfile(searchParams.get("profile"));
  const segments = parseSegments(searchParams.get("segment"));
  const strategyIds = parseStrategyIds(searchParams.get("strategies"));

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

  const nowIso = new Date().toISOString();
  const fromIso = new Date(new Date(nowIso).getTime() - days * 24 * 60 * 60 * 1000).toISOString();

  if (days > STRATEGY_LAB_MAX_DIRECT_DAYS) {
    const run = await createStrategyLabRun({
      segment: segments.length === SEGMENTS.length ? "ALL" : segments,
      strategyIds,
      days,
      profile,
      from: fromIso,
      to: nowIso,
    });
    const payload: StrategyLabApiResponse = {
      mode: "async",
      profile,
      generatedAt: new Date().toISOString(),
      from: fromIso,
      to: nowIso,
      days,
      pageSize: STRATEGY_LAB_PAGE_SIZE,
      runId: run.runId,
      status: run.status,
      segments: [],
      overallRanking: [],
      warnings: [
        `Large window (${days} days) queued for async execution.`,
        "Poll /api/strategy-lab/run/[id] for run completion.",
      ],
    };
    return NextResponse.json(payload);
  }

  const result = await evaluateStrategyLab({
    days,
    segments,
    strategyIds,
    profile,
  });
  return NextResponse.json(result);
}