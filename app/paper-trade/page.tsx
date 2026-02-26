"use client";

import { useEffect, useState, useCallback } from "react";
import { SEGMENTS, type SegmentId } from "@/lib/segments";
import Link from "next/link";

const CAPITAL_KEY = "paper_trade_capital";
const TRADES_KEY = "paper_trades_v2";
const DEFAULT_CAPITAL = 10000;

interface PaperTrade {
  id: string;
  segment: SegmentId;
  segmentLabel: string;
  strike: number;
  side: "CALL" | "PUT";
  expiry: string;
  entryPremium: number;
  currentPremium: number;
  qty: number;
  lotSize: number;
  slPremium: number;
  t1Premium: number;
  t2Premium: number;
  t3Premium: number;
  trailSLPremium: number;
  invested: number;
  status: "OPEN" | "T1_HIT" | "T2_HIT" | "T3_HIT" | "SL_HIT" | "TRAIL_SL" | "CLOSED";
  pnl: number;
  createdAt: string;
  closedAt?: string;
}

function loadCapital(): number {
  if (typeof window === "undefined") return DEFAULT_CAPITAL;
  try { return parseFloat(localStorage.getItem(CAPITAL_KEY) ?? "") || DEFAULT_CAPITAL; } catch { return DEFAULT_CAPITAL; }
}

function saveCapital(v: number) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(CAPITAL_KEY, String(v)); } catch {}
}

function loadTrades(): PaperTrade[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(TRADES_KEY) ?? "[]"); } catch { return []; }
}

function saveTrades(t: PaperTrade[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(TRADES_KEY, JSON.stringify(t)); } catch {}
}

interface LiveQuote {
  segment: SegmentId;
  ltp: number;
  bias: string;
  optionStrike?: number;
  optionSide?: string;
  optionPremium?: number;
  optionDelta?: number;
  expiry?: string;
  optionTargets?: {
    premiumEntry: number;
    premiumSL: number;
    premiumT1: number;
    premiumT2: number;
    premiumT3: number;
    premiumTrailSL: number;
  };
}

