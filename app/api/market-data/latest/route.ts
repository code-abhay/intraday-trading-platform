import { NextRequest, NextResponse } from "next/server";
import { SEGMENTS, type SegmentId } from "@/lib/segments";
import { getSupabaseAdmin } from "@/lib/supabase";

function isValidSegment(segment?: string): segment is SegmentId {
  if (!segment) return false;
  return SEGMENTS.some((item) => item.id === segment);
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

function mapSnapshotRow(row: Record<string, unknown>) {
  return {
    segment: String(row.segment ?? ""),
    source: String(row.source ?? ""),
    snapshotAt: String(row.snapshot_at ?? ""),
    ltp: asNumber(row.ltp),
    open: asNumber(row.open),
    high: asNumber(row.high),
    low: asNumber(row.low),
    close: asNumber(row.close),
    tradeVolume: asNumber(row.trade_volume),
    buyQty: asNumber(row.buy_qty),
    sellQty: asNumber(row.sell_qty),
    pcr: asNumber(row.pcr),
    pcrSymbol: row.pcr_symbol ? String(row.pcr_symbol) : null,
    maxPain: asNumber(row.max_pain),
    signalBias: row.signal_bias ? String(row.signal_bias) : null,
    signalConfidence: asNumber(row.signal_confidence),
    signalSummary: row.signal_summary ? String(row.signal_summary) : null,
    rawPayload:
      row.raw_payload && typeof row.raw_payload === "object" ? row.raw_payload : {},
  };
}

export async function GET(request: NextRequest) {
  const sb = getSupabaseAdmin();
  if (!sb) {
    return NextResponse.json({
      enabled: false,
      error:
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    });
  }

  const segment = request.nextUrl.searchParams.get("segment") ?? undefined;
  if (segment && !isValidSegment(segment)) {
    return NextResponse.json(
      {
        error: "Invalid segment value",
        allowedSegments: SEGMENTS.map((item) => item.id),
      },
      { status: 400 }
    );
  }

  if (!segment) {
    const { data, error } = await sb
      .from("market_snapshots")
      .select("*")
      .order("snapshot_at", { ascending: false })
      .limit(500);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const latestBySegment = new Map<string, Record<string, unknown>>();
    for (const row of data ?? []) {
      const typed = row as Record<string, unknown>;
      const key = String(typed.segment ?? "");
      if (!key) continue;
      if (!latestBySegment.has(key)) latestBySegment.set(key, typed);
    }

    return NextResponse.json({
      enabled: true,
      generatedAt: new Date().toISOString(),
      snapshots: Array.from(latestBySegment.values()).map(mapSnapshotRow),
    });
  }

  const { data: snapshotRows, error: snapshotError } = await sb
    .from("market_snapshots")
    .select("*")
    .eq("segment", segment)
    .order("snapshot_at", { ascending: false })
    .limit(1);

  if (snapshotError) {
    return NextResponse.json({ error: snapshotError.message }, { status: 500 });
  }

  const latest = (snapshotRows?.[0] ?? null) as Record<string, unknown> | null;
  if (!latest) {
    return NextResponse.json(
      { enabled: true, segment, snapshot: null, message: "No snapshot found yet." },
      { status: 404 }
    );
  }

  const snapshotAt = String(latest.snapshot_at ?? "");

  const [oiRes, greeksRes, candlesRes] = await Promise.all([
    sb
      .from("market_oi_buildup")
      .select("*")
      .eq("segment", segment)
      .eq("snapshot_at", snapshotAt)
      .order("bucket", { ascending: true })
      .order("oi_change", { ascending: false }),
    sb
      .from("market_option_greeks")
      .select("*")
      .eq("segment", segment)
      .eq("snapshot_at", snapshotAt)
      .order("strike", { ascending: true })
      .limit(200),
    sb
      .from("market_candles")
      .select("*")
      .eq("segment", segment)
      .eq("interval", "ONE_MINUTE")
      .order("candle_time", { ascending: false })
      .limit(180),
  ]);

  if (oiRes.error || greeksRes.error || candlesRes.error) {
    return NextResponse.json(
      {
        error:
          oiRes.error?.message ||
          greeksRes.error?.message ||
          candlesRes.error?.message ||
          "Failed to load related market data",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    enabled: true,
    generatedAt: new Date().toISOString(),
    segment,
    snapshot: mapSnapshotRow(latest),
    oiBuildup: (oiRes.data ?? []).map((row) => ({
      bucket: row.bucket,
      tradingSymbol: row.trading_symbol,
      oiChange: asNumber(row.oi_change),
      priceChange: asNumber(row.price_change),
    })),
    optionGreeks: (greeksRes.data ?? []).map((row) => ({
      expiry: row.expiry,
      strike: asNumber(row.strike),
      optionType: row.option_type,
      delta: asNumber(row.delta),
      gamma: asNumber(row.gamma),
      theta: asNumber(row.theta),
      vega: asNumber(row.vega),
      iv: asNumber(row.iv),
      tradeVolume: asNumber(row.trade_volume),
    })),
    oneMinuteCandles: (candlesRes.data ?? [])
      .map((row) => ({
        candleTime: row.candle_time,
        open: asNumber(row.open),
        high: asNumber(row.high),
        low: asNumber(row.low),
        close: asNumber(row.close),
        volume: asNumber(row.volume),
      }))
      .reverse(),
  });
}
