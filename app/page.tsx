"use client";

import { useEffect, useState, useCallback } from "react";
import { SEGMENTS, type SegmentId } from "@/lib/segments";

interface TargetsStops {
  entry: number;
  stopLoss: number;
  t1: number;
  t2: number;
  t3: number;
  trailingStop: number;
  slPoints: number;
  rr1: number;
  rr2: number;
  rr3: number;
}

interface OptionsAdvisor {
  strike: number;
  side: string;
  premium: number;
  delta: number;
  mode: string;
  daysToExpiry: number;
}

interface SRLevels {
  pdh: number;
  pdl: number;
  pdc: number;
  pivot: number;
  cprTC: number;
  cprBC: number;
  r1: number;
  r2: number;
  s1: number;
  s2: number;
  camH3: number;
  camL3: number;
}

interface Sentiment {
  score: number;
  side: string;
  optionsBias: string;
}

interface Signal {
  bias: string;
  biasStrength?: string;
  entry?: number;
  stopLoss?: number;
  target?: number;
  t1?: number;
  t2?: number;
  t3?: number;
  trailingStop?: number;
  confidence: number;
  pcr: { value: number; bias: string; callOI: number; putOI: number };
  maxPain: number;
  summary: string;
  targets?: TargetsStops;
  bullishTargets?: TargetsStops;
  bearishTargets?: TargetsStops;
  optionsAdvisor?: OptionsAdvisor;
  srLevels?: SRLevels;
  sentiment?: Sentiment;
}

interface OITableRow {
  strike: number;
  ceOI: number;
  peOI: number;
  ceIV?: number;
  peIV?: number;
  ceDelta?: number;
  peDelta?: number;
}

interface OIBuildupItem {
  symbol: string;
  oiChange: number;
  priceChange: number;
}

interface MarketData {
  todayOpen: number;
  todayHigh: number;
  todayLow: number;
  prevClose: number;
  tradeVolume: number;
  buyQty: number;
  sellQty: number;
}

interface SignalsResponse {
  source?: "angel_one" | "nse" | "demo";
  symbol: string;
  underlyingValue: number;
  signal: Signal;
  rawPCR?: number;
  pcrSymbol?: string;
  maxPain: { strike: number; totalPayout: number }[];
  oiTable?: OITableRow[];
  oiBuildupLong?: OIBuildupItem[];
  oiBuildupShort?: OIBuildupItem[];
  marketData?: MarketData;
  timestamp: string;
}

export type TradeStatus =
  | "OPEN"
  | "T1_HIT"
  | "T2_HIT"
  | "T3_HIT"
  | "SL_HIT"
  | "TRAILING_SL_HIT"
  | "CANCELLED";

export interface SuggestedTrade {
  id: string;
  symbol: string;
  segmentLabel: string;
  bias: string;
  entry: number;
  stopLoss: number;
  t1: number;
  t2: number;
  t3: number;
  trailingStop: number;
  status: TradeStatus;
  createdAt: string;
}

const TRADES_STORAGE_KEY = "intraday_suggested_trades";

function loadTrades(): SuggestedTrade[] {
  if (typeof window === "undefined") return [];
  try {
    const s = localStorage.getItem(TRADES_STORAGE_KEY);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
}

function saveTrades(trades: SuggestedTrade[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TRADES_STORAGE_KEY, JSON.stringify(trades));
  } catch {}
}