export default function PaperTradePage() {
  const [capital, setCapital] = useState(DEFAULT_CAPITAL);
  const [trades, setTrades] = useState<PaperTrade[]>([]);
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});
  const [activeSegment, setActiveSegment] = useState<SegmentId>("NIFTY");

  useEffect(() => {
    setCapital(loadCapital());
    setTrades(loadTrades());
  }, []);

  const fetchQuote = useCallback(async (seg: SegmentId) => {
    try {
      const res = await fetch(`/api/signals?symbol=${seg}`);
      if (!res.ok) return;
      const json = await res.json();
      const q: LiveQuote = {
        segment: seg,
        ltp: json.underlyingValue,
        bias: json.signal?.bias ?? "NEUTRAL",
        optionStrike: json.signal?.optionsAdvisor?.strike,
        optionSide: json.signal?.optionsAdvisor?.side,
        optionPremium: json.signal?.optionsAdvisor?.premium,
        optionDelta: json.signal?.optionsAdvisor?.delta,
        expiry: json.expiry,
        optionTargets: json.signal?.optionsAdvisor?.optionTargets,
      };
      setQuotes((prev) => ({ ...prev, [seg]: q }));

      // Update open trades with simulated current premium
      setTrades((prev) => {
        let changed = false;
        const updated = prev.map((t) => {
          if (t.status !== "OPEN" || t.segment !== seg) return t;
          changed = true;
          const delta = t.side === "CALL"
            ? (json.underlyingValue - (t.strike - (json.underlyingValue - t.strike > 0 ? 0 : t.strike - json.underlyingValue))) * (q.optionDelta ?? 0.5)
            : 0;
          const priceMove = json.underlyingValue - (t.entryPremium > 0 ? t.strike : json.underlyingValue);
          const premiumDelta = q.optionDelta ?? 0.5;
          const newPremium = Math.max(1, Math.round(t.entryPremium + priceMove * premiumDelta * (t.side === "CALL" ? 1 : -1)));
          const pnl = (newPremium - t.entryPremium) * t.qty * t.lotSize;
          return { ...t, currentPremium: newPremium, pnl };
        });
        if (changed) saveTrades(updated);
        return changed ? updated : prev;
      });
    } catch {}
  }, []);

  useEffect(() => {
    fetchQuote(activeSegment);
    const interval = setInterval(() => fetchQuote(activeSegment), 30000);
    return () => clearInterval(interval);
  }, [activeSegment, fetchQuote]);

  // Also refresh open trade segments
  useEffect(() => {
    const openSegs = [...new Set(trades.filter((t) => t.status === "OPEN").map((t) => t.segment))];
    openSegs.forEach((s) => { if (s !== activeSegment) fetchQuote(s); });
  }, [trades, activeSegment, fetchQuote]);

  const q = quotes[activeSegment];
  const openTrades = trades.filter((t) => t.status === "OPEN");
  const closedTrades = trades.filter((t) => t.status !== "OPEN");

  const totalInvested = openTrades.reduce((s, t) => s + t.invested, 0);
  const unrealizedPnl = openTrades.reduce((s, t) => s + t.pnl, 0);
  const realizedPnl = closedTrades.reduce((s, t) => s + t.pnl, 0);
  const available = capital - totalInvested + realizedPnl;

  function executeTrade() {
    if (!q?.optionStrike || !q.optionPremium || !q.optionTargets) return;
    if (q.optionSide === "BALANCED") return;

    const seg = SEGMENTS.find((s) => s.id === activeSegment)!;
    const premium = q.optionPremium;
    const lotSize = seg.id === "NIFTY" ? 75 : seg.id === "BANKNIFTY" ? 30 : seg.id === "SENSEX" ? 20 : 50;
    const maxQty = Math.floor(available / (premium * lotSize));
    const qty = Math.max(1, Math.min(maxQty, 1));
    const invested = premium * qty * lotSize;

    if (invested > available) return;

    const trade: PaperTrade = {
      id: `pt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      segment: activeSegment,
      segmentLabel: seg.label,
      strike: q.optionStrike,
      side: q.optionSide as "CALL" | "PUT",
      expiry: q.expiry ?? "",
      entryPremium: premium,
      currentPremium: premium,
      qty, lotSize, invested,
      slPremium: q.optionTargets.premiumSL,
      t1Premium: q.optionTargets.premiumT1,
      t2Premium: q.optionTargets.premiumT2,
      t3Premium: q.optionTargets.premiumT3,
      trailSLPremium: q.optionTargets.premiumTrailSL,
      status: "OPEN",
      pnl: 0,
      createdAt: new Date().toISOString(),
    };
    const next = [trade, ...trades];
    setTrades(next);
    saveTrades(next);
  }

  function closeTrade(id: string, status: PaperTrade["status"] = "CLOSED") {
    const updated = trades.map((t) => {
      if (t.id !== id) return t;
      const finalPnl = (t.currentPremium - t.entryPremium) * t.qty * t.lotSize;
      return { ...t, status, pnl: finalPnl, closedAt: new Date().toISOString() };
    });
    setTrades(updated);
    saveTrades(updated);
    // Return capital
    const closed = updated.find((t) => t.id === id);
    if (closed) {
      const newCap = capital + closed.pnl;
      setCapital(newCap);
      saveCapital(newCap);
    }
  }

  function resetAll() {
    setCapital(DEFAULT_CAPITAL);
    saveCapital(DEFAULT_CAPITAL);
    setTrades([]);
    saveTrades([]);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <nav className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex gap-6">
            <Link href="/" className="text-zinc-400 hover:text-zinc-200">Dashboard</Link>
            <Link href="/paper-trade" className="font-semibold text-emerald-400">Paper Trade</Link>
            <Link href="/login" className="text-zinc-400 hover:text-zinc-200">Angel One Login</Link>
          </div>
          <div className="flex items-center gap-3">
            <select value={activeSegment} onChange={(e) => setActiveSegment(e.target.value as SegmentId)} className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm">
              {SEGMENTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>
      </nav>

      <main className="p-6 max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-emerald-400">Paper Trading</h1>

        {/* Capital Overview */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard title="Starting Capital" value={`₹${DEFAULT_CAPITAL.toLocaleString()}`} />
          <StatCard title="Available" value={`₹${Math.round(available).toLocaleString()}`} color={available > 0 ? "text-emerald-400" : "text-red-400"} />
          <StatCard title="Invested" value={`₹${Math.round(totalInvested).toLocaleString()}`} />
          <StatCard title="Unrealized P&L" value={`${unrealizedPnl >= 0 ? "+" : ""}₹${Math.round(unrealizedPnl).toLocaleString()}`} color={unrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"} />
          <StatCard title="Realized P&L" value={`${realizedPnl >= 0 ? "+" : ""}₹${Math.round(realizedPnl).toLocaleString()}`} color={realizedPnl >= 0 ? "text-emerald-400" : "text-red-400"} />
        </div>

        {/* Quick Trade Panel */}
        {q && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-emerald-400">Execute Trade</h2>
              <span className={`text-sm font-medium ${q.bias === "BULLISH" ? "text-emerald-400" : q.bias === "BEARISH" ? "text-red-400" : "text-zinc-400"}`}>
                {q.segment} @ {q.ltp?.toFixed(2)} · {q.bias}
              </span>
            </div>
            {q.optionStrike && q.optionPremium && q.optionSide !== "BALANCED" ? (
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <div className="text-xs text-zinc-500">Option</div>
                  <div className={`font-bold ${q.optionSide === "CALL" ? "text-emerald-400" : "text-red-400"}`}>
                    {q.optionStrike} {q.optionSide}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Premium</div>
                  <div className="font-bold">₹{q.optionPremium}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500">Expiry</div>
                  <div className="font-medium text-sm">{q.expiry || "—"}</div>
                </div>
                {q.optionTargets && (
                  <>
                    <div>
                      <div className="text-xs text-zinc-500">SL</div>
                      <div className="font-medium text-red-400 text-sm">₹{q.optionTargets.premiumSL}</div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500">T1 / T2 / T3</div>
                      <div className="font-medium text-emerald-400 text-sm">₹{q.optionTargets.premiumT1} / ₹{q.optionTargets.premiumT2} / ₹{q.optionTargets.premiumT3}</div>
                    </div>
                  </>
                )}
                <button
                  onClick={executeTrade}
                  disabled={available < (q.optionPremium ?? 0) * 20}
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Buy {q.optionStrike} {q.optionSide}
                </button>
              </div>
            ) : (
              <p className="text-zinc-500 text-sm">Waiting for directional signal... Market is {q.bias}.</p>
            )}
          </div>
        )}

        {/* Open Positions */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-lg font-semibold text-emerald-400 mb-3">Open Positions ({openTrades.length})</h2>
          {openTrades.length === 0 ? (
            <p className="text-zinc-500 text-sm">No open positions. Execute a trade above to start.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-zinc-700">
                    <th className="py-2 px-2">Option</th>
                    <th className="py-2 px-2">Entry</th>
                    <th className="py-2 px-2">Current</th>
                    <th className="py-2 px-2">SL</th>
                    <th className="py-2 px-2">T1/T2/T3</th>
                    <th className="py-2 px-2">Qty</th>
                    <th className="py-2 px-2">Invested</th>
                    <th className="py-2 px-2">P&L</th>
                    <th className="py-2 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {openTrades.map((t) => {
                    const pnlPct = t.invested > 0 ? ((t.pnl / t.invested) * 100).toFixed(1) : "0";
                    return (
                      <tr key={t.id} className="border-b border-zinc-800">
                        <td className={`py-2 px-2 font-medium ${t.side === "CALL" ? "text-emerald-400" : "text-red-400"}`}>
                          {t.segmentLabel} {t.strike} {t.side}
                          <span className="text-zinc-500 text-xs block">{t.expiry}</span>
                        </td>
                        <td className="py-2 px-2">₹{t.entryPremium}</td>
                        <td className={`py-2 px-2 font-medium ${t.currentPremium >= t.entryPremium ? "text-emerald-400" : "text-red-400"}`}>
                          ₹{t.currentPremium}
                        </td>
                        <td className="py-2 px-2 text-red-400">₹{t.slPremium}</td>
                        <td className="py-2 px-2 text-emerald-400 text-xs">₹{t.t1Premium}/₹{t.t2Premium}/₹{t.t3Premium}</td>
                        <td className="py-2 px-2">{t.qty}x{t.lotSize}</td>
                        <td className="py-2 px-2">₹{t.invested.toLocaleString()}</td>
                        <td className={`py-2 px-2 font-bold ${t.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {t.pnl >= 0 ? "+" : ""}₹{Math.round(t.pnl).toLocaleString()}
                          <span className="text-xs block">({pnlPct}%)</span>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex gap-1">
                            <button onClick={() => closeTrade(t.id, "CLOSED")} className="rounded bg-zinc-700 px-2 py-1 text-xs hover:bg-zinc-600">Exit</button>
                            <button onClick={() => closeTrade(t.id, "SL_HIT")} className="rounded bg-red-900/50 px-2 py-1 text-xs text-red-400 hover:bg-red-900/70">SL</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Closed Trades */}
        {closedTrades.length > 0 && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <h2 className="text-lg font-semibold text-zinc-400 mb-3">Trade History ({closedTrades.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-zinc-700">
                    <th className="py-2 px-2">Option</th>
                    <th className="py-2 px-2">Entry</th>
                    <th className="py-2 px-2">Exit</th>
                    <th className="py-2 px-2">Invested</th>
                    <th className="py-2 px-2">P&L</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 px-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {closedTrades.map((t) => (
                    <tr key={t.id} className="border-b border-zinc-800">
                      <td className="py-2 px-2">{t.segmentLabel} {t.strike} {t.side}</td>
                      <td className="py-2 px-2">₹{t.entryPremium}</td>
                      <td className="py-2 px-2">₹{t.currentPremium}</td>
                      <td className="py-2 px-2">₹{t.invested.toLocaleString()}</td>
                      <td className={`py-2 px-2 font-bold ${t.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {t.pnl >= 0 ? "+" : ""}₹{Math.round(t.pnl).toLocaleString()}
                      </td>
                      <td className="py-2 px-2">
                        <span className={`rounded px-2 py-0.5 text-xs ${
                          t.status === "SL_HIT" || t.status === "TRAIL_SL" ? "bg-red-900/50 text-red-400" :
                          t.status === "T3_HIT" || t.status === "T2_HIT" || t.status === "T1_HIT" ? "bg-emerald-900/50 text-emerald-400" :
                          "bg-zinc-700 text-zinc-400"
                        }`}>{t.status.replace(/_/g, " ")}</span>
                      </td>
                      <td className="py-2 px-2 text-xs text-zinc-500">{new Date(t.createdAt).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button onClick={resetAll} className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-500">
            Reset Capital & Trades
          </button>
        </div>
      </main>
    </div>
  );
}

function StatCard({ title, value, color }: { title: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
      <div className="text-xs text-zinc-500 uppercase tracking-wide">{title}</div>
      <div className={`text-lg font-bold mt-1 ${color ?? ""}`}>{value}</div>
    </div>
  );
}
