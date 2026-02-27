import { NextRequest, NextResponse } from "next/server";
import { SEGMENTS, type SegmentId } from "@/lib/segments";
import { getSupabaseAdmin } from "@/lib/supabase";
import { STRATEGY_LAB_RULES } from "@/lib/strategy-lab/rules";
import { evaluateStrategiesForSegment } from "@/lib/strategy-lab/evaluators";
import type {
  LabCandle,
  LabOIBuildupPoint,
  LabSnapshot,
  StrategyEvaluation,
  StrategyId,
} from "@/lib/strategy-lab/types";

const MAX_RANGE_DAYS = 14;
const DEFAULT_DAYS = 7;
const PAGE_SIZE = 1000;

function asNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseDays(value: string | null): number {
  if (!value) return DEFAULT_DAYS;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_DAYS;
  return Math.min(MAX_RANGE_DAYS, Math.max(3, parsed));
}

function parseSegment(value: string | null): SegmentId[] {
  if (!value || value.toUpperCase() === "ALL") {
    return SEGMENTS.map((segment) => segment.id);
  }
  const segment = value.toUpperCase();
  if (!SEGMENTS.some((item) => item.id === segment)) return [];
  return [segment as SegmentId];
}

function parseStrategyIds(value: string | null): StrategyId[] {
  if (!value) return STRATEGY_LAB_RULES.map((rule) => rule.id);
  const allowed = new Set(STRATEGY_LAB_RULES.map((rule) => rule.id));
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is StrategyId => allowed.has(item as StrategyId));
}

