"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { SEGMENTS, type SegmentId, getSegment } from "@/lib/segments";
import { isMarketOpen, getMarketStatusMessage } from "@/lib/utils";
import { AppHeader, SegmentSelector } from "@/components/app-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Minus,
  Plus,
  ShoppingCart,
  History,
  BarChart3,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Menu,
} from "lucide-react";

const TRADES_KEY = "paper_trades_v3";
const SETTINGS_KEY = "paper_trade_settings";
const DEFAULT_CAPITAL = 100000;

interface PaperTrade {
  id: string; segment: SegmentId; segmentLabel: string; strike: number; side: "CALL" | "PUT";
  expiry: string; entryPremium: number; entryUnderlying: number; currentPremium: number;
  qty: number; lotSize: number; slPremium: number; t1Premium: number; t2Premium: number;
  t3Premium: number; trailSLPremium: number; activeSL: number; invested: number;
  status: "OPEN" | "T1_HIT" | "T2_HIT" | "T3_HIT" | "SL_HIT" | "TRAIL_SL" | "CLOSED";
  t1Reached: boolean; t2Reached: boolean; pnl: number; exitPremium?: number;
  createdAt: string; closedAt?: string; exitReason?: string;
}

interface Settings { autoExecute: boolean; }

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
  segment: SegmentId; ltp: number; bias: string; optionStrike?: number; optionSide?: string;
  optionPremium?: number; optionDelta?: number; expiry?: string;
  optionTargets?: { premiumEntry: number; premiumSL: number; premiumT1: number; premiumT2: number; premiumT3: number; premiumTrailSL: number; };
}

