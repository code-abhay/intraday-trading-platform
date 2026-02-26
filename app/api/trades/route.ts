import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

const USER_ID = "default";

function toSnake(trade: Record<string, unknown>) {
  return {
    id: trade.id,
    segment: trade.segment,
    segment_label: trade.segmentLabel,
    strike: trade.strike,
    side: trade.side,
    expiry: trade.expiry,
    entry_premium: trade.entryPremium,
    entry_underlying: trade.entryUnderlying,
    current_premium: trade.currentPremium,
    qty: trade.qty,
    lot_size: trade.lotSize,
    sl_premium: trade.slPremium,
    t1_premium: trade.t1Premium,
    t2_premium: trade.t2Premium,
    t3_premium: trade.t3Premium,
    trail_sl_premium: trade.trailSLPremium,
    active_sl: trade.activeSL,
    invested: trade.invested,
    status: trade.status,
    t1_reached: trade.t1Reached,
    t2_reached: trade.t2Reached,
    pnl: trade.pnl,
    exit_premium: trade.exitPremium,
    exit_reason: trade.exitReason,
    created_at: trade.createdAt,
    closed_at: trade.closedAt,
    user_id: USER_ID,
  };
}

function toCamel(row: Record<string, unknown>) {
  return {
    id: row.id,
    segment: row.segment,
    segmentLabel: row.segment_label,
    strike: Number(row.strike),
    side: row.side,
    expiry: row.expiry ?? "",
    entryPremium: Number(row.entry_premium),
    entryUnderlying: Number(row.entry_underlying),
    currentPremium: Number(row.current_premium),
    qty: Number(row.qty),
    lotSize: Number(row.lot_size),
    slPremium: Number(row.sl_premium),
    t1Premium: Number(row.t1_premium),
    t2Premium: Number(row.t2_premium),
    t3Premium: Number(row.t3_premium),
    trailSLPremium: Number(row.trail_sl_premium),
    activeSL: Number(row.active_sl),
    invested: Number(row.invested),
    status: row.status,
    t1Reached: row.t1_reached,
    t2Reached: row.t2_reached,
    pnl: Number(row.pnl),
    exitPremium: row.exit_premium != null ? Number(row.exit_premium) : undefined,
    exitReason: row.exit_reason ?? undefined,
    createdAt: row.created_at,
    closedAt: row.closed_at ?? undefined,
  };
}

// GET /api/trades — list all trades
export async function GET() {
  const sb = getSupabase();
  if (!sb) {
    return NextResponse.json({ enabled: false, trades: [] });
  }

  const { data, error } = await sb
    .from("paper_trades")
    .select("*")
    .eq("user_id", USER_ID)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    enabled: true,
    trades: (data ?? []).map(toCamel),
  });
}

// POST /api/trades — upsert trades (bulk sync)
export async function POST(req: NextRequest) {
  const sb = getSupabase();
  if (!sb) {
    return NextResponse.json({ enabled: false });
  }

  const { trades } = await req.json();
  if (!Array.isArray(trades)) {
    return NextResponse.json({ error: "trades must be an array" }, { status: 400 });
  }

  const rows = trades.map(toSnake);
  const { error } = await sb
    .from("paper_trades")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ enabled: true, synced: rows.length });
}

// DELETE /api/trades — delete all trades
export async function DELETE() {
  const sb = getSupabase();
  if (!sb) {
    return NextResponse.json({ enabled: false });
  }

  const { error } = await sb
    .from("paper_trades")
    .delete()
    .eq("user_id", USER_ID);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ enabled: true, deleted: true });
}