async function fetchCandles(
  segment: SegmentId,
  fromIso: string,
  toIso: string
): Promise<LabCandle[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const rows: Record<string, unknown>[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await sb
      .from("market_candles")
      .select("candle_time, open, high, low, close, volume")
      .eq("segment", segment)
      .eq("interval", "ONE_MINUTE")
      .gte("candle_time", fromIso)
      .lte("candle_time", toIso)
      .order("candle_time", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to load candles for ${segment}: ${error.message}`);
    const chunk = (data ?? []) as Record<string, unknown>[];
    rows.push(...chunk);
    if (chunk.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return rows
    .map((row) => {
      const time = String(row.candle_time ?? "");
      const open = asNumber(row.open);
      const high = asNumber(row.high);
      const low = asNumber(row.low);
      const close = asNumber(row.close);
      const volume = asNumber(row.volume) ?? 0;
      if (!time || open == null || high == null || low == null || close == null) return null;
      return { time, open, high, low, close, volume };
    })
    .filter((row): row is LabCandle => row !== null);
}

async function fetchSnapshots(
  segment: SegmentId,
  fromIso: string,
  toIso: string
): Promise<LabSnapshot[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from("market_snapshots")
    .select("snapshot_at, pcr, buy_qty, sell_qty, trade_volume, max_pain, ltp")
    .eq("segment", segment)
    .gte("snapshot_at", fromIso)
    .lte("snapshot_at", toIso)
    .order("snapshot_at", { ascending: true });

  if (error) throw new Error(`Failed to load snapshots for ${segment}: ${error.message}`);

  return ((data ?? []) as Record<string, unknown>[])
    .map((row) => {
      const time = String(row.snapshot_at ?? "");
      if (!time) return null;
      return {
        time,
        pcr: asNumber(row.pcr),
        buyQty: asNumber(row.buy_qty),
        sellQty: asNumber(row.sell_qty),
        tradeVolume: asNumber(row.trade_volume),
        maxPain: asNumber(row.max_pain),
        ltp: asNumber(row.ltp),
      };
    })
    .filter((row): row is LabSnapshot => row !== null);
}

async function fetchOiPoints(
  segment: SegmentId,
  fromIso: string,
  toIso: string
): Promise<{ points: LabOIBuildupPoint[]; rowCount: number; pageCount: number }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { points: [], rowCount: 0, pageCount: 0 };
  const rows: Record<string, unknown>[] = [];
  let offset = 0;
  let pageCount = 0;
  while (true) {
    const { data, error } = await sb
      .from("market_oi_buildup")
      .select("snapshot_at, bucket, oi_change")
      .eq("segment", segment)
      .gte("snapshot_at", fromIso)
      .lte("snapshot_at", toIso)
      .order("snapshot_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to load OI buildup for ${segment}: ${error.message}`);
    const chunk = (data ?? []) as Record<string, unknown>[];
    rows.push(...chunk);
    pageCount += 1;
    if (chunk.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const bucketed = new Map<string, { longOiChange: number; shortOiChange: number }>();
  for (const row of rows) {
    const time = String(row.snapshot_at ?? "");
    if (!time) continue;
    const bucket = String(row.bucket ?? "").toUpperCase();
    const oiChange = asNumber(row.oi_change) ?? 0;
    if (!bucketed.has(time)) {
      bucketed.set(time, { longOiChange: 0, shortOiChange: 0 });
    }
    const current = bucketed.get(time)!;
    if (bucket === "LONG") current.longOiChange += oiChange;
    if (bucket === "SHORT") current.shortOiChange += oiChange;
  }

  const points = Array.from(bucketed.entries())
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .map(([time, value]) => ({
      time,
      longOiChange: value.longOiChange,
      shortOiChange: value.shortOiChange,
    }));
  return { points, rowCount: rows.length, pageCount };
}

function validateEvaluations(
  segment: SegmentId,
  evaluations: StrategyEvaluation[],
  warnings: string[]
): void {
  for (const item of evaluations) {
    const k = item.kpis;
    const summed = k.wins + k.losses + k.scratches;
    if (k.trades !== summed) {
      warnings.push(
        `${segment}/${item.strategyId}: KPI mismatch (trades=${k.trades}, outcomes=${summed}).`
      );
    }
    if (k.winRate < 0 || k.winRate > 100) {
      warnings.push(`${segment}/${item.strategyId}: Win rate out of range (${k.winRate}).`);
    }
    if (!Number.isFinite(k.profitFactor) || !Number.isFinite(k.netR)) {
      warnings.push(`${segment}/${item.strategyId}: Non-finite KPI detected.`);
    }
    if (k.maxDrawdownR < 0) {
      warnings.push(`${segment}/${item.strategyId}: Negative max drawdown detected.`);
    }
  }
}

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
  const segments = parseSegment(searchParams.get("segment"));
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

  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const warnings: string[] = [];
  const segmentSummaries: Array<{
    segment: SegmentId;
    evaluations: ReturnType<typeof evaluateStrategiesForSegment>;
    bestStrategy: ReturnType<typeof evaluateStrategiesForSegment>[number] | null;
    diagnostics: {
      candleRowsFetched: number;
      snapshotRowsFetched: number;
      oiRowsFetched: number;
      oiPointsMapped: number;
      oiPagesFetched: number;
    };
  }> = [];

  for (const segment of segments) {
    try {
      const [candles, snapshots, oiFetch] = await Promise.all([
        fetchCandles(segment, fromIso, toIso),
        fetchSnapshots(segment, fromIso, toIso),
        fetchOiPoints(segment, fromIso, toIso),
      ]);
      const oiPoints = oiFetch.points;

      if (candles.length < 200) {
        warnings.push(
          `${segment}: limited one-minute candle data (${candles.length} rows) in selected range.`
        );
      }
      if (oiFetch.rowCount >= PAGE_SIZE) {
        warnings.push(
          `${segment}: fetched ${oiFetch.rowCount} OI rows across ${oiFetch.pageCount} pages.`
        );
      }

      const evaluations = evaluateStrategiesForSegment({
        segment,
        strategyIds,
        candlesOneMinute: candles,
        snapshots,
        oiPoints,
      });
      validateEvaluations(segment, evaluations, warnings);

      segmentSummaries.push({
        segment,
        evaluations,
        bestStrategy: evaluations[0] ?? null,
        diagnostics: {
          candleRowsFetched: candles.length,
          snapshotRowsFetched: snapshots.length,
          oiRowsFetched: oiFetch.rowCount,
          oiPointsMapped: oiPoints.length,
          oiPagesFetched: oiFetch.pageCount,
        },
      });
    } catch (error) {
      warnings.push(
        `${segment}: ${error instanceof Error ? error.message : "Failed to evaluate segment"}`
      );
      segmentSummaries.push({
        segment,
        evaluations: [],
        bestStrategy: null,
        diagnostics: {
          candleRowsFetched: 0,
          snapshotRowsFetched: 0,
          oiRowsFetched: 0,
          oiPointsMapped: 0,
          oiPagesFetched: 0,
        },
      });
    }
  }

  const overallRanking = segmentSummaries
    .flatMap((item) => item.evaluations)
    .sort((a, b) => b.score - a.score);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    from: fromIso,
    to: toIso,
    days,
    pageSize: PAGE_SIZE,
    segments: segmentSummaries,
    overallRanking,
    warnings,
  });
}