"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { SEGMENTS, type SegmentId, getSegment } from "@/lib/segments";
import Link from "next/link";

const TRADES_KEY = "paper_trades_v3";
const SETTINGS_KEY = "paper_trade_settings";
const DEFAULT_CAPITAL = 100000;

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
  activeSL: number; // current active SL (moves up after T1)
  invested: number;
  status: "OPEN" | "T1_HIT" | "T2_HIT" | "T3_HIT" | "SL_HIT" | "TRAIL_SL" | "CLOSED";
  t1Reached: boolean;
  t2Reached: boolean;
  pnl: number;
  exitPremium?: number;
  createdAt: string;
  closedAt?: string;
  exitReason?: string;
}

interface Settings {
  autoExecute: boolean;
}

function loadTrades(): PaperTrade[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(TRADES_KEY) ?? "[]"); } catch { return []; }
}
function saveTrades(t: PaperTrade[]) {
  if (typeof window !== "undefined") try { localStorage.setItem(TRADES_KEY, JSON.stringify(t)); } catch {}
}
function loadSettings(): Settings {
  if (typeof window === "undefined") return { autoExecute: false };
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{"autoExecute":false}'); } catch { return { autoExecute: false }; }
}
function saveSettings(s: Settings) {
  if (typeof window !== "undefined") try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch {}
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
    premiumEntry: number; premiumSL: number; premiumT1: number;
    premiumT2: number; premiumT3: number; premiumTrailSL: number;
  };
}

type Tab = "trading" | "analytics";