export default function PaperTradePage() {
  const [trades, setTrades] = useState<PaperTrade[]>([]);
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({});
  const [activeSegment, setActiveSegment] = useState<SegmentId>("NIFTY");
  const [lotQty, setLotQty] = useState(1);
  const [settings, setSettings] = useState<Settings>({ autoExecute: false });
  const [autoExitLog, setAutoExitLog] = useState<string[]>([]);
  const tradesRef = useRef(trades);
  tradesRef.current = trades;
  const [marketOpen, setMarketOpen] = useState(() => isMarketOpen());

  useEffect(() => { setTrades(loadTrades()); setSettings(loadSettings()); }, []);

  useEffect(() => {
    const check = () => setMarketOpen(isMarketOpen());
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);

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

  function processAutoExits(updatedTrades: PaperTrade[]): PaperTrade[] {
    let changed = false;
    const processed: PaperTrade[] = updatedTrades.map((t): PaperTrade => {
      if (t.status !== "OPEN") return t;
      const cp = t.currentPremium;
      if (cp <= t.activeSL) {
        changed = true;
        const exitStatus: PaperTrade["status"] = t.t1Reached ? "TRAIL_SL" : "SL_HIT";
        const pnl = (cp - t.entryPremium) * t.qty * t.lotSize;
        addLog(`${t.segmentLabel} ${t.strike} ${t.side}: ${exitStatus} @ ₹${cp} (P&L ${pnl >= 0 ? "+" : ""}₹${Math.round(pnl)})`);
        return { ...t, status: exitStatus, pnl, exitPremium: cp, closedAt: new Date().toISOString(), exitReason: `Auto ${exitStatus}` };
      }
      if (cp >= t.t3Premium) {
        changed = true;
        const pnl = (cp - t.entryPremium) * t.qty * t.lotSize;
        addLog(`${t.segmentLabel} ${t.strike} ${t.side}: T3 HIT @ ₹${cp} (P&L +₹${Math.round(pnl)})`);
        return { ...t, status: "T3_HIT" as const, t1Reached: true, t2Reached: true, pnl, exitPremium: cp, closedAt: new Date().toISOString(), exitReason: "Auto T3" };
      }
      if (!t.t2Reached && cp >= t.t2Premium) {
        changed = true;
        const newTrailSL = Math.round(t.t2Premium * 0.9);
        addLog(`${t.segmentLabel} ${t.strike} ${t.side}: T2 reached, Trail SL → ₹${newTrailSL}`);
        return { ...t, t1Reached: true, t2Reached: true, activeSL: newTrailSL, pnl: (cp - t.entryPremium) * t.qty * t.lotSize };
      }
      if (!t.t1Reached && cp >= t.t1Premium) {
        changed = true;
        addLog(`${t.segmentLabel} ${t.strike} ${t.side}: T1 reached, SL → ₹${t.trailSLPremium}`);
        return { ...t, t1Reached: true, activeSL: t.trailSLPremium, pnl: (cp - t.entryPremium) * t.qty * t.lotSize };
      }
      return t;
    });
    if (changed) saveTrades(processed);
    return changed ? processed : updatedTrades;
  }

  const fetchQuote = useCallback(async (seg: SegmentId) => {
    if (!isMarketOpen()) { setMarketOpen(false); return; }
    setMarketOpen(true);
    try {
      const res = await fetch(`/api/signals?symbol=${seg}`);
      if (!res.ok) return;
      const json = await res.json();
      const q: LiveQuote = {
        segment: seg, ltp: json.underlyingValue, bias: json.signal?.bias ?? "NEUTRAL",
        optionStrike: json.signal?.optionsAdvisor?.strike, optionSide: json.signal?.optionsAdvisor?.side,
        optionPremium: json.signal?.optionsAdvisor?.premium, optionDelta: json.signal?.optionsAdvisor?.delta,
        expiry: json.expiry, optionTargets: json.signal?.optionsAdvisor?.optionTargets,
      };
      setQuotes((prev) => ({ ...prev, [seg]: q }));
      setTrades((prev) => {
        const updated = prev.map((t) => {
          if (t.status !== "OPEN" || t.segment !== seg) return t;
          const delta = q.optionDelta ?? 0.5;
          const entryUnd = t.entryUnderlying || t.strike;
          const premiumChange = (json.underlyingValue - entryUnd) * delta * (t.side === "CALL" ? 1 : -1);
          const newPremium = Math.max(1, Math.round(t.entryPremium + premiumChange));
          return { ...t, currentPremium: newPremium, pnl: (newPremium - t.entryPremium) * t.qty * t.lotSize };
        });
        return processAutoExits(updated);
      });
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!marketOpen) return;
    fetchQuote(activeSegment);
    const interval = setInterval(() => fetchQuote(activeSegment), 30000);
    return () => clearInterval(interval);
  }, [activeSegment, fetchQuote, marketOpen]);

  useEffect(() => {
    if (!marketOpen) return;
    const openSegs = [...new Set(trades.filter((t) => t.status === "OPEN").map((t) => t.segment))];
    openSegs.forEach((s) => { if (s !== activeSegment) fetchQuote(s); });
  }, [trades, activeSegment, fetchQuote, marketOpen]);

  const q = quotes[activeSegment];

  function executeTrade() {
    if (!marketOpen) return;
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
      expiry: q.expiry ?? "", entryPremium: premium, entryUnderlying: q.ltp,
      currentPremium: premium, qty, lotSize, invested,
      slPremium: q.optionTargets.premiumSL, t1Premium: q.optionTargets.premiumT1,
      t2Premium: q.optionTargets.premiumT2, t3Premium: q.optionTargets.premiumT3,
      trailSLPremium: q.optionTargets.premiumTrailSL, activeSL: q.optionTargets.premiumSL,
      status: "OPEN", t1Reached: false, t2Reached: false,
      pnl: 0, createdAt: new Date().toISOString(),
    };
    const next = [trade, ...trades];
    setTrades(next); saveTrades(next);
    addLog(`OPENED: ${seg.label} ${q.optionStrike} ${q.optionSide} @ ₹${premium}`);
  }

  function manualClose(id: string) {
    const updated = trades.map((t) => {
      if (t.id !== id) return t;
      const pnl = (t.currentPremium - t.entryPremium) * t.qty * t.lotSize;
      return { ...t, status: "CLOSED" as const, pnl, exitPremium: t.currentPremium, closedAt: new Date().toISOString(), exitReason: "Manual close" };
    });
    setTrades(updated); saveTrades(updated);
  }

  function resetAll() { setTrades([]); saveTrades([]); setAutoExitLog([]); }
  function toggleAutoExecute() { const next = { ...settings, autoExecute: !settings.autoExecute }; setSettings(next); saveSettings(next); }

  return (
    <>
      <AppHeader onMobileMenuOpen={() => {}}>
        <SegmentSelector
          segments={SEGMENTS.map((s) => ({ id: s.id, label: `${s.label} (${s.lotSize})` }))}
          active={activeSegment}
          onChange={(id) => setActiveSegment(id as SegmentId)}
        />
        <div className="flex-1" />
        {q && (
          <Badge variant={q.bias === "BULLISH" ? "default" : q.bias === "BEARISH" ? "destructive" : "secondary"} className="gap-1.5">
            <Activity className="size-3" />
            {q.segment} @ {q.ltp?.toFixed(2)} · {q.bias}
          </Badge>
        )}
      </AppHeader>

      <main className="p-4 lg:p-6 space-y-5">
        <Tabs defaultValue="trading">
          <TabsList>
            <TabsTrigger value="trading">
              <ShoppingCart className="size-3.5 mr-1.5" /> Trading
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="size-3.5 mr-1.5" /> History
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="size-3.5 mr-1.5" /> Analytics
            </TabsTrigger>
          </TabsList>

          {/* ────── Trading Tab ────── */}
          <TabsContent value="trading" className="space-y-5">
            {/* Capital Strip */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
              <StatCard label="Starting Capital" value={`₹${DEFAULT_CAPITAL.toLocaleString()}`} icon={Wallet} />
              <StatCard label="Available" value={`₹${Math.round(available).toLocaleString()}`} trend={available > 0 ? "up" : "down"} icon={Wallet} />
              <StatCard label="Invested" value={`₹${Math.round(totalInvested).toLocaleString()}`} />
              <StatCard label="Unrealized P&L" value={`${unrealizedPnl >= 0 ? "+" : ""}₹${Math.round(unrealizedPnl).toLocaleString()}`} trend={unrealizedPnl >= 0 ? "up" : "down"} />
              <StatCard label="Realized P&L" value={`${realizedPnl >= 0 ? "+" : ""}₹${Math.round(realizedPnl).toLocaleString()}`} trend={realizedPnl >= 0 ? "up" : "down"} />
            </div>

            {/* Execute Trade */}
            {!marketOpen && (
              <Card className="border-amber-500/20 bg-amber-500/5">
                <CardContent className="p-4 flex items-center gap-3">
                  <Clock className="size-5 text-amber-400 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-amber-300 font-medium">Market Closed — Trading Disabled</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{getMarketStatusMessage()}</p>
                  </div>
                </CardContent>
              </Card>
            )}
            {marketOpen && q && (
              <Card className="glow-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingCart className="size-4 text-emerald-400" />
                      Execute Trade
                    </CardTitle>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={settings.autoExecute} onChange={toggleAutoExecute}
                        className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 accent-emerald-500" />
                      <span className="text-xs text-zinc-400">Auto-execute signals</span>
                    </label>
                  </div>
                </CardHeader>
                <CardContent>
                  {q.optionStrike && q.optionPremium && q.optionSide !== "BALANCED" ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                        <div className="rounded-lg bg-zinc-800/50 p-3">
                          <p className="text-[10px] text-zinc-500 uppercase">Option</p>
                          <p className={`text-lg font-bold ${q.optionSide === "CALL" ? "text-emerald-400" : "text-red-400"}`}>
                            {q.optionStrike} {q.optionSide}
                          </p>
                        </div>
                        <div className="rounded-lg bg-zinc-800/50 p-3">
                          <p className="text-[10px] text-zinc-500 uppercase">Premium</p>
                          <p className="text-lg font-bold">₹{q.optionPremium}</p>
                        </div>
                        <div className="rounded-lg bg-zinc-800/50 p-3">
                          <p className="text-[10px] text-zinc-500 uppercase">Lot Size</p>
                          <p className="text-lg font-bold">{getSegment(activeSegment).lotSize}</p>
                        </div>
                        <div className="rounded-lg bg-zinc-800/50 p-3">
                          <p className="text-[10px] text-zinc-500 uppercase mb-1">Lots</p>
                          <div className="flex items-center gap-1.5">
                            <Button variant="outline" size="icon" className="size-7" onClick={() => setLotQty(Math.max(1, lotQty - 1))}>
                              <Minus className="size-3" />
                            </Button>
                            <span className="text-lg font-bold w-6 text-center">{lotQty}</span>
                            <Button variant="outline" size="icon" className="size-7" onClick={() => setLotQty(Math.min(10, lotQty + 1))}>
                              <Plus className="size-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="rounded-lg bg-zinc-800/50 p-3">
                          <p className="text-[10px] text-zinc-500 uppercase">Expiry</p>
                          <p className="text-sm font-medium mt-1">{q.expiry || "—"}</p>
                        </div>
                        {q.optionTargets && (
                          <>
                            <div className="rounded-lg bg-zinc-800/50 p-3">
                              <p className="text-[10px] text-zinc-500 uppercase">SL</p>
                              <p className="text-lg font-bold text-red-400">₹{q.optionTargets.premiumSL}</p>
                            </div>
                            <div className="rounded-lg bg-zinc-800/50 p-3">
                              <p className="text-[10px] text-zinc-500 uppercase">T1/T2/T3</p>
                              <p className="text-sm font-bold text-emerald-400 mt-1">
                                ₹{q.optionTargets.premiumT1}/₹{q.optionTargets.premiumT2}/₹{q.optionTargets.premiumT3}
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <Button
                          onClick={executeTrade}
                          disabled={available < (q.optionPremium ?? 0) * getSegment(activeSegment).lotSize}
                          size="lg"
                          className="font-semibold"
                        >
                          Buy {q.optionStrike} {q.optionSide}
                        </Button>
                        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                          Auto SL/T1/T2/T3/Trail on every refresh (30s)
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 py-4 text-zinc-500">
                      <AlertTriangle className="size-4" />
                      <p className="text-sm">Waiting for directional signal... Market is {q.bias}.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Open Positions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Open Positions
                  {openTrades.length > 0 && (
                    <Badge variant="secondary">{openTrades.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {openTrades.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500">
                    <ShoppingCart className="size-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No open positions</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-zinc-800 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Option</TableHead>
                          <TableHead>Entry</TableHead>
                          <TableHead>LTP</TableHead>
                          <TableHead>Active SL</TableHead>
                          <TableHead>Targets</TableHead>
                          <TableHead>Qty</TableHead>
                          <TableHead>P&L</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {openTrades.map((t) => {
                          const pnlPct = t.invested > 0 ? ((t.pnl / t.invested) * 100).toFixed(1) : "0";
                          return (
                            <TableRow key={t.id}>
                              <TableCell>
                                <div className={`font-semibold ${t.side === "CALL" ? "text-emerald-400" : "text-red-400"}`}>
                                  {t.segmentLabel} {t.strike} {t.side}
                                </div>
                                <div className="text-xs text-zinc-500">{t.expiry}</div>
                                <div className="flex gap-1 mt-0.5">
                                  {t.t1Reached && <Badge variant="default" className="text-[10px] px-1 py-0">T1</Badge>}
                                  {t.t2Reached && <Badge variant="default" className="text-[10px] px-1 py-0">T2</Badge>}
                                </div>
                              </TableCell>
                              <TableCell className="tabular-nums">₹{t.entryPremium}</TableCell>
                              <TableCell className={`font-semibold tabular-nums ${t.currentPremium >= t.entryPremium ? "text-emerald-400" : "text-red-400"}`}>
                                ₹{t.currentPremium}
                              </TableCell>
                              <TableCell>
                                <span className={`font-semibold tabular-nums ${t.activeSL > t.slPremium ? "text-amber-400" : "text-red-400"}`}>
                                  ₹{t.activeSL}
                                </span>
                                {t.activeSL > t.slPremium && (
                                  <Badge variant="warning" className="text-[10px] ml-1">Trail</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-xs tabular-nums">
                                <span className={t.t1Reached ? "text-zinc-600 line-through" : "text-emerald-400"}>₹{t.t1Premium}</span>
                                {" / "}
                                <span className={t.t2Reached ? "text-zinc-600 line-through" : "text-emerald-400"}>₹{t.t2Premium}</span>
                                {" / "}
                                <span className="text-emerald-400">₹{t.t3Premium}</span>
                              </TableCell>
                              <TableCell className="text-sm">{t.qty}×{t.lotSize}</TableCell>
                              <TableCell>
                                <span className={`font-bold tabular-nums ${t.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                  {t.pnl >= 0 ? "+" : ""}₹{Math.round(t.pnl).toLocaleString()}
                                </span>
                                <span className="text-xs text-zinc-500 block">({pnlPct}%)</span>
                              </TableCell>
                              <TableCell>
                                <Button variant="outline" size="sm" onClick={() => manualClose(t.id)}>Exit</Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Auto-Exit Log */}
            {autoExitLog.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="size-4 text-amber-400" />
                    Auto-Exit Log
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-32 overflow-y-auto space-y-0.5 rounded-lg bg-zinc-800/30 p-3">
                    {autoExitLog.map((log, i) => (
                      <p key={i} className="text-xs text-zinc-400 font-mono leading-relaxed">{log}</p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={resetAll} className="text-zinc-500 hover:text-red-400">
                Reset All Trades
              </Button>
            </div>
          </TabsContent>

          {/* ────── History Tab ────── */}
          <TabsContent value="history">
            {closedTrades.length === 0 ? (
              <div className="text-center py-16 text-zinc-500">
                <History className="size-10 mx-auto mb-3 opacity-20" />
                <p>No closed trades yet</p>
              </div>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Trade History <Badge variant="secondary">{closedTrades.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-zinc-800 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Option</TableHead>
                          <TableHead>Entry</TableHead>
                          <TableHead>Exit</TableHead>
                          <TableHead>Invested</TableHead>
                          <TableHead>P&L</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {closedTrades.map((t) => (
                          <TableRow key={t.id}>
                            <TableCell className="font-medium">
                              {t.segmentLabel} {t.strike} {t.side}
                            </TableCell>
                            <TableCell className="tabular-nums">₹{t.entryPremium}</TableCell>
                            <TableCell className="tabular-nums">₹{t.exitPremium ?? t.currentPremium}</TableCell>
                            <TableCell className="tabular-nums">₹{t.invested.toLocaleString()}</TableCell>
                            <TableCell>
                              <span className={`font-bold tabular-nums ${t.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {t.pnl >= 0 ? "+" : ""}₹{Math.round(t.pnl).toLocaleString()}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant={
                                t.status === "SL_HIT" || t.status === "TRAIL_SL" ? "destructive" :
                                t.status.startsWith("T") ? "default" : "secondary"
                              }>
                                {t.exitReason ?? t.status.replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-zinc-500">
                              {new Date(t.closedAt ?? t.createdAt).toLocaleTimeString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ────── Analytics Tab ────── */}
          <TabsContent value="analytics">
            <AnalyticsDashboard trades={trades} />
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}

// ─── Analytics ──────────────────────────────────────

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
      const prev = map.get(t.segmentLabel) ?? { count: 0, pnl: 0, wins: 0 };
      map.set(t.segmentLabel, { count: prev.count + 1, pnl: prev.pnl + t.pnl, wins: prev.wins + (t.pnl > 0 ? 1 : 0) });
    }
    return Array.from(map.entries()).map(([seg, v]) => ({ seg, ...v, winRate: v.count > 0 ? Math.round((v.wins / v.count) * 100) : 0 }));
  }, [closed]);

  const maxBar = dailyPnl.length > 0 ? Math.max(...dailyPnl.map((d) => Math.abs(d.pnl)), 1) : 1;
  const maxCum = dailyPnl.length > 0 ? Math.max(...dailyPnl.map((d) => Math.abs(d.cumulative)), 1) : 1;

  if (trades.length === 0) {
    return (
      <div className="text-center py-20 text-zinc-500">
        <BarChart3 className="size-12 mx-auto mb-3 opacity-20" />
        <p className="text-lg font-medium">No trades yet</p>
        <p className="text-sm mt-1">Execute some trades to see analytics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total P&L", value: `${totalPnl >= 0 ? "+" : ""}₹${Math.abs(Math.round(totalPnl)).toLocaleString()}`, sub: `${returnPct}% return`, trend: totalPnl >= 0 ? "up" as const : "down" as const },
          { label: "Win Rate", value: `${winRate}%`, sub: `${wins.length}W / ${losses.length}L`, trend: "neutral" as const },
          { label: "Profit Factor", value: profitFactor === Infinity ? "∞" : profitFactor.toFixed(2), sub: "Avg Win / Avg Loss", trend: "neutral" as const },
          { label: "Open P&L", value: `${open.reduce((s, t) => s + t.pnl, 0) >= 0 ? "+" : ""}₹${Math.abs(Math.round(open.reduce((s, t) => s + t.pnl, 0))).toLocaleString()}`, sub: `${open.length} positions`, trend: open.reduce((s, t) => s + t.pnl, 0) >= 0 ? "up" as const : "down" as const },
        ].map((k) => (
          <StatCard key={k.label} label={k.label} value={k.value} subValue={k.sub} trend={k.trend} />
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Best Trade" value={`+₹${Math.round(maxWin).toLocaleString()}`} trend="up" />
        <StatCard label="Worst Trade" value={`-₹${Math.abs(Math.round(maxLoss)).toLocaleString()}`} trend="down" />
        <StatCard label="Avg Win/Loss" value={`₹${avgWin} / ₹${Math.abs(avgLoss)}`} />
      </div>

      {/* Charts */}
      {dailyPnl.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Daily P&L</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-40">
              {dailyPnl.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                  <div className="absolute -top-7 hidden group-hover:block rounded-lg bg-zinc-800 border border-zinc-700 px-2 py-1 text-xs whitespace-nowrap z-10 shadow-lg">
                    {d.date}: {d.pnl >= 0 ? "+" : ""}₹{d.pnl.toLocaleString()}
                  </div>
                  <div
                    className={`w-full rounded-t transition-all ${d.pnl >= 0 ? "bg-emerald-500/80" : "bg-red-500/80"}`}
                    style={{ height: `${Math.max(4, (Math.abs(d.pnl) / maxBar) * 100)}%`, minHeight: 4 }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-zinc-600">
              <span>{dailyPnl[0]?.date}</span>
              <span>{dailyPnl[dailyPnl.length - 1]?.date}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {dailyPnl.length > 1 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Cumulative P&L</CardTitle></CardHeader>
          <CardContent>
            <div className="relative h-40">
              <svg viewBox={`0 0 ${dailyPnl.length * 20} 160`} className="w-full h-full" preserveAspectRatio="none">
                <line x1="0" y1="80" x2={dailyPnl.length * 20} y2="80" stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
                <polyline fill="none" stroke="#10b981" strokeWidth="2" points={dailyPnl.map((d, i) => `${i * 20 + 10},${80 - (d.cumulative / maxCum) * 70}`).join(" ")} />
                <polygon fill="rgba(16,185,129,0.08)" points={`10,80 ${dailyPnl.map((d, i) => `${i * 20 + 10},${80 - (d.cumulative / maxCum) * 70}`).join(" ")} ${(dailyPnl.length - 1) * 20 + 10},80`} />
              </svg>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Breakdown */}
      {segmentBreakdown.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Segment Breakdown</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {segmentBreakdown.map((s) => (
              <div key={s.seg} className="flex items-center gap-4">
                <span className="w-20 text-sm font-medium text-zinc-300 shrink-0">{s.seg}</span>
                <div className="flex-1 bg-zinc-800 rounded-full h-3 overflow-hidden">
                  <div className={`h-full rounded-full ${s.pnl >= 0 ? "bg-emerald-500/60" : "bg-red-500/60"}`} style={{ width: `${Math.max(5, s.winRate)}%` }} />
                </div>
                <span className={`text-sm font-bold w-24 text-right tabular-nums ${s.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {s.pnl >= 0 ? "+" : ""}₹{Math.round(s.pnl).toLocaleString()}
                </span>
                <span className="text-xs text-zinc-500 w-16">{s.count} trades</span>
                <span className="text-xs text-zinc-500 w-10">{s.winRate}%</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Exit Distribution + Risk */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Exit Distribution</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {["SL_HIT", "TRAIL_SL", "T1_HIT", "T2_HIT", "T3_HIT", "CLOSED"].map((st) => {
              const count = closed.filter((t) => t.status === st).length;
              if (count === 0) return null;
              const pct = closed.length > 0 ? Math.round((count / closed.length) * 100) : 0;
              return (
                <div key={st} className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400 w-16 shrink-0">{st.replace(/_/g, " ")}</span>
                  <div className="flex-1 bg-zinc-800 rounded-full h-2.5 overflow-hidden">
                    <div className={`h-full rounded-full ${st.includes("SL") ? "bg-red-500/60" : st.startsWith("T") ? "bg-emerald-500/60" : "bg-zinc-500/60"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-zinc-500 w-14 text-right">{count} ({pct}%)</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Risk Metrics</CardTitle></CardHeader>
          <CardContent>
            {[
              { label: "Max Consecutive Wins", value: String(maxConsecutive(closed, true)) },
              { label: "Max Consecutive Losses", value: String(maxConsecutive(closed, false)) },
              { label: "Largest Win Streak", value: `₹${Math.round(largestStreakPnl(closed, true)).toLocaleString()}` },
              { label: "Largest Loss Streak", value: `-₹${Math.abs(Math.round(largestStreakPnl(closed, false))).toLocaleString()}` },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center py-2 border-b border-zinc-800/50 last:border-0">
                <span className="text-xs text-zinc-500">{label}</span>
                <span className="text-sm font-bold text-zinc-200 tabular-nums">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
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
