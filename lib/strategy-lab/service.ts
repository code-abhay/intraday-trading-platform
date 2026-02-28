import { SEGMENTS, type SegmentId } from "@/lib/segments";
import { getSupabaseAdmin } from "@/lib/supabase";
import { evaluateStrategiesForSegmentDetailed } from "@/lib/strategy-lab/evaluators";
import { STRATEGY_LAB_RULES } from "@/lib/strategy-lab/rules";
import type {
  ExecutionProfile,
  LabCandle,
  LabOIBuildupPoint,
  LabSnapshot,
  StrategyEvaluation,
  StrategyId,
  StrategyLabApiResponse,
} from "@/lib/strategy-lab/types";

export const STRATEGY_LAB_PAGE_SIZE = 1000;
export const STRATEGY_LAB_MIN_DAYS = 7;
export const STRATEGY_LAB_MAX_DIRECT_DAYS = 45;
export const STRATEGY_LAB_MAX_DAYS = 365;
export const STRATEGY_LAB_DEFAULT_DAYS = 45;

function asNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function parseDays(value: string | null): number {
  if (!value) return STRATEGY_LAB_DEFAULT_DAYS;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return STRATEGY_LAB_DEFAULT_DAYS;
  return Math.min(STRATEGY_LAB_MAX_DAYS, Math.max(STRATEGY_LAB_MIN_DAYS, parsed));
}

export function parseProfile(value: string | null): ExecutionProfile {
  if (value?.toLowerCase() === "strict") return "strict";
  return "balanced";
}

export function parseSegments(value: string | null): SegmentId[] {
  if (!value || value.toUpperCase() === "ALL") {
    return SEGMENTS.map((segment) => segment.id);
  }
  const segment = value.toUpperCase();
  if (!SEGMENTS.some((item) => item.id === segment)) return [];
  return [segment as SegmentId];
}

export function parseStrategyIds(value: string | null): StrategyId[] {
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
      .range(offset, offset + STRATEGY_LAB_PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to load candles for ${segment}: ${error.message}`);
    const chunk = (data ?? []) as Record<string, unknown>[];
    rows.push(...chunk);
    if (chunk.length < STRATEGY_LAB_PAGE_SIZE) break;
    offset += STRATEGY_LAB_PAGE_SIZE;
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
  const rows: Record<string, unknown>[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await sb
      .from("market_snapshots")
      .select("snapshot_at, pcr, buy_qty, sell_qty, trade_volume, max_pain, ltp")
      .eq("segment", segment)
      .gte("snapshot_at", fromIso)
      .lte("snapshot_at", toIso)
      .order("snapshot_at", { ascending: true })
      .range(offset, offset + STRATEGY_LAB_PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to load snapshots for ${segment}: ${error.message}`);
    const chunk = (data ?? []) as Record<string, unknown>[];
    rows.push(...chunk);
    if (chunk.length < STRATEGY_LAB_PAGE_SIZE) break;
    offset += STRATEGY_LAB_PAGE_SIZE;
  }

  return rows
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
      .range(offset, offset + STRATEGY_LAB_PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to load OI buildup for ${segment}: ${error.message}`);
    const chunk = (data ?? []) as Record<string, unknown>[];
    rows.push(...chunk);
    pageCount += 1;
    if (chunk.length < STRATEGY_LAB_PAGE_SIZE) break;
    offset += STRATEGY_LAB_PAGE_SIZE;
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

export interface EvaluateStrategyLabInput {
  days: number;
  segments: SegmentId[];
  strategyIds: StrategyId[];
  profile: ExecutionProfile;
  fromIso?: string;
  toIso?: string;
}

export async function evaluateStrategyLab(
  input: EvaluateStrategyLabInput
): Promise<StrategyLabApiResponse> {
  const toIso = input.toIso ?? new Date().toISOString();
  const fromIso =
    input.fromIso ??
    new Date(new Date(toIso).getTime() - input.days * 24 * 60 * 60 * 1000).toISOString();
  const warnings: string[] = [];
  const segmentSummaries: StrategyLabApiResponse["segments"] = [];
  let duplicateThreshold = 72;
  const duplicatePairs: StrategyLabApiResponse["duplicateDiagnostics"]["pairs"] = [];
  const duplicateSummaries: StrategyLabApiResponse["duplicateDiagnostics"]["summaries"] = [];

  for (const segment of input.segments) {
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
      if (oiFetch.rowCount >= STRATEGY_LAB_PAGE_SIZE) {
        warnings.push(
          `${segment}: fetched ${oiFetch.rowCount} OI rows across ${oiFetch.pageCount} pages.`
        );
      }

      const detailed = evaluateStrategiesForSegmentDetailed({
        segment,
        strategyIds: input.strategyIds,
        candlesOneMinute: candles,
        snapshots,
        oiPoints,
        profile: input.profile,
        fromIso,
        toIso,
      });
      const evaluations = detailed.evaluations;
      duplicateThreshold = detailed.duplicateThreshold;
      duplicatePairs.push(...detailed.duplicatePairs);
      duplicateSummaries.push(...detailed.duplicateSummaries);
      const highOverlapPairs = detailed.duplicatePairs.filter(
        (pair) => pair.similarity >= detailed.duplicateThreshold
      );
      if (highOverlapPairs.length > 0) {
        warnings.push(
          `${segment}: ${highOverlapPairs.length} near-duplicate strategy pairs detected (similarity >= ${detailed.duplicateThreshold}).`
        );
      }
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

  return {
    mode: "direct",
    profile: input.profile,
    generatedAt: new Date().toISOString(),
    from: fromIso,
    to: toIso,
    days: input.days,
    pageSize: STRATEGY_LAB_PAGE_SIZE,
    segments: segmentSummaries,
    overallRanking,
    duplicateDiagnostics: {
      threshold: duplicateThreshold,
      pairs: duplicatePairs.sort((a, b) => b.similarity - a.similarity),
      summaries: duplicateSummaries.sort((a, b) => b.maxSimilarity - a.maxSimilarity),
    },
    warnings,
  };
}