export default function PaperTradePage() {
  const [trades, setTrades] = useState<PaperTrade[]>([]);
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});
  const [activeSegment, setActiveSegment] = useState<SegmentId>("NIFTY");
  const [lotQty, setLotQty] = useState(1);
  const [tab, setTab] = useState<Tab>("trading");
  const [settings, setSettings] = useState<Settings>({ autoExecute: false });
  const [autoExitLog, setAutoExitLog] = useState<string[]>([]);
  const tradesRef = useRef(trades);
  tradesRef.current = trades;

  useEffect(() => { setTrades(loadTrades()); setSettings(loadSettings()); }, []);

  // Derived capital (no separate capital state — purely from trades)
  const openTrades = trades.filter((t) => t.status === "OPEN");
  const closedTrades = trades.filter((t) => t.status !== "OPEN");
  const totalInvested = openTrades.reduce((s, t) => s + t.invested, 0);
  const unrealizedPnl = openTrades.reduce((s, t) => s + t.pnl, 0);
  const realizedPnl = closedTrades.reduce((s, t) => s + t.pnl, 0);
  const available = DEFAULT_CAPITAL + realizedPnl - totalInvested;

  function addLog(msg: string) {
    const ts = new Date().toLocaleTimeString();
    setAutoExitLog((prev) => [`[${ts}] ${msg}`, ...prev].slice(0, 50));
  }

  /**
   * Auto-exit engine: runs on every premium update.
   * Checks SL, T1, T2, T3, and trailing SL for all open trades.
   */
  function processAutoExits(updatedTrades: PaperTrade[]): PaperTrade[] {
    let changed = false;
    const processed: PaperTrade[] = updatedTrades.map((t): PaperTrade => {
      if (t.status !== "OPEN") return t;
      const cp = t.currentPremium;

      if (cp <= t.activeSL) {
        changed = true;
        const exitStatus: PaperTrade["status"] = t.t1Reached ? "TRAIL_SL" : "SL_HIT";
        const pnl = (cp - t.entryPremium) * t.qty * t.lotSize;
        addLog(`${t.segmentLabel} ${t.strike} ${t.side}: ${exitStatus} @ ₹${cp} (Entry ₹${t.entryPremium}, P&L ${pnl >= 0 ? "+" : ""}₹${Math.round(pnl)})`);
        return { ...t, status: exitStatus, pnl, exitPremium: cp, closedAt: new Date().toISOString(), exitReason: `Auto ${exitStatus}: Premium ₹${cp} <= SL ₹${t.activeSL}` };
      }

      if (cp >= t.t3Premium) {
        changed = true;
        const pnl = (cp - t.entryPremium) * t.qty * t.lotSize;
        addLog(`${t.segmentLabel} ${t.strike} ${t.side}: T3 HIT @ ₹${cp} (Entry ₹${t.entryPremium}, P&L +₹${Math.round(pnl)})`);
        return { ...t, status: "T3_HIT" as const, t1Reached: true, t2Reached: true, pnl, exitPremium: cp, closedAt: new Date().toISOString(), exitReason: `Auto T3: Premium ₹${cp} >= T3 ₹${t.t3Premium}` };
      }

      if (!t.t2Reached && cp >= t.t2Premium) {
        changed = true;
        const newTrailSL = Math.round(t.t2Premium * 0.9);
        addLog(`${t.segmentLabel} ${t.strike} ${t.side}: T2 reached @ ₹${cp}, Trail SL → ₹${newTrailSL}`);
        const pnl = (cp - t.entryPremium) * t.qty * t.lotSize;
        return { ...t, t1Reached: true, t2Reached: true, activeSL: newTrailSL, pnl };
      }

      if (!t.t1Reached && cp >= t.t1Premium) {
        changed = true;
        const newSL = t.trailSLPremium;
        addLog(`${t.segmentLabel} ${t.strike} ${t.side}: T1 reached @ ₹${cp}, SL moved to ₹${newSL} (was ₹${t.activeSL})`);
        const pnl = (cp - t.entryPremium) * t.qty * t.lotSize;
        return { ...t, t1Reached: true, activeSL: newSL, pnl };
      }

      return t;
    });

    if (changed) saveTrades(processed);
    return changed ? processed : updatedTrades;
  }

  const fetchQuote = useCallback(async (seg: SegmentId) => {
    try {
      const res = await fetch(`/api/signals?symbol=${seg}`);
      if (!res.ok) return;
      const json = await res.json();
      const q: LiveQuote = {
        segment: seg, ltp: json.underlyingValue, bias: json.signal?.bias ?? "NEUTRAL",
        optionStrike: json.signal?.optionsAdvisor?.strike,
        optionSide: json.signal?.optionsAdvisor?.side,
        optionPremium: json.signal?.optionsAdvisor?.premium,
        optionDelta: json.signal?.optionsAdvisor?.delta,
        expiry: json.expiry,
        optionTargets: json.signal?.optionsAdvisor?.optionTargets,
      };
      setQuotes((prev) => ({ ...prev, [seg]: q }));

      setTrades((prev) => {
        // Update premiums for open trades
        const updated = prev.map((t) => {
          if (t.status !== "OPEN" || t.segment !== seg) return t;
          const premiumDelta = q.optionDelta ?? 0.5;
          const priceMove = json.underlyingValue - t.strike;
          const newPremium = Math.max(1, Math.round(t.entryPremium + priceMove * premiumDelta * (t.side === "CALL" ? 1 : -1)));
          const pnl = (newPremium - t.entryPremium) * t.qty * t.lotSize;
          return { ...t, currentPremium: newPremium, pnl };
        });
        // Run auto-exit engine
        return processAutoExits(updated);
      });
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchQuote(activeSegment);
    const interval = setInterval(() => fetchQuote(activeSegment), 30000);
    return () => clearInterval(interval);
  }, [activeSegment, fetchQuote]);

  useEffect(() => {
    const openSegs = [...new Set(trades.filter((t) => t.status === "OPEN").map((t) => t.segment))];
    openSegs.forEach((s) => { if (s !== activeSegment) fetchQuote(s); });
  }, [trades, activeSegment, fetchQuote]);

  const q = quotes[activeSegment];

  function executeTrade() {
    if (!q?.optionStrike || !q.optionPremium || !q.optionTargets) return;
    if (q.optionSide === "BALANCED") return;
    const seg = getSegment(activeSegment);
    const premium = q.optionPremium;
    const lotSize = seg.lotSize;
    const maxQty = Math.floor(available / (premium * lotSize));
    const qty = Math.max(1, Math.min(maxQty, lotQty));
    const invested = premium * qty * lotSize;
    if (invested > available || available <= 0) return;
    const trade: PaperTrade = {
      id: `pt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      segment: activeSegment, segmentLabel: seg.label,
      strike: q.optionStrike, side: q.optionSide as "CALL" | "PUT",
      expiry: q.expiry ?? "", entryPremium: premium, currentPremium: premium,
      qty, lotSize, invested,
      slPremium: q.optionTargets.premiumSL, t1Premium: q.optionTargets.premiumT1,
      t2Premium: q.optionTargets.premiumT2, t3Premium: q.optionTargets.premiumT3,
      trailSLPremium: q.optionTargets.premiumTrailSL,
      activeSL: q.optionTargets.premiumSL, // initial SL
      status: "OPEN", t1Reached: false, t2Reached: false,
      pnl: 0, createdAt: new Date().toISOString(),
    };
    const next = [trade, ...trades];
    setTrades(next); saveTrades(next);
    addLog(`OPENED: ${seg.label} ${q.optionStrike} ${q.optionSide} @ ₹${premium} | SL ₹${q.optionTargets.premiumSL} | T1 ₹${q.optionTargets.premiumT1} | T2 ₹${q.optionTargets.premiumT2} | T3 ₹${q.optionTargets.premiumT3}`);
  }

  function manualClose(id: string, status: PaperTrade["status"] = "CLOSED") {
    const updated = trades.map((t) => {
      if (t.id !== id) return t;
      const pnl = (t.currentPremium - t.entryPremium) * t.qty * t.lotSize;
      return { ...t, status, pnl, exitPremium: t.currentPremium, closedAt: new Date().toISOString(), exitReason: `Manual ${status}` };
    });
    setTrades(updated); saveTrades(updated);
    const closed = updated.find((t) => t.id === id);
    if (closed) addLog(`MANUAL EXIT: ${closed.segmentLabel} ${closed.strike} ${closed.side} @ ₹${closed.currentPremium} → ${status}`);
  }

  function resetAll() {
    setTrades([]); saveTrades([]);
    setAutoExitLog([]);
  }

  function toggleAutoExecute() {
    const next = { ...settings, autoExecute: !settings.autoExecute };
    setSettings(next); saveSettings(next);
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
              {SEGMENTS.map((s) => <option key={s.id} value={s.id}>{s.label} (Lot: {s.lotSize})</option>)}
            </select>
          </div>
        </div>
      </nav>

      <main className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-0">
          {(["trading", "analytics"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t ? "text-emerald-400 border-emerald-400" : "text-zinc-500 border-transparent hover:text-zinc-300"}`}>
              {t === "trading" ? "Trading" : "Performance Analytics"}
            </button>
          ))}
        </div>

        {tab === "trading" && (
          <>
            {/* Capital Overview */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard title="Starting Capital" value={`₹${DEFAULT_CAPITAL.toLocaleString()}`} />
              <StatCard title="Available" value={`₹${Math.round(available).toLocaleString()}`} color={available > 0 ? "text-emerald-400" : "text-red-400"} />
              <StatCard title="Invested" value={`₹${Math.round(totalInvested).toLocaleString()}`} />
              <StatCard title="Unrealized P&L" value={`${unrealizedPnl >= 0 ? "+" : ""}₹${Math.round(unrealizedPnl).toLocaleString()}`} color={unrealizedPnl >= 0 ? "text-emerald-400" : "text-red-400"} />
              <StatCard title="Realized P&L" value={`${realizedPnl >= 0 ? "+" : ""}₹${Math.round(realizedPnl).toLocaleString()}`} color={realizedPnl >= 0 ? "text-emerald-400" : "text-red-400"} />
            </div>

            {/* Execute Trade */}
            {q && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-emerald-400">Execute Trade</h2>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={settings.autoExecute} onChange={toggleAutoExecute}
                        className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 accent-emerald-500" />
                      <span className="text-xs text-zinc-400">Auto-execute signals</span>
                    </label>
                  </div>
                  <span className={`text-sm font-medium ${q.bias === "BULLISH" ? "text-emerald-400" : q.bias === "BEARISH" ? "text-red-400" : "text-zinc-400"}`}>
                    {q.segment} @ {q.ltp?.toFixed(2)} · {q.bias}
                  </span>
                </div>
                {q.optionStrike && q.optionPremium && q.optionSide !== "BALANCED" ? (
                  <div className="flex flex-wrap items-end gap-4">
                    <div>
                      <div className="text-xs text-zinc-500">Option</div>
                      <div className={`font-bold ${q.optionSide === "CALL" ? "text-emerald-400" : "text-red-400"}`}>{q.optionStrike} {q.optionSide}</div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500">Premium</div>
                      <div className="font-bold">₹{q.optionPremium}</div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500">Lot Size</div>
                      <div className="font-bold">{getSegment(activeSegment).lotSize}</div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500">Lots</div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setLotQty(Math.max(1, lotQty - 1))} className="rounded bg-zinc-700 px-2 py-0.5 text-sm hover:bg-zinc-600">-</button>
                        <span className="font-bold w-6 text-center">{lotQty}</span>
                        <button onClick={() => setLotQty(Math.min(10, lotQty + 1))} className="rounded bg-zinc-700 px-2 py-0.5 text-sm hover:bg-zinc-600">+</button>
                      </div>
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
                          <div className="text-xs text-zinc-500">T1/T2/T3</div>
                          <div className="font-medium text-emerald-400 text-sm">₹{q.optionTargets.premiumT1}/₹{q.optionTargets.premiumT2}/₹{q.optionTargets.premiumT3}</div>
                        </div>
                      </>
                    )}
                    <button onClick={executeTrade} disabled={available < (q.optionPremium ?? 0) * getSegment(activeSegment).lotSize}
                      className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed">
                      Buy {q.optionStrike} {q.optionSide}
                    </button>
                  </div>
                ) : (
                  <p className="text-zinc-500 text-sm">Waiting for directional signal... Market is {q.bias}.</p>
                )}
                <div className="mt-2 flex items-center gap-2 text-xs text-zinc-600">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  SL, T1, T2, T3 & Trailing SL execute automatically on every refresh (30s)
                </div>
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
                    <thead><tr className="text-left text-zinc-500 border-b border-zinc-700">
                      <th className="py-2 px-2">Option</th><th className="py-2 px-2">Entry</th><th className="py-2 px-2">LTP</th>
                      <th className="py-2 px-2">Active SL</th><th className="py-2 px-2">T1/T2/T3</th><th className="py-2 px-2">Qty</th>
                      <th className="py-2 px-2">Invested</th><th className="py-2 px-2">P&L</th><th className="py-2 px-2">Manual</th>
                    </tr></thead>
                    <tbody>{openTrades.map((t) => {
                      const pnlPct = t.invested > 0 ? ((t.pnl / t.invested) * 100).toFixed(1) : "0";
                      return (
                        <tr key={t.id} className="border-b border-zinc-800">
                          <td className={`py-2 px-2 font-medium ${t.side === "CALL" ? "text-emerald-400" : "text-red-400"}`}>
                            {t.segmentLabel} {t.strike} {t.side}
                            <span className="text-zinc-500 text-xs block">{t.expiry}</span>
                            {t.t1Reached && <span className="text-amber-400 text-xs">T1 ✓</span>}
                            {t.t2Reached && <span className="text-amber-400 text-xs ml-1">T2 ✓</span>}
                          </td>
                          <td className="py-2 px-2">₹{t.entryPremium}</td>
                          <td className={`py-2 px-2 font-medium ${t.currentPremium >= t.entryPremium ? "text-emerald-400" : "text-red-400"}`}>₹{t.currentPremium}</td>
                          <td className={`py-2 px-2 font-medium ${t.activeSL > t.slPremium ? "text-amber-400" : "text-red-400"}`}>
                            ₹{t.activeSL}
                            {t.activeSL > t.slPremium && <span className="text-xs block text-zinc-500">Trailing</span>}
                          </td>
                          <td className="py-2 px-2 text-xs">
                            <span className={t.t1Reached ? "text-zinc-600 line-through" : "text-emerald-400"}>₹{t.t1Premium}</span>/
                            <span className={t.t2Reached ? "text-zinc-600 line-through" : "text-emerald-400"}>₹{t.t2Premium}</span>/
                            <span className="text-emerald-400">₹{t.t3Premium}</span>
                          </td>
                          <td className="py-2 px-2">{t.qty}x{t.lotSize}</td>
                          <td className="py-2 px-2">₹{t.invested.toLocaleString()}</td>
                          <td className={`py-2 px-2 font-bold ${t.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {t.pnl >= 0 ? "+" : ""}₹{Math.round(t.pnl).toLocaleString()}<span className="text-xs block">({pnlPct}%)</span>
                          </td>
                          <td className="py-2 px-2">
                            <button onClick={() => manualClose(t.id, "CLOSED")} className="rounded bg-zinc-700 px-2 py-1 text-xs hover:bg-zinc-600">Exit</button>
                          </td>
                        </tr>);
                    })}</tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Auto-Exit Log */}
            {autoExitLog.length > 0 && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <h2 className="text-sm font-semibold text-amber-400 mb-2">Auto-Exit Log</h2>
                <div className="max-h-40 overflow-y-auto space-y-0.5">
                  {autoExitLog.map((log, i) => (
                    <p key={i} className="text-xs text-zinc-400 font-mono">{log}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Trade History */}
            {closedTrades.length > 0 && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <h2 className="text-lg font-semibold text-zinc-400 mb-3">Trade History ({closedTrades.length})</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-zinc-500 border-b border-zinc-700">
                      <th className="py-2 px-2">Option</th><th className="py-2 px-2">Entry</th><th className="py-2 px-2">Exit</th>
                      <th className="py-2 px-2">Invested</th><th className="py-2 px-2">P&L</th><th className="py-2 px-2">Exit Reason</th><th className="py-2 px-2">Time</th>
                    </tr></thead>
                    <tbody>{closedTrades.map((t) => (
                      <tr key={t.id} className="border-b border-zinc-800">
                        <td className="py-2 px-2">{t.segmentLabel} {t.strike} {t.side}</td>
                        <td className="py-2 px-2">₹{t.entryPremium}</td>
                        <td className="py-2 px-2">₹{t.exitPremium ?? t.currentPremium}</td>
                        <td className="py-2 px-2">₹{t.invested.toLocaleString()}</td>
                        <td className={`py-2 px-2 font-bold ${t.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {t.pnl >= 0 ? "+" : ""}₹{Math.round(t.pnl).toLocaleString()}
                        </td>
                        <td className="py-2 px-2">
                          <span className={`rounded px-2 py-0.5 text-xs ${
                            t.status === "SL_HIT" || t.status === "TRAIL_SL" ? "bg-red-900/50 text-red-400" :
                            t.status.startsWith("T") ? "bg-emerald-900/50 text-emerald-400" : "bg-zinc-700 text-zinc-400"
                          }`}>{t.exitReason ?? t.status.replace(/_/g, " ")}</span>
                        </td>
                        <td className="py-2 px-2 text-xs text-zinc-500">{new Date(t.closedAt ?? t.createdAt).toLocaleTimeString()}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={resetAll} className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 hover:border-zinc-500">
                Reset All Trades
              </button>
            </div>
          </>
        )}

        {tab === "analytics" && <AnalyticsDashboard trades={trades} />}
      </main>
    </div>
  );
}

// ─── Analytics Dashboard ──────────────────────────────────────

function AnalyticsDashboard({ trades }: { trades: PaperTrade[] }) {
  const closed = trades.filter((t) => t.status !== "OPEN");
  const open = trades.filter((t) => t.status === "OPEN");

  const totalPnl = closed.reduce((s, t) => s + t.pnl, 0) + open.reduce((s, t) => s + t.pnl, 0);
  const wins = closed.filter((t) => t.pnl > 0);
  const losses = closed.filter((t) => t.pnl <= 0);
  const winRate = closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : 0;
  const avgWin = wins.length > 0 ? Math.round(wins.reduce((s, t) => s + t.pnl, 0) / wins.length) : 0;
  const avgLoss = losses.length > 0 ? Math.round(losses.reduce((s, t) => s + t.pnl, 0) / losses.length) : 0;
  const maxWin = wins.length > 0 ? Math.max(...wins.map((t) => t.pnl)) : 0;
  const maxLoss = losses.length > 0 ? Math.min(...losses.map((t) => t.pnl)) : 0;
  const profitFactor = Math.abs(avgLoss) > 0 ? Math.abs(avgWin / avgLoss) : avgWin > 0 ? Infinity : 0;
  const returnPct = ((totalPnl / DEFAULT_CAPITAL) * 100).toFixed(1);

  const dailyPnl = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of closed) {
      const d = new Date(t.closedAt ?? t.createdAt).toLocaleDateString();
      map.set(d, (map.get(d) ?? 0) + t.pnl);
    }
    let cumulative = 0;
    return Array.from(map.entries()).map(([date, pnl]) => {
      cumulative += pnl;
      return { date, pnl: Math.round(pnl), cumulative: Math.round(cumulative) };
    });
  }, [closed]);

  const segmentBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; pnl: number; wins: number }>();
    for (const t of closed) {
      const key = t.segmentLabel;
      const prev = map.get(key) ?? { count: 0, pnl: 0, wins: 0 };
      map.set(key, { count: prev.count + 1, pnl: prev.pnl + t.pnl, wins: prev.wins + (t.pnl > 0 ? 1 : 0) });
    }
    return Array.from(map.entries()).map(([seg, v]) => ({ seg, ...v, winRate: v.count > 0 ? Math.round((v.wins / v.count) * 100) : 0 }));
  }, [closed]);

  const maxBar = dailyPnl.length > 0 ? Math.max(...dailyPnl.map((d) => Math.abs(d.pnl)), 1) : 1;
  const maxCum = dailyPnl.length > 0 ? Math.max(...dailyPnl.map((d) => Math.abs(d.cumulative)), 1) : 1;

  if (trades.length === 0) return <div className="text-center py-20 text-zinc-500"><p className="text-lg">No trades yet</p><p className="text-sm mt-2">Execute some trades to see analytics.</p></div>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total P&L" value={`${totalPnl >= 0 ? "+" : ""}₹${Math.abs(Math.round(totalPnl)).toLocaleString()}`} sub={`${returnPct}% return`} color={totalPnl >= 0 ? "emerald" : "red"} />
        <KpiCard label="Win Rate" value={`${winRate}%`} sub={`${wins.length}W / ${losses.length}L of ${closed.length}`} color="amber" />
        <KpiCard label="Profit Factor" value={profitFactor === Infinity ? "∞" : profitFactor.toFixed(2)} sub="Avg Win / Avg Loss" color="sky" />
        <KpiCard label="Open P&L" value={`${open.reduce((s, t) => s + t.pnl, 0) >= 0 ? "+" : ""}₹${Math.abs(Math.round(open.reduce((s, t) => s + t.pnl, 0))).toLocaleString()}`} sub={`${open.length} positions`} color={open.reduce((s, t) => s + t.pnl, 0) >= 0 ? "emerald" : "red"} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Best Trade" value={`+₹${Math.round(maxWin).toLocaleString()}`} sub="Single trade" color="emerald" />
        <KpiCard label="Worst Trade" value={`-₹${Math.abs(Math.round(maxLoss)).toLocaleString()}`} sub="Max loss" color="red" />
        <KpiCard label="Avg Win / Loss" value={`₹${avgWin} / ₹${Math.abs(avgLoss)}`} sub="Per trade" color="zinc" />
      </div>
      {dailyPnl.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <h3 className="text-sm font-semibold text-emerald-400 mb-4">Daily P&L</h3>
          <div className="flex items-end gap-1 h-40">
            {dailyPnl.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                <div className="absolute -top-6 hidden group-hover:block rounded bg-zinc-800 px-2 py-1 text-xs whitespace-nowrap z-10">{d.date}: {d.pnl >= 0 ? "+" : ""}₹{d.pnl.toLocaleString()}</div>
                <div className={`w-full rounded-t ${d.pnl >= 0 ? "bg-emerald-500" : "bg-red-500"}`} style={{ height: `${Math.max(4, (Math.abs(d.pnl) / maxBar) * 100)}%`, minHeight: 4 }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-zinc-600"><span>{dailyPnl[0]?.date}</span><span>{dailyPnl[dailyPnl.length - 1]?.date}</span></div>
        </div>
      )}
      {dailyPnl.length > 1 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <h3 className="text-sm font-semibold text-amber-400 mb-4">Cumulative P&L</h3>
          <div className="relative h-40">
            <svg viewBox={`0 0 ${dailyPnl.length * 20} 160`} className="w-full h-full" preserveAspectRatio="none">
              <line x1="0" y1="80" x2={dailyPnl.length * 20} y2="80" stroke="rgba(255,255,255,0.1)" strokeDasharray="4" />
              <polyline fill="none" stroke="#fbbf24" strokeWidth="2" points={dailyPnl.map((d, i) => `${i * 20 + 10},${80 - (d.cumulative / maxCum) * 70}`).join(" ")} />
              <polygon fill="rgba(251,191,36,0.1)" points={`10,80 ${dailyPnl.map((d, i) => `${i * 20 + 10},${80 - (d.cumulative / maxCum) * 70}`).join(" ")} ${(dailyPnl.length - 1) * 20 + 10},80`} />
            </svg>
          </div>
        </div>
      )}
      {segmentBreakdown.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <h3 className="text-sm font-semibold text-sky-400 mb-3">Segment Breakdown</h3>
          <div className="space-y-3">{segmentBreakdown.map((s) => (
            <div key={s.seg} className="flex items-center gap-4">
              <span className="w-24 text-sm font-medium text-zinc-300">{s.seg}</span>
              <div className="flex-1 bg-zinc-800 rounded h-4 overflow-hidden"><div className={`h-full rounded ${s.pnl >= 0 ? "bg-emerald-500/60" : "bg-red-500/60"}`} style={{ width: `${Math.max(5, s.winRate)}%` }} /></div>
              <span className={`text-sm font-bold w-20 text-right ${s.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>{s.pnl >= 0 ? "+" : ""}₹{Math.round(s.pnl).toLocaleString()}</span>
              <span className="text-xs text-zinc-500 w-16">{s.count} trades</span>
              <span className="text-xs text-zinc-500 w-12">{s.winRate}% W</span>
            </div>
          ))}</div>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <h3 className="text-sm font-semibold text-violet-400 mb-3">Exit Type Distribution</h3>
          {["SL_HIT", "TRAIL_SL", "T1_HIT", "T2_HIT", "T3_HIT", "CLOSED"].map((st) => {
            const count = closed.filter((t) => t.status === st).length;
            if (count === 0) return null;
            const pct = closed.length > 0 ? Math.round((count / closed.length) * 100) : 0;
            return <div key={st} className="flex items-center gap-3 mb-2"><span className="text-xs text-zinc-400 w-20">{st.replace(/_/g, " ")}</span><div className="flex-1 bg-zinc-800 rounded h-3 overflow-hidden"><div className={`h-full rounded ${st.includes("SL") ? "bg-red-500/50" : st.startsWith("T") ? "bg-emerald-500/50" : "bg-zinc-500/50"}`} style={{ width: `${pct}%` }} /></div><span className="text-xs text-zinc-500 w-12 text-right">{count} ({pct}%)</span></div>;
          })}
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          <h3 className="text-sm font-semibold text-orange-400 mb-3">Risk Metrics</h3>
          {[
            { label: "Max Consecutive Wins", value: maxConsecutive(closed, true) },
            { label: "Max Consecutive Losses", value: maxConsecutive(closed, false) },
            { label: "Largest Win Streak", value: `₹${Math.round(largestStreakPnl(closed, true)).toLocaleString()}` },
            { label: "Largest Loss Streak", value: `-₹${Math.abs(Math.round(largestStreakPnl(closed, false))).toLocaleString()}` },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between py-1.5 border-b border-zinc-800/50 last:border-0"><span className="text-xs text-zinc-500">{label}</span><span className="text-sm font-bold text-zinc-300 font-mono">{value}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}

function maxConsecutive(trades: PaperTrade[], isWin: boolean): number {
  let max = 0, cur = 0;
  for (const t of trades) { if ((isWin && t.pnl > 0) || (!isWin && t.pnl <= 0)) { cur++; max = Math.max(max, cur); } else cur = 0; }
  return max;
}
function largestStreakPnl(trades: PaperTrade[], isWin: boolean): number {
  let maxPnl = 0, curPnl = 0;
  for (const t of trades) { if ((isWin && t.pnl > 0) || (!isWin && t.pnl <= 0)) { curPnl += t.pnl; } else { if (isWin ? curPnl > maxPnl : curPnl < maxPnl) maxPnl = curPnl; curPnl = 0; } }
  if (isWin ? curPnl > maxPnl : curPnl < maxPnl) maxPnl = curPnl;
  return maxPnl;
}

function StatCard({ title, value, color }: { title: string; value: string; color?: string }) {
  return <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"><div className="text-xs text-zinc-500 uppercase tracking-wide">{title}</div><div className={`text-lg font-bold mt-1 ${color ?? ""}`}>{value}</div></div>;
}
function KpiCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const colorMap: Record<string, string> = { emerald: "text-emerald-400 border-emerald-800/50", red: "text-red-400 border-red-800/50", amber: "text-amber-400 border-amber-800/50", sky: "text-sky-400 border-sky-800/50", zinc: "text-zinc-300 border-zinc-700" };
  const cls = colorMap[color] ?? colorMap.zinc;
  return <div className={`rounded-lg border bg-zinc-900/50 p-4 ${cls.split(" ")[1]}`}><div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">{label}</div><div className={`text-2xl font-bold font-mono ${cls.split(" ")[0]}`}>{value}</div><div className="text-xs text-zinc-600 mt-1">{sub}</div></div>;
}
