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

interface OptionTargets {
  premiumEntry: number;
  premiumSL: number;
  premiumT1: number;
  premiumT2: number;
  premiumT3: number;
  premiumTrailSL: number;
}

interface OptionsAdvisor {
  strike: number;
  side: string;
  premium: number;
  delta: number;
  mode: string;
  daysToExpiry: number;
  iv: number;
  theta: number;
  moneyness: string;
  recommendation: string;
  optionTargets?: OptionTargets;
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

interface SentimentComp { name: string; score: number; weight: number }
interface Sentiment {
  score: number;
  side: string;
  optionsBias: string;
  momentum: string;
  components: SentimentComp[];
}

interface SignalStrength {
  score: number;
  max: number;
  label: string;
  components: { name: string; ok: boolean }[];
}

interface VolatilityInfo {
  atr: number;
  atrSma: number;
  ratio: number;
  regime: string;
  dynamicStopMult: number;
  dynamicTargetMult: number;
}

interface PartialExitPlan {
  t1Pct: number;
  t2Pct: number;
  t3Pct: number;
  t1Lots: number;
  t2Lots: number;
  t3Lots: number;
  totalLots: number;
}

interface AdvancedFiltersUI {
  rangeFilter: { filt: number; upward: boolean; downward: boolean };
  rqk: { value: number; prevValue: number; uptrend: boolean; downtrend: boolean };
  choppiness: number;
  isChoppy: boolean;
  rfConfirmsBull: boolean;
  rfConfirmsBear: boolean;
  rqkConfirmsBull: boolean;
  rqkConfirmsBear: boolean;
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
  signalStrength?: SignalStrength;
  volatility?: VolatilityInfo;
  partialExits?: PartialExitPlan;
  tradeDirection?: string;
  advancedFilters?: AdvancedFiltersUI;
  signalExpired?: boolean;
  alternateBlocked?: boolean;
  alternateReason?: string;
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

interface TechIndicatorsUI {
  emaFast: number; emaSlow: number; emaTrend: string;
  rsiValue: number; rsiSignal: string;
  macdLine: number; macdSignal: number; macdHist: number; macdBias: string;
  vwap: number; vwapBias: string;
  adxProxy: number; trendStrength: string;
}

interface SignalsResponse {
  source?: "angel_one" | "nse" | "demo";
  symbol: string;
  underlyingValue: number;
  signal: Signal;
  rawPCR?: number;
  pcrSymbol?: string;
  expiry?: string;
  optionSymbol?: string;
  maxPain: { strike: number; totalPayout: number }[];
  oiTable?: OITableRow[];
  oiBuildupLong?: OIBuildupItem[];
  oiBuildupShort?: OIBuildupItem[];
  marketData?: MarketData;
  technicalIndicators?: TechIndicatorsUI;
  timestamp: string;
}

export default function Home() {
  const [segment, setSegment] = useState<SegmentId>("NIFTY");
  const [data, setData] = useState<SignalsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            <a href="/paper-trade" className="text-zinc-400 hover:text-zinc-200">Paper Trade</a>
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
                OI analytics · Polling every 30s
                {data?.source && (
                  <span className="ml-2 text-emerald-600/80">
                    · {data.source === "angel_one" ? "Angel One" : data.source === "nse" ? "NSE" : "Demo"}
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
            <Card
              title="Trade Direction"
              value={sig?.tradeDirection ?? "—"}
              sub={sig?.tradeDirection?.includes("Long") ? "Buy CE" : sig?.tradeDirection?.includes("Short") ? "Buy PE" : "Wait"}
            />
          </div>

          {/* Market Analysis (real technical indicators) */}
          {data?.technicalIndicators && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h2 className="text-sm font-semibold text-sky-400 mb-3">Market Analysis (5-min candles)</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { label: "EMA 21/50", value: `${data.technicalIndicators.emaFast.toFixed(1)} / ${data.technicalIndicators.emaSlow.toFixed(1)}`, status: data.technicalIndicators.emaTrend },
                  { label: "RSI (14)", value: String(data.technicalIndicators.rsiValue), status: data.technicalIndicators.rsiSignal },
                  { label: "MACD Hist", value: data.technicalIndicators.macdHist.toFixed(2), status: data.technicalIndicators.macdBias },
                  { label: "VWAP", value: data.technicalIndicators.vwap.toFixed(2), status: data.technicalIndicators.vwapBias },
                  { label: "ADX Strength", value: data.technicalIndicators.adxProxy.toFixed(1), status: data.technicalIndicators.trendStrength === "STRONG" ? "BULL" : data.technicalIndicators.trendStrength === "WEAK" ? "BEAR" : "NEUTRAL" },
                ].map((ind) => (
                  <div key={ind.label} className="rounded bg-zinc-800/80 px-3 py-2">
                    <div className="text-xs text-zinc-500">{ind.label}</div>
                    <div className="font-bold text-sm mt-0.5">{ind.value}</div>
                    <span className={`text-xs font-medium ${ind.status === "BULL" ? "text-emerald-400" : ind.status === "BEAR" ? "text-red-400" : "text-zinc-400"}`}>
                      {ind.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Signal Strength + Volatility Row */}
          {sig && (<>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Signal Strength */}
              {sig.signalStrength && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                  <h2 className="text-sm font-semibold text-emerald-400 mb-2">Signal Strength</h2>
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`text-3xl font-bold ${
                      sig.signalStrength.score >= 6 ? "text-emerald-400" :
                      sig.signalStrength.score >= 4 ? "text-amber-400" :
                      "text-red-400"
                    }`}>
                      {sig.signalStrength.score}/{sig.signalStrength.max}
                    </span>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                      sig.signalStrength.label === "STRONG" ? "bg-emerald-900/50 text-emerald-400" :
                      sig.signalStrength.label === "MODERATE" ? "bg-amber-900/50 text-amber-400" :
                      "bg-red-900/50 text-red-400"
                    }`}>
                      {sig.signalStrength.label}
                    </span>
                  </div>
                  {/* Strength bar */}
                  <div className="w-full bg-zinc-800 rounded h-2 mb-3">
                    <div
                      className={`h-2 rounded ${
                        sig.signalStrength.score >= 6 ? "bg-emerald-500" :
                        sig.signalStrength.score >= 4 ? "bg-amber-500" :
                        "bg-red-500"
                      }`}
                      style={{ width: `${(sig.signalStrength.score / sig.signalStrength.max) * 100}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    {sig.signalStrength.components.map((c) => (
                      <div key={c.name} className="flex items-center gap-1.5">
                        <span className={c.ok ? "text-emerald-400" : "text-zinc-600"}>{c.ok ? "●" : "○"}</span>
                        <span className={c.ok ? "text-zinc-300" : "text-zinc-600"}>{c.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Volatility Regime */}
              {sig.volatility && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                  <h2 className="text-sm font-semibold text-emerald-400 mb-2">Volatility Regime</h2>
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`text-2xl font-bold ${
                      sig.volatility.regime === "HIGH" ? "text-red-400" :
                      sig.volatility.regime === "LOW" ? "text-blue-400" :
                      "text-amber-400"
                    }`}>
                      {sig.volatility.regime}
                    </span>
                    <span className="text-zinc-500 text-sm">ATR ratio: {sig.volatility.ratio}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded bg-zinc-800 px-3 py-1.5">
                      <span className="text-zinc-500 text-xs">ATR (5d)</span>
                      <div className="font-medium">{sig.volatility.atr.toFixed(1)}</div>
                    </div>
                    <div className="rounded bg-zinc-800 px-3 py-1.5">
                      <span className="text-zinc-500 text-xs">ATR SMA (20d)</span>
                      <div className="font-medium">{sig.volatility.atrSma.toFixed(1)}</div>
                    </div>
                    <div className="rounded bg-zinc-800 px-3 py-1.5">
                      <span className="text-zinc-500 text-xs">Stop Mult</span>
                      <div className="font-medium">{sig.volatility.dynamicStopMult.toFixed(2)}x</div>
                    </div>
                    <div className="rounded bg-zinc-800 px-3 py-1.5">
                      <span className="text-zinc-500 text-xs">Target Mult</span>
                      <div className="font-medium">{sig.volatility.dynamicTargetMult.toFixed(2)}x</div>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-600 mt-2">
                    {sig.volatility.regime === "HIGH"
                      ? "High vol: wider stops (1.3x), tighter targets (0.8x)"
                      : sig.volatility.regime === "LOW"
                      ? "Low vol: tighter stops (0.8x), wider targets (1.2x)"
                      : "Normal vol: standard multipliers"}
                  </p>
                </div>
              )}
            </div>

            {/* Advanced Filters (DIY) */}
            {sig.advancedFilters && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <h2 className="text-sm font-semibold text-violet-400 mb-3">Advanced Filters (DIY)</h2>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Range Filter</div>
                    <div className={`text-sm font-bold ${sig.advancedFilters.rfConfirmsBull ? "text-emerald-400" : sig.advancedFilters.rfConfirmsBear ? "text-red-400" : "text-zinc-500"}`}>
                      {sig.advancedFilters.rfConfirmsBull ? "▲ Bullish" : sig.advancedFilters.rfConfirmsBear ? "▼ Bearish" : "— Flat"}
                    </div>
                    <div className="text-xs text-zinc-600 mt-0.5">Filt: {sig.advancedFilters.rangeFilter.filt.toFixed(1)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">RQK (Kernel)</div>
                    <div className={`text-sm font-bold ${sig.advancedFilters.rqkConfirmsBull ? "text-emerald-400" : sig.advancedFilters.rqkConfirmsBear ? "text-red-400" : "text-zinc-500"}`}>
                      {sig.advancedFilters.rqkConfirmsBull ? "▲ Uptrend" : sig.advancedFilters.rqkConfirmsBear ? "▼ Downtrend" : "— Flat"}
                    </div>
                    <div className="text-xs text-zinc-600 mt-0.5">Val: {sig.advancedFilters.rqk.value.toFixed(1)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500 mb-1">Choppiness</div>
                    <div className={`text-sm font-bold ${sig.advancedFilters.isChoppy ? "text-amber-400" : "text-emerald-400"}`}>
                      {sig.advancedFilters.choppiness}
                    </div>
                    <div className="text-xs text-zinc-600 mt-0.5">{sig.advancedFilters.isChoppy ? "Ranging/Choppy" : "Trending"}</div>
                  </div>
                </div>
                <div className="h-2 rounded bg-zinc-800 mt-3 overflow-hidden">
                  <div className={`h-full rounded ${sig.advancedFilters.choppiness > 61.8 ? "bg-amber-500/70" : "bg-emerald-500/70"}`}
                    style={{ width: `${Math.min(100, sig.advancedFilters.choppiness)}%` }} />
                </div>
                <div className="flex justify-between text-xs text-zinc-600 mt-1"><span>Trending</span><span>61.8</span><span>Choppy</span></div>
                {sig.signalExpired && <p className="text-xs text-amber-400 mt-2">Signal expired — filters did not confirm within 5 cycles</p>}
                {sig.alternateBlocked && <p className="text-xs text-amber-400 mt-2">{sig.alternateReason}</p>}
              </div>
            )}
          </>)}

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
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-lg font-semibold text-emerald-400">Signal</h2>
                {data?.expiry && (
                  <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                    Expiry: {data.expiry}
                  </span>
                )}
              </div>
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
          </div>

          {/* (Trades moved to /paper-trade) */}

          {/* Options Advisor — with Add to Trade */}
          {sig?.optionsAdvisor && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-emerald-400">Options Advisor</h2>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                    sig.optionsAdvisor.side === "CALL" ? "bg-emerald-900/50 text-emerald-400" :
                    sig.optionsAdvisor.side === "PUT" ? "bg-red-900/50 text-red-400" :
                    "bg-zinc-700 text-zinc-400"
                  }`}>
                    {sig.optionsAdvisor.recommendation}
                  </span>
                </div>
                {sig.bias !== "NEUTRAL" && (
                  <a
                    href="/paper-trade"
                    className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                  >
                    Take Paper Trade
                  </a>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded bg-zinc-800 px-3 py-2">
                  <span className="text-zinc-500 text-xs">Strike</span>
                  <div className={`font-bold text-lg ${
                    sig.optionsAdvisor.side === "CALL" ? "text-emerald-400" :
                    sig.optionsAdvisor.side === "PUT" ? "text-red-400" :
                    "text-amber-400"
                  }`}>
                    {sig.optionsAdvisor.strike} {sig.optionsAdvisor.side === "BALANCED" ? "CE/PE" : sig.optionsAdvisor.side}
                  </div>
                  <span className="text-zinc-600 text-xs">{sig.optionsAdvisor.moneyness}</span>
                </div>
                <div className="rounded bg-zinc-800 px-3 py-2">
                  <span className="text-zinc-500 text-xs">
                    Premium {data?.optionSymbol ? "(Live)" : "(est.)"}
                  </span>
                  <div className="font-bold text-lg">₹{sig.optionsAdvisor.premium}</div>
                  <span className="text-zinc-600 text-xs">
                    {data?.optionSymbol || `Mode: ${sig.optionsAdvisor.mode}`}
                  </span>
                </div>
                <div className="rounded bg-zinc-800 px-3 py-2">
                  <span className="text-zinc-500 text-xs">Delta</span>
                  <div className="font-bold text-lg">{sig.optionsAdvisor.delta !== 0 ? sig.optionsAdvisor.delta.toFixed(4) : "—"}</div>
                  <span className="text-zinc-600 text-xs">IV: {sig.optionsAdvisor.iv}%</span>
                </div>
                <div className="rounded bg-zinc-800 px-3 py-2">
                  <span className="text-zinc-500 text-xs">Expiry</span>
                  <div className="font-bold text-lg">
                    {data?.expiry ? data.expiry : `${sig.optionsAdvisor.daysToExpiry}d`}
                  </div>
                  <span className={`text-xs ${
                    sig.optionsAdvisor.daysToExpiry >= 3 ? "text-emerald-500" :
                    sig.optionsAdvisor.daysToExpiry >= 1 ? "text-amber-500" :
                    "text-red-500"
                  }`}>
                    {sig.optionsAdvisor.daysToExpiry}d · Theta: {sig.optionsAdvisor.theta}/day
                  </span>
                </div>
              </div>
              {/* Option Premium Targets */}
              {sig.optionsAdvisor.optionTargets && sig.bias !== "NEUTRAL" && (
                <div className="mt-3 rounded bg-zinc-800/50 p-3">
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Option Premium Targets</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-sm">
                    <div className="text-center">
                      <div className="text-zinc-500 text-xs">Entry</div>
                      <div className="font-bold">₹{sig.optionsAdvisor.optionTargets.premiumEntry}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-zinc-500 text-xs">SL (-40%)</div>
                      <div className="font-bold text-red-400">₹{sig.optionsAdvisor.optionTargets.premiumSL}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-zinc-500 text-xs">T1 (+50%)</div>
                      <div className="font-bold text-emerald-400">₹{sig.optionsAdvisor.optionTargets.premiumT1}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-zinc-500 text-xs">T2 (+100%)</div>
                      <div className="font-bold text-emerald-400">₹{sig.optionsAdvisor.optionTargets.premiumT2}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-zinc-500 text-xs">T3 (+150%)</div>
                      <div className="font-bold text-emerald-400">₹{sig.optionsAdvisor.optionTargets.premiumT3}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-zinc-500 text-xs">Trail SL</div>
                      <div className="font-bold text-amber-400">₹{sig.optionsAdvisor.optionTargets.premiumTrailSL}</div>
                    </div>
                  </div>
                </div>
              )}
              {sig.bias === "NEUTRAL" && (
                <p className="mt-2 text-xs text-zinc-500">
                  Market is sideways — consider straddle/strangle strategy or wait for directional bias.
                </p>
              )}
            </div>
          )}

          {/* Targets & Stops */}
          {sig && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h2 className="text-lg font-semibold text-emerald-400 mb-3">Targets &amp; Stops</h2>
              {sig.bias !== "NEUTRAL" && sig.targets ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <LevelCard label="Entry" value={sig.targets.entry} />
                    <LevelCard label="Stop Loss" value={sig.targets.stopLoss} variant="danger" />
                    <LevelCard label="Trailing Stop" value={sig.targets.trailingStop} variant="warning" />
                    <LevelCard label={`Target 1 (${sig.targets.rr1}R)`} value={sig.targets.t1} variant="success" />
                    <LevelCard label={`Target 2 (${sig.targets.rr2}R)`} value={sig.targets.t2} variant="success" />
                    <LevelCard label={`Target 3 (${sig.targets.rr3}R)`} value={sig.targets.t3} variant="success" />
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">
                    SL points: {sig.targets.slPoints.toFixed(0)} · R:R T1={sig.targets.rr1} T2={sig.targets.rr2} T3={sig.targets.rr3}
                  </p>
                  {/* Partial Exit Plan */}
                  {sig.partialExits && (
                    <div className="mt-3 rounded bg-zinc-800/50 p-3">
                      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">Partial Exit Strategy</h3>
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div className="text-center">
                          <div className="text-emerald-400 font-bold">{sig.partialExits.t1Pct}%</div>
                          <div className="text-xs text-zinc-500">at T1 ({sig.partialExits.t1Lots}L)</div>
                        </div>
                        <div className="text-center">
                          <div className="text-emerald-400 font-bold">{sig.partialExits.t2Pct}%</div>
                          <div className="text-xs text-zinc-500">at T2 ({sig.partialExits.t2Lots}L)</div>
                        </div>
                        <div className="text-center">
                          <div className="text-emerald-400 font-bold">{sig.partialExits.t3Pct}%</div>
                          <div className="text-xs text-zinc-500">at T3 ({sig.partialExits.t3Lots}L)</div>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-600 mt-2 text-center">
                        Total: {sig.partialExits.totalLots} lots · Move SL to breakeven after T1
                      </p>
                    </div>
                  )}
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

          {/* (Options Advisor is above, next to Signal) */}

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

          {/* Sentiment Score — with breakdown */}
          {sig?.sentiment && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h2 className="text-lg font-semibold text-emerald-400 mb-2">Market Sentiment</h2>
              <div className="flex flex-wrap items-center gap-4 mb-3">
                <span className={`text-3xl font-bold ${
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
                <span className="text-zinc-500 text-sm">Momentum: {sig.sentiment.momentum}</span>
              </div>
              {/* Component breakdown */}
              {sig.sentiment.components && sig.sentiment.components.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {sig.sentiment.components.map((c) => (
                    <div key={c.name} className="flex items-center justify-between rounded bg-zinc-800 px-2 py-1.5">
                      <span className="text-zinc-400">{c.name}</span>
                      <span className={`font-medium ${c.score > 0 ? "text-emerald-400" : c.score < 0 ? "text-red-400" : "text-zinc-500"}`}>
                        {c.score > 0 ? "+" : ""}{c.score} ({(c.weight * 100).toFixed(0)}%)
                      </span>
                    </div>
                  ))}
                </div>
              )}
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

          {/* Option Chain */}
          {data?.oiTable && data.oiTable.length > 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <h2 className="text-lg font-semibold text-emerald-400 mb-3">Option Chain (Strike-wise)</h2>
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
                        <tr key={r.strike} className={`border-t border-zinc-800 ${isATM ? "bg-emerald-900/20 font-medium" : ""}`}>
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
    await fetch("/api/angel-one/logout", { method: "POST" }).catch(() => {});
    await fetch("/api/auth", { method: "DELETE" }).catch(() => {});
    window.location.href = "/auth";
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