export default function Home() {
  const [segment, setSegment] = useState<SegmentId>("NIFTY");
  const [data, setData] = useState<SignalsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trades, setTrades] = useState<SuggestedTrade[]>([]);

  const fetchSignals = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`/api/signals?symbol=${segment}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.details || err.error || `HTTP ${res.status}`);
      }
      const json: SignalsResponse = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [segment]);

  useEffect(() => {
    setTrades(loadTrades());
  }, []);

  useEffect(() => {
    fetchSignals();
    const interval = setInterval(fetchSignals, 30000);
    return () => clearInterval(interval);
  }, [fetchSignals]);

  const sig = data?.signal;
  const isIndex = data?.source === "angel_one" && data?.marketData?.tradeVolume === 0;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <nav className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex gap-6">
            <a href="/" className="font-semibold text-emerald-400">Dashboard</a>
            <a href="/login" className="text-zinc-400 hover:text-zinc-200">Angel One Login</a>
          </div>
          <LogoutButton />
        </div>
      </nav>

      <main className="p-6">
        <header className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-emerald-400">Intraday Trading Platform</h1>
              <p className="text-zinc-500 text-sm mt-1">
                OI analytics • Polling every 30s
                {data?.source && (
                  <span className="ml-2 text-emerald-600/80">
                    • {data.source === "angel_one" ? "Angel One" : data.source === "nse" ? "NSE" : "Demo"}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-zinc-500 text-sm">Segment</label>
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value as SegmentId)}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {SEGMENTS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {error && !data && (
          <div className="mb-6 rounded-lg bg-red-950/50 border border-red-800 p-4 text-red-300">
            <strong>Data Error:</strong> {error}
            <span className="text-zinc-500 text-sm block mt-1">
              Login at /login during market hours (9:15 AM - 3:30 PM IST) for Angel One data.
            </span>
            <button onClick={() => { setLoading(true); fetchSignals(); }} className="mt-2 text-sm underline">Retry</button>
          </div>
        )}

        <div className="space-y-6">
          {/* Top Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card
              title="Underlying (LTP)"
              value={data ? data.underlyingValue.toFixed(2) : (loading ? "..." : "—")}
              sub={data?.source === "angel_one" ? "Live" : data?.source === "nse" ? "NSE" : "Demo"}
            />
            <Card
              title="PCR"
              value={data ? (data.rawPCR ?? data.signal.pcr.value).toFixed(2) : (loading ? "..." : "—")}
              sub={data?.pcrSymbol || data?.signal.pcr.bias}
            />
            <Card
              title="Max Pain"
              value={data ? String(data.signal.maxPain) : (loading ? "..." : "—")}
            />
            <Card
              title="Bias"
              value={data ? `${data.signal.bias}${sig?.biasStrength && sig.biasStrength !== "NEUTRAL" ? ` (${sig.biasStrength})` : ""}` : (loading ? "..." : "—")}
              highlight={data?.signal.bias}
            />
          </div>

          {/* Market Data */}
          {data?.marketData && (
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <Card title="Open" value={data.marketData.todayOpen.toFixed(2)} />
              <Card title="High" value={data.marketData.todayHigh.toFixed(2)} />
              <Card title="Low" value={data.marketData.todayLow.toFixed(2)} />
              <Card title="Prev Close" value={data.marketData.prevClose.toFixed(2)} />
              <Card title="Volume" value={isIndex ? "N/A (Index)" : formatNum(data.marketData.tradeVolume)} />
              <Card
                title="Buy / Sell Qty"
                value={isIndex ? "N/A (Index)" : `${formatNum(data.marketData.buyQty)} / ${formatNum(data.marketData.sellQty)}`}
              />
            </div>
          )}

          {/* Signal Section */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-emerald-400 mb-2">Signal</h2>
                <p className="text-zinc-300">
                  {data ? data.signal.summary : (loading ? "Loading..." : "No data — login during market hours or retry.")}
                </p>
                {sig && (
                  <div className="mt-3 flex flex-wrap gap-4 text-sm">
                    {sig.entry != null && (
                      <span>Entry: <strong>{sig.entry.toFixed(2)}</strong></span>
                    )}
                    {sig.bias !== "NEUTRAL" && sig.stopLoss != null && (
                      <span>SL: <strong className="text-red-400">{sig.stopLoss}</strong></span>
                    )}
                    {sig.bias !== "NEUTRAL" && sig.target != null && (
                      <span>T3: <strong className="text-emerald-400">{sig.target}</strong></span>
                    )}
                    <span>Confidence: <strong>{sig.confidence}%</strong></span>
                  </div>
                )}
              </div>
              {sig?.targets && sig.bias !== "NEUTRAL" && (
                <button
                  type="button"
                  onClick={() => {
                    if (!data) return;
                    const seg = SEGMENTS.find((s) => s.id === data.symbol) ?? SEGMENTS[0];
                    const t: SuggestedTrade = {
                      id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                      symbol: data.symbol,
                      segmentLabel: seg.label,
                      bias: sig.bias,
                      entry: sig.targets!.entry,
                      stopLoss: sig.targets!.stopLoss,
                      t1: sig.targets!.t1,
                      t2: sig.targets!.t2,
                      t3: sig.targets!.t3,
                      trailingStop: sig.targets!.trailingStop,
                      status: "OPEN",
                      createdAt: new Date().toISOString(),
                    };
                    const next = [t, ...trades];
                    setTrades(next);
                    saveTrades(next);
                  }}
                  className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  Add to Trades
                </button>
              )}
            </div>
          </div>

          {/* Suggested Trades */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <h2 className="text-lg font-semibold text-emerald-400 mb-3">Suggested Trades</h2>
            {trades.length === 0 ? (
              <p className="text-zinc-500 text-sm">No trades yet. Add a signal above when bias is BULLISH or BEARISH.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-zinc-500 border-b border-zinc-700">
                      <th className="py-2 px-2">Segment</th>
                      <th className="py-2 px-2">Bias</th>
                      <th className="py-2 px-2">Entry</th>
                      <th className="py-2 px-2">SL</th>
                      <th className="py-2 px-2">T1</th>
                      <th className="py-2 px-2">T2</th>
                      <th className="py-2 px-2">T3</th>
                      <th className="py-2 px-2">Trail SL</th>
                      <th className="py-2 px-2">Status</th>
                      <th className="py-2 px-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((t) => (
                      <tr key={t.id} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                        <td className="py-2 px-2 font-medium">{t.segmentLabel}</td>
                        <td className={`py-2 px-2 font-medium ${t.bias === "BULLISH" ? "text-emerald-400" : t.bias === "BEARISH" ? "text-red-400" : ""}`}>{t.bias}</td>
                        <td className="py-2 px-2">{t.entry}</td>
                        <td className="py-2 px-2 text-red-400">{t.stopLoss}</td>
                        <td className="py-2 px-2 text-emerald-400">{t.t1}</td>
                        <td className="py-2 px-2 text-emerald-400">{t.t2}</td>
                        <td className="py-2 px-2 text-emerald-400">{t.t3}</td>
                        <td className="py-2 px-2 text-amber-400">{t.trailingStop}</td>
                        <td className="py-2 px-2">
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                            t.status === "OPEN" ? "bg-emerald-900/50 text-emerald-400" :
                            t.status === "T3_HIT" ? "bg-emerald-900/50 text-emerald-400" :
                            t.status === "SL_HIT" || t.status === "TRAILING_SL_HIT" ? "bg-red-900/50 text-red-400" :
                            t.status === "T1_HIT" || t.status === "T2_HIT" ? "bg-amber-900/50 text-amber-400" :
                            "bg-zinc-700 text-zinc-400"
                          }`}>{t.status.replace(/_/g, " ")}</span>
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-2">
                            <select
                              value={t.status}
                              onChange={(e) => {
                                const s = e.target.value as TradeStatus;
                                const next = trades.map((x) => x.id === t.id ? { ...x, status: s } : x);
                                setTrades(next);
                                saveTrades(next);
                              }}
                              className="rounded border border-zinc-600 bg-zinc-800 px-2 py-1 text-xs"
                            >
                              <option value="OPEN">OPEN</option>
                              <option value="T1_HIT">T1 HIT</option>
                              <option value="T2_HIT">T2 HIT</option>
                              <option value="T3_HIT">T3 HIT</option>
                              <option value="SL_HIT">SL HIT</option>
                              <option value="TRAILING_SL_HIT">Trail SL HIT</option>
                              <option value="CANCELLED">CANCELLED</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                const next = trades.filter((x) => x.id !== t.id);
                                setTrades(next);
                                saveTrades(next);
                              }}
                              className="rounded bg-red-900/50 px-2 py-0.5 text-xs text-red-400 hover:bg-red-900/70"
                            >Remove</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Targets & Stops — show both sides when NEUTRAL */}
          {sig && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h2 className="text-lg font-semibold text-emerald-400 mb-3">Targets &amp; Stops</h2>
              {sig.bias !== "NEUTRAL" && sig.targets ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <LevelCard label="Entry" value={sig.targets.entry} />
                    <LevelCard label="Stop Loss" value={sig.targets.stopLoss} variant="danger" />
                    <LevelCard label="Trailing Stop" value={sig.targets.trailingStop} variant="warning" />
                    <LevelCard label="Target 1 (1.36R)" value={sig.targets.t1} variant="success" />
                    <LevelCard label="Target 2 (2.73R)" value={sig.targets.t2} variant="success" />
                    <LevelCard label="Target 3 (4.55R)" value={sig.targets.t3} variant="success" />
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">
                    SL points: {sig.targets.slPoints.toFixed(0)} • R:R T1={sig.targets.rr1} T2={sig.targets.rr2} T3={sig.targets.rr3}
                  </p>
                </>
              ) : (
                <div className="space-y-4">
                  <p className="text-zinc-400 text-sm">Market is sideways. Showing both-side scenarios:</p>
                  {sig.bullishTargets && (
                    <div>
                      <h3 className="text-sm font-medium text-emerald-400/80 mb-2">If Bullish (Buy CE)</h3>
                      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                        <LevelCard label="Entry" value={sig.bullishTargets.entry} />
                        <LevelCard label="SL" value={sig.bullishTargets.stopLoss} variant="danger" />
                        <LevelCard label="T1" value={sig.bullishTargets.t1} variant="success" />
                        <LevelCard label="T2" value={sig.bullishTargets.t2} variant="success" />
                        <LevelCard label="T3" value={sig.bullishTargets.t3} variant="success" />
                        <LevelCard label="Trail SL" value={sig.bullishTargets.trailingStop} variant="warning" />
                      </div>
                    </div>
                  )}
                  {sig.bearishTargets && (
                    <div>
                      <h3 className="text-sm font-medium text-red-400/80 mb-2">If Bearish (Buy PE)</h3>
                      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                        <LevelCard label="Entry" value={sig.bearishTargets.entry} />
                        <LevelCard label="SL" value={sig.bearishTargets.stopLoss} variant="danger" />
                        <LevelCard label="T1" value={sig.bearishTargets.t1} variant="success" />
                        <LevelCard label="T2" value={sig.bearishTargets.t2} variant="success" />
                        <LevelCard label="T3" value={sig.bearishTargets.t3} variant="success" />
                        <LevelCard label="Trail SL" value={sig.bearishTargets.trailingStop} variant="warning" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Options Advisor */}
          {sig?.optionsAdvisor && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h2 className="text-lg font-semibold text-emerald-400 mb-3">Options Advisor</h2>
              <div className="flex flex-wrap gap-4">
                <span className="rounded bg-zinc-800 px-3 py-2">
                  <span className="text-zinc-500 text-xs">Strike</span>
                  <div className="font-bold">{sig.optionsAdvisor.strike}</div>
                </span>
                <span className="rounded bg-zinc-800 px-3 py-2">
                  <span className="text-zinc-500 text-xs">Side</span>
                  <div className={`font-bold ${sig.optionsAdvisor.side === "CALL" ? "text-emerald-400" : sig.optionsAdvisor.side === "PUT" ? "text-red-400" : "text-amber-400"}`}>
                    {sig.optionsAdvisor.side === "BALANCED"
                      ? `${sig.optionsAdvisor.strike} CE / PE`
                      : `${sig.optionsAdvisor.strike} ${sig.optionsAdvisor.side}`}
                  </div>
                </span>
                <span className="rounded bg-zinc-800 px-3 py-2">
                  <span className="text-zinc-500 text-xs">Premium (approx ₹)</span>
                  <div className="font-bold">{sig.optionsAdvisor.premium}</div>
                </span>
                <span className="rounded bg-zinc-800 px-3 py-2">
                  <span className="text-zinc-500 text-xs">Delta</span>
                  <div className="font-bold">{sig.optionsAdvisor.delta !== 0 ? sig.optionsAdvisor.delta.toFixed(4) : "—"}</div>
                </span>
                <span className="rounded bg-zinc-800 px-3 py-2">
                  <span className="text-zinc-500 text-xs">Days to Expiry</span>
                  <div className="font-bold">{sig.optionsAdvisor.daysToExpiry}</div>
                </span>
              </div>
              {sig.bias === "NEUTRAL" && (
                <p className="mt-2 text-xs text-zinc-500">
                  Market is sideways — consider straddle/strangle strategy or wait for directional bias.
                </p>
              )}
            </div>
          )}

          {/* S/R Levels */}
          {sig?.srLevels && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h2 className="text-lg font-semibold text-emerald-400 mb-3">Support / Resistance Levels</h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <LevelCard label="PDH" value={sig.srLevels.pdh} />
                <LevelCard label="PDL" value={sig.srLevels.pdl} />
                <LevelCard label="PDC" value={sig.srLevels.pdc} />
                <LevelCard label="Pivot" value={sig.srLevels.pivot} />
                <LevelCard label="CPR TC" value={sig.srLevels.cprTC} />
                <LevelCard label="CPR BC" value={sig.srLevels.cprBC} />
                <LevelCard label="R1" value={sig.srLevels.r1} variant="success" />
                <LevelCard label="R2" value={sig.srLevels.r2} variant="success" />
                <LevelCard label="S1" value={sig.srLevels.s1} variant="danger" />
                <LevelCard label="S2" value={sig.srLevels.s2} variant="danger" />
                <LevelCard label="Cam H3" value={sig.srLevels.camH3} />
                <LevelCard label="Cam L3" value={sig.srLevels.camL3} />
              </div>
            </div>
          )}

          {/* Sentiment Score */}
          {sig?.sentiment && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h2 className="text-lg font-semibold text-emerald-400 mb-2">Sentiment Score</h2>
              <div className="flex flex-wrap items-center gap-4">
                <span className={`text-2xl font-bold ${
                  sig.sentiment.score >= 20 ? "text-emerald-400" :
                  sig.sentiment.score <= -20 ? "text-red-400" : "text-zinc-400"
                }`}>
                  {sig.sentiment.score > 0 ? "+" : ""}{sig.sentiment.score}
                </span>
                <span className={`rounded px-3 py-1 font-medium ${
                  sig.sentiment.side.includes("BUY") ? "bg-emerald-900/50 text-emerald-400" :
                  sig.sentiment.side.includes("SELL") ? "bg-red-900/50 text-red-400" :
                  "bg-zinc-800 text-zinc-400"
                }`}>
                  {sig.sentiment.side}
                </span>
                <span className="text-zinc-500 text-sm">{sig.sentiment.optionsBias}</span>
              </div>
              <p className="text-xs text-zinc-600 mt-1">Factors: PCR + Price Action + OI Buildup</p>
            </div>
          )}

          {/* OI Buildup */}
          {(data?.oiBuildupLong?.length || data?.oiBuildupShort?.length) ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h2 className="text-lg font-semibold text-emerald-400 mb-3">OI Buildup</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {data.oiBuildupLong?.length ? (
                  <div>
                    <h3 className="text-sm text-emerald-400/80 mb-2">Long Built Up</h3>
                    <ul className="text-sm space-y-1">
                      {data.oiBuildupLong.map((r) => (
                        <li key={r.symbol} className="flex justify-between">
                          <span className="text-zinc-400 truncate max-w-[180px]">{r.symbol}</span>
                          <span className="text-emerald-400">OI {r.oiChange > 0 ? "+" : ""}{r.oiChange.toLocaleString()} ({r.priceChange > 0 ? "+" : ""}{r.priceChange.toFixed(2)}%)</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {data.oiBuildupShort?.length ? (
                  <div>
                    <h3 className="text-sm text-red-400/80 mb-2">Short Built Up</h3>
                    <ul className="text-sm space-y-1">
                      {data.oiBuildupShort.map((r) => (
                        <li key={r.symbol} className="flex justify-between">
                          <span className="text-zinc-400 truncate max-w-[180px]">{r.symbol}</span>
                          <span className="text-red-400">OI {r.oiChange > 0 ? "+" : ""}{r.oiChange.toLocaleString()} ({r.priceChange > 0 ? "+" : ""}{r.priceChange.toFixed(2)}%)</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* OI Table & Strike Heatmap */}
          {data?.oiTable && data.oiTable.length > 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h2 className="text-lg font-semibold text-emerald-400 mb-3">
                Option Chain (Strike-wise)
              </h2>
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-zinc-900">
                    <tr className="text-zinc-500 text-left">
                      <th className="py-2 px-2 text-emerald-400/60">CE Vol</th>
                      <th className="py-2 px-2 text-emerald-400/60">CE IV</th>
                      <th className="py-2 px-2 text-emerald-400/60">CE Delta</th>
                      <th className="py-2 px-2 font-bold text-zinc-300">Strike</th>
                      <th className="py-2 px-2 text-red-400/60">PE Delta</th>
                      <th className="py-2 px-2 text-red-400/60">PE IV</th>
                      <th className="py-2 px-2 text-red-400/60">PE Vol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.oiTable.map((r) => {
                      const isATM = data && Math.abs(r.strike - data.underlyingValue) < (SEGMENTS.find(s => s.id === data.symbol)?.strikeStep ?? 50);
                      return (
                        <tr
                          key={r.strike}
                          className={`border-t border-zinc-800 ${isATM ? "bg-emerald-900/20 font-medium" : ""}`}
                        >
                          <td className="py-1.5 px-2 text-emerald-400/90">{r.ceOI > 0 ? r.ceOI.toLocaleString() : "—"}</td>
                          <td className="py-1.5 px-2 text-zinc-400">{r.ceIV ? `${r.ceIV}%` : "—"}</td>
                          <td className="py-1.5 px-2 text-zinc-400">{r.ceDelta ? r.ceDelta.toFixed(3) : "—"}</td>
                          <td className={`py-1.5 px-2 font-bold ${isATM ? "text-emerald-400" : "text-zinc-200"}`}>{r.strike}</td>
                          <td className="py-1.5 px-2 text-zinc-400">{r.peDelta ? r.peDelta.toFixed(3) : "—"}</td>
                          <td className="py-1.5 px-2 text-zinc-400">{r.peIV ? `${r.peIV}%` : "—"}</td>
                          <td className="py-1.5 px-2 text-red-400/90">{r.peOI > 0 ? r.peOI.toLocaleString() : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                {data.source === "angel_one" ? "Data from Angel One Option Greeks API. Vol = Trade Volume (proxy for activity)." : "OI data from NSE option chain."}
              </p>
            </div>
          ) : data && (data.source === "angel_one" || data.source === "demo") && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h2 className="text-lg font-semibold text-emerald-400 mb-2">Option Chain</h2>
              <p className="text-zinc-500 text-sm">
                Option chain data loading... If empty, Option Greeks API may not have data for current expiry.
              </p>
            </div>
          )}

          {/* Max Pain */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <h2 className="text-lg font-semibold text-emerald-400 mb-2">
              Max Pain {data?.oiTable?.length ? "" : "(approx)"}
            </h2>
            <div className="flex flex-wrap gap-3">
              {data?.maxPain?.length ? (
                data.maxPain.map((mp) => (
                  <span key={mp.strike} className="rounded bg-zinc-800 px-3 py-1 text-sm">
                    {mp.strike}
                    {mp.totalPayout > 0 && <> (₹{(mp.totalPayout / 1e6).toFixed(1)}M)</>}
                  </span>
                ))
              ) : (
                <span className="text-zinc-500 text-sm">—</span>
              )}
            </div>
          </div>

          {data && (
            <p className="text-xs text-zinc-600">Last updated: {new Date(data.timestamp).toLocaleString()}</p>
          )}
        </div>
      </main>
    </div>
  );
}

function LogoutButton() {
  const handleLogout = async () => {
    await fetch("/api/angel-one/logout", { method: "POST" });
    window.location.reload();
  };
  return (
    <button type="button" onClick={handleLogout} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">
      Logout
    </button>
  );
}

function formatNum(n: number): string {
  if (n >= 1_00_00_000) return `${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (n >= 1_00_000) return `${(n / 1_00_000).toFixed(2)} L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)} K`;
  return String(n);
}

function LevelCard({ label, value, variant }: { label: string; value: number; variant?: "success" | "danger" | "warning" }) {
  const cls =
    variant === "success" ? "text-emerald-400" :
    variant === "danger" ? "text-red-400" :
    variant === "warning" ? "text-amber-400" : "";
  return (
    <div className="rounded bg-zinc-800 px-3 py-2">
      <div className="text-zinc-500 text-xs">{label}</div>
      <div className={`font-bold ${cls}`}>{value.toFixed(0)}</div>
    </div>
  );
}

function Card({ title, value, sub, highlight }: { title: string; value: string; sub?: string; highlight?: string }) {
  const isBull = highlight === "BULLISH";
  const isBear = highlight === "BEARISH";
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wide">{title}</div>
      <div className={`text-xl font-bold mt-1 ${isBull ? "text-emerald-400" : isBear ? "text-red-400" : ""}`}>{value}</div>
      {sub && <div className="text-sm text-zinc-500 mt-0.5">{sub}</div>}
    </div>
  );
}
