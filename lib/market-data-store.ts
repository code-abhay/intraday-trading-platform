import type { AngelOneCandleRow, AngelOneOptionGreekRow } from "@/lib/angel-one";
import { getSupabaseAdmin } from "@/lib/supabase";

export interface MarketSnapshotInput {
  segment: string;
  source: string;
  snapshotAt: string;
  underlyingValue: number;
  marketData?: {
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    tradeVolume?: number;
    buyQty?: number;
    sellQty?: number;
  };
  pcr?: number | null;
  pcrSymbol?: string | null;
  maxPain?: number | null;
  signalBias?: string | null;
  signalConfidence?: number | null;
  signalSummary?: string | null;
  rawPayload?: unknown;
}

export interface OIBuildupInputRow {
  symbol: string;
  oiChange: number;
  priceChange: number;
}

export interface UniverseInputRow {
  exchange: string;
  symbol: string;
  token?: string;
  isIntradayAllowed: boolean;
  intradayMultiplier?: number | null;
  isCautionary: boolean;
  cautionMessage?: string | null;
}

export interface IngestionRunInput {
  runId: string;
  mode: "intraday" | "daily";
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  startedAt: string;
  completedAt: string;
  details?: unknown;
}

function asNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function toJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (value == null) return {};
  return { value };
}

export function isMarketDataStoreEnabled(): boolean {
  return !!getSupabaseAdmin();
}

export async function upsertMarketSnapshot(
  input: MarketSnapshotInput
): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;

  const row = {
    segment: input.segment,
    source: input.source,
    snapshot_at: normalizeTimestamp(input.snapshotAt),
    ltp: input.underlyingValue,
    open: asNumber(input.marketData?.open),
    high: asNumber(input.marketData?.high),
    low: asNumber(input.marketData?.low),
    close: asNumber(input.marketData?.close),
    trade_volume: asNumber(input.marketData?.tradeVolume),
    buy_qty: asNumber(input.marketData?.buyQty),
    sell_qty: asNumber(input.marketData?.sellQty),
    pcr: asNumber(input.pcr),
    pcr_symbol: input.pcrSymbol ?? null,
    max_pain: asNumber(input.maxPain),
    signal_bias: input.signalBias ?? null,
    signal_confidence: asNumber(input.signalConfidence),
    signal_summary: input.signalSummary ?? null,
    raw_payload: toJsonObject(input.rawPayload),
  };

  const { error } = await sb
    .from("market_snapshots")
    .upsert(row, { onConflict: "segment,snapshot_at" });

  if (error) {
    throw new Error(`Failed to upsert market snapshot: ${error.message}`);
  }
}

export async function replaceOIBuildupRows(
  snapshotAt: string,
  segment: string,
  longRows: OIBuildupInputRow[],
  shortRows: OIBuildupInputRow[]
): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;

  const ts = normalizeTimestamp(snapshotAt);
  const { error: deleteError } = await sb
    .from("market_oi_buildup")
    .delete()
    .eq("snapshot_at", ts)
    .eq("segment", segment);
  if (deleteError) {
    throw new Error(`Failed to clear OI buildup rows: ${deleteError.message}`);
  }

  const rows = [
    ...longRows.map((row) => ({
      snapshot_at: ts,
      segment,
      bucket: "LONG",
      trading_symbol: row.symbol,
      oi_change: asNumber(row.oiChange),
      price_change: asNumber(row.priceChange),
    })),
    ...shortRows.map((row) => ({
      snapshot_at: ts,
      segment,
      bucket: "SHORT",
      trading_symbol: row.symbol,
      oi_change: asNumber(row.oiChange),
      price_change: asNumber(row.priceChange),
    })),
  ];

  if (!rows.length) return;

  const { error } = await sb
    .from("market_oi_buildup")
    .upsert(rows, {
      onConflict: "snapshot_at,segment,bucket,trading_symbol",
    });
  if (error) {
    throw new Error(`Failed to upsert OI buildup rows: ${error.message}`);
  }
}

export async function replaceOptionGreeksRows(
  snapshotAt: string,
  segment: string,
  greeksRows: AngelOneOptionGreekRow[]
): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;

  const ts = normalizeTimestamp(snapshotAt);
  const { error: deleteError } = await sb
    .from("market_option_greeks")
    .delete()
    .eq("snapshot_at", ts)
    .eq("segment", segment);
  if (deleteError) {
    throw new Error(`Failed to clear option greeks rows: ${deleteError.message}`);
  }

  if (!greeksRows.length) return;

  const rows = greeksRows
    .map((row) => {
      const strike = asNumber(row.strikePrice);
      if (strike == null) return null;
      return {
        snapshot_at: ts,
        segment,
        expiry: row.expiry,
        strike,
        option_type: row.optionType,
        delta: asNumber(row.delta),
        gamma: asNumber(row.gamma),
        theta: asNumber(row.theta),
        vega: asNumber(row.vega),
        iv: asNumber(row.impliedVolatility),
        trade_volume: asNumber(row.tradeVolume),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (!rows.length) return;

  const { error } = await sb
    .from("market_option_greeks")
    .upsert(rows, {
      onConflict: "snapshot_at,segment,expiry,strike,option_type",
    });
  if (error) {
    throw new Error(`Failed to upsert option greeks rows: ${error.message}`);
  }
}

export async function upsertCandles(
  segment: string,
  interval: string,
  source: string,
  candles: AngelOneCandleRow[]
): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb || !candles.length) return;

  const rows = candles.map((candle) => ({
    segment,
    interval,
    source,
    candle_time: normalizeTimestamp(candle[0]),
    open: asNumber(candle[1]),
    high: asNumber(candle[2]),
    low: asNumber(candle[3]),
    close: asNumber(candle[4]),
    volume: asNumber(candle[5]),
  }));

  const { error } = await sb.from("market_candles").upsert(rows, {
    onConflict: "segment,interval,candle_time",
  });
  if (error) {
    throw new Error(`Failed to upsert candle rows: ${error.message}`);
  }
}

export async function replaceUniverseRowsForDate(
  snapshotDate: string,
  rows: UniverseInputRow[]
): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;

  const { error: deleteError } = await sb
    .from("market_universe_flags")
    .delete()
    .eq("snapshot_date", snapshotDate);
  if (deleteError) {
    throw new Error(`Failed to clear universe rows: ${deleteError.message}`);
  }

  if (!rows.length) return;

  const dbRows = rows.map((row) => ({
    snapshot_date: snapshotDate,
    exchange: row.exchange,
    symbol: row.symbol,
    token: row.token ?? "",
    is_intraday_allowed: row.isIntradayAllowed,
    intraday_multiplier: asNumber(row.intradayMultiplier),
    is_cautionary: row.isCautionary,
    caution_message: row.cautionMessage ?? null,
  }));

  const { error } = await sb.from("market_universe_flags").upsert(dbRows, {
    onConflict: "snapshot_date,exchange,symbol,token",
  });
  if (error) {
    throw new Error(`Failed to upsert universe rows: ${error.message}`);
  }
}

export async function upsertIngestionRun(input: IngestionRunInput): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;

  const row = {
    run_id: input.runId,
    mode: input.mode,
    status: input.status,
    started_at: normalizeTimestamp(input.startedAt),
    completed_at: normalizeTimestamp(input.completedAt),
    details: toJsonObject(input.details),
  };

  const { error } = await sb
    .from("market_ingestion_runs")
    .upsert(row, { onConflict: "run_id" });
  if (error) {
    throw new Error(`Failed to upsert ingestion run: ${error.message}`);
  }
}
