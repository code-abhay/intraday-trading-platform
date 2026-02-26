import type { OptionChainRow } from "@/app/api/option-chain/route";
import type { ExpiryDay } from "@/lib/expiry-utils";
import type { SegmentStrategyConfig } from "@/lib/segments";

// ---------- Interfaces ----------

export interface PCRResult {
  value: number;
  bias: "BULLISH" | "BEARISH" | "NEUTRAL";
  callOI: number;
  putOI: number;
}

export interface OIBuildupRow {
  strikePrice: number;
  callOI: number;
  putOI: number;
  callChangeOI: number;
  putChangeOI: number;
  callBuildup: "LONG" | "SHORT_COVER" | "NEUTRAL";
  putBuildup: "LONG" | "SHORT_COVER" | "NEUTRAL";
}

export interface MaxPainResult {
  strike: number;
  totalPayout: number;
}

export type VolRegime = "HIGH" | "NORMAL" | "LOW";
export type StrikeMode = "High Delta" | "ATM" | "OTM Aggressive" | "Balanced";

export interface VolatilityInfo {
  atr: number;
  atrSma: number;
  ratio: number;
  regime: VolRegime;
  dynamicStopMult: number;
  dynamicTargetMult: number;
}

export interface SignalStrength {
  score: number;
  max: number;
  label: string;
  components: { name: string; ok: boolean }[];
}

export interface TargetsStops {
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

export interface PartialExitPlan {
  t1Pct: number;
  t2Pct: number;
  t3Pct: number;
  t1Lots: number;
  t2Lots: number;
  t3Lots: number;
  totalLots: number;
}

export interface OptionTargets {
  premiumEntry: number;
  premiumSL: number;
  premiumT1: number;
  premiumT2: number;
  premiumT3: number;
  premiumTrailSL: number;
}

export interface OptionsAdvisor {
  strike: number;
  side: "CALL" | "PUT" | "BALANCED";
  premium: number;
  delta: number;
  mode: StrikeMode;
  daysToExpiry: number;
  iv: number;
  theta: number;
  moneyness: string;
  recommendation: string;
  optionTargets?: OptionTargets;
}

export interface SRLevels {
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

export interface Sentiment {
  score: number;
  side: string;
  optionsBias: string;
  momentum: string;
  components: { name: string; score: number; weight: number }[];
}

export interface OrbContext {
  high: number;
  low: number;
  breakout: "ABOVE_ORB" | "BELOW_ORB" | "INSIDE_ORB";
  isBreakout: boolean;
}

export interface CprContext {
  widthPct: number;
  type: "NARROW_TREND" | "NORMAL" | "WIDE_RANGE";
  position: "ABOVE_CPR" | "BELOW_CPR" | "INSIDE_CPR";
}

export interface StrategySignal {
  bias: "BULLISH" | "BEARISH" | "NEUTRAL";
  biasStrength: "STRONG" | "MODERATE" | "MILD" | "NEUTRAL";
  entry?: number;
  stopLoss?: number;
  target?: number;
  t1?: number;
  t2?: number;
  t3?: number;
  trailingStop?: number;
  confidence: number;
  pcr: PCRResult;
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
  advancedFilters?: AdvancedFilters;
  orbContext?: OrbContext;
  cprContext?: CprContext;
  signalExpired?: boolean;
  alternateBlocked?: boolean;
  alternateReason?: string;
}

// ---------- NSE Option Chain ----------

export function computePCR(data: OptionChainRow[]): PCRResult {
  let totalCallOI = 0;
  let totalPutOI = 0;
  for (const row of data) {
    if (row.CE) totalCallOI += row.CE.openInterest;
    if (row.PE) totalPutOI += row.PE.openInterest;
  }
  const value = totalCallOI > 0 ? totalPutOI / totalCallOI : 0;
  let bias: PCRResult["bias"] = "NEUTRAL";
  if (value > 1.05) bias = "BULLISH";
  else if (value < 0.95) bias = "BEARISH";
  return { value, bias, callOI: totalCallOI, putOI: totalPutOI };
}

export function computeOIBuildup(data: OptionChainRow[], underlyingValue: number): OIBuildupRow[] {
  return data.map((row) => {
    const callChange = row.CE?.changeinOpenInterest ?? 0;
    const putChange = row.PE?.changeinOpenInterest ?? 0;
    return {
      strikePrice: row.strikePrice,
      callOI: row.CE?.openInterest ?? 0,
      putOI: row.PE?.openInterest ?? 0,
      callChangeOI: callChange,
      putChangeOI: putChange,
      callBuildup: callChange > 0 ? "LONG" : callChange < 0 ? "SHORT_COVER" : "NEUTRAL",
      putBuildup: putChange > 0 ? "LONG" : putChange < 0 ? "SHORT_COVER" : "NEUTRAL",
    };
  });
}

export function computeMaxPain(data: OptionChainRow[], underlyingValue: number): MaxPainResult[] {
  const strikes = [...new Set(data.map((r) => r.strikePrice))].sort((a, b) => a - b);
  const payouts: MaxPainResult[] = strikes.map((strike) => {
    let totalPayout = 0;
    for (const row of data) {
      if (row.strikePrice !== strike) continue;
      const callOI = row.CE?.openInterest ?? 0;
      const putOI = row.PE?.openInterest ?? 0;
      totalPayout += Math.max(0, underlyingValue - strike) * callOI + Math.max(0, strike - underlyingValue) * putOI;
    }
    return { strike, totalPayout };
  });
  return payouts.sort((a, b) => a.totalPayout - b.totalPayout);
}

// ---------- Volatility Regime ----------

const HIGH_VOL_THRESHOLD = 1.5;
const LOW_VOL_THRESHOLD = 0.7;
const DEFAULT_STRATEGY_PROFILE: SegmentStrategyConfig = {
  rsiBullishThreshold: 52,
  rsiBearishThreshold: 48,
  pcrBullishThreshold: 1.2,
  pcrBearishThreshold: 0.8,
  choppinessThreshold: 61.8,
  biasStrongThreshold: 6,
  biasModerateThreshold: 3,
  orbBreakoutBufferPct: 0.0005,
  cprNarrowThresholdPct: 0.2,
  cprWideThresholdPct: 0.6,
};

function withStrategyDefaults(
  profile?: SegmentStrategyConfig | null
): SegmentStrategyConfig {
  return {
    ...DEFAULT_STRATEGY_PROFILE,
    ...(profile ?? {}),
  };
}

export function computeVolatility(atr: number, atrSma: number, baseStopMult = 1.1): VolatilityInfo {
  const ratio = atrSma > 0 ? atr / atrSma : 1;
  let regime: VolRegime = "NORMAL";
  if (ratio > HIGH_VOL_THRESHOLD) regime = "HIGH";
  else if (ratio < LOW_VOL_THRESHOLD) regime = "LOW";
  const dynamicStopMult = regime === "HIGH" ? baseStopMult * 1.3 : regime === "LOW" ? baseStopMult * 0.8 : baseStopMult;
  const dynamicTargetMult = regime === "HIGH" ? 0.8 : regime === "LOW" ? 1.2 : 1.0;
  return { atr, atrSma, ratio: parseFloat(ratio.toFixed(2)), regime, dynamicStopMult, dynamicTargetMult };
}

// ---------- Real Technical Indicators (from candle data, matching Pine Script) ----------

export interface PriceAction {
  ltp: number;
  open: number;
  prevClose: number;
  high: number;
  low: number;
}

/**
 * Real technical indicators computed from 5-min intraday candles.
 * Matches the Pine Script's EMA(21/50), RSI(14), MACD(12,26,9), VWAP, ADX proxy.
 */
export interface TechnicalIndicators {
  emaFast: number;         // EMA 21
  emaSlow: number;         // EMA 50
  emaTrend: "BULL" | "BEAR";
  rsiValue: number;        // RSI 14
  rsiSignal: "BULL" | "BEAR" | "NEUTRAL";
  macdLine: number;
  macdSignal: number;
  macdHist: number;
  macdBias: "BULL" | "BEAR";
  vwap: number;
  vwapBias: "BULL" | "BEAR";
  adxProxy: number;
  trendStrength: "STRONG" | "MODERATE" | "WEAK";
}

function computeEMA(data: number[], period: number): number {
  if (data.length === 0) return 0;
  let ema = data[0];
  const k = 2 / (period + 1);
  for (let i = 1; i < data.length; i++) ema = data[i] * k + ema * (1 - k);
  return ema;
}

function computeRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function computeMACD(closes: number[], fast = 12, slow = 26, signal = 9): { line: number; signal: number; hist: number } {
  if (closes.length < slow + signal) return { line: 0, signal: 0, hist: 0 };
  const emaFast = emaArray(closes, fast);
  const emaSlow = emaArray(closes, slow);
  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) macdLine.push(emaFast[i] - emaSlow[i]);
  const signalLine = emaArray(macdLine, signal);
  const n = closes.length - 1;
  const line = macdLine[n];
  const sig = signalLine[n];
  return { line, signal: sig, hist: line - sig };
}

function computeVWAP(candles: CandleData[]): number {
  let cumTPV = 0, cumVol = 0;
  for (const c of candles) {
    const tp = (c.high + c.low + c.close) / 3;
    const vol = c.volume || 1;
    cumTPV += tp * vol;
    cumVol += vol;
  }
  return cumVol > 0 ? cumTPV / cumVol : candles[candles.length - 1]?.close ?? 0;
}

export function computeTechnicalIndicators(
  candles: CandleData[],
  rsiBullishThreshold = 52,
  rsiBearishThreshold = 48
): TechnicalIndicators | null {
  if (candles.length < 30) return null;
  const closes = candles.map((c) => c.close);
  const ltp = closes[closes.length - 1];

  const emaFast = computeEMA(closes, 21);
  const emaSlow = computeEMA(closes, 50);
  const emaTrend: "BULL" | "BEAR" = emaFast > emaSlow ? "BULL" : "BEAR";

  const rsiValue = computeRSI(closes, 14);
  const rsiSignal: "BULL" | "BEAR" | "NEUTRAL" =
    rsiValue >= rsiBullishThreshold && rsiValue < 80
      ? "BULL"
      : rsiValue <= rsiBearishThreshold && rsiValue > 20
        ? "BEAR"
        : "NEUTRAL";

  const macd = computeMACD(closes, 12, 26, 9);
  const macdBias: "BULL" | "BEAR" = macd.hist > 0 ? "BULL" : "BEAR";

  const vwap = computeVWAP(candles);
  const vwapBias: "BULL" | "BEAR" = ltp > vwap ? "BULL" : "BEAR";

  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const n = candles.length;
  const recentRange = highs.slice(-14).reduce((s, h, i) => s + h - lows.slice(-14)[i], 0) / 14;
  const avgRange = highs.slice(-28).reduce((s, h, i) => s + h - lows.slice(-28)[i], 0) / Math.min(28, n);
  const adxProxy = avgRange > 0 ? (recentRange / avgRange) * 25 : 18;
  const trendStrength: "STRONG" | "MODERATE" | "WEAK" = adxProxy >= 25 ? "STRONG" : adxProxy >= 18 ? "MODERATE" : "WEAK";

  return {
    emaFast, emaSlow, emaTrend,
    rsiValue: parseFloat(rsiValue.toFixed(1)), rsiSignal,
    macdLine: parseFloat(macd.line.toFixed(2)), macdSignal: parseFloat(macd.signal.toFixed(2)),
    macdHist: parseFloat(macd.hist.toFixed(2)), macdBias,
    vwap: parseFloat(vwap.toFixed(2)), vwapBias,
    adxProxy: parseFloat(adxProxy.toFixed(1)), trendStrength,
  };
}

// ---------- Signal Strength (real indicators, 0-9 matching Pine Script) ----------

export function computeSignalStrength(
  pcrValue: number, priceAction?: PriceAction, volRegime?: VolRegime,
  oiLongCount?: number, oiShortCount?: number,
  tech?: TechnicalIndicators | null, filters?: AdvancedFilters | null,
): SignalStrength {
  const components: { name: string; ok: boolean }[] = [];

  if (tech) {
    components.push({ name: `EMA 21/50 (${tech.emaTrend})`, ok: tech.emaTrend === "BULL" });
    components.push({ name: `RSI ${tech.rsiValue} (${tech.rsiSignal})`, ok: tech.rsiSignal === "BULL" });
    components.push({ name: `MACD Hist ${tech.macdHist > 0 ? "+" : ""}${tech.macdHist}`, ok: tech.macdHist > 0 });
    components.push({ name: `VWAP (${tech.vwapBias})`, ok: tech.vwapBias === "BULL" });
    components.push({ name: `ADX Strength (${tech.trendStrength})`, ok: tech.adxProxy >= 18 });
  } else if (priceAction) {
    components.push({ name: "Trend (LTP > PrevClose)", ok: priceAction.ltp > priceAction.prevClose });
    components.push({ name: "Momentum", ok: Math.abs(priceAction.ltp - priceAction.open) / priceAction.open > 0.001 });
    components.push({ name: "MACD proxy", ok: priceAction.ltp > (priceAction.open + priceAction.prevClose) / 2 });
    components.push({ name: "VWAP proxy", ok: priceAction.ltp > (priceAction.high + priceAction.low) / 2 });
    components.push({ name: "ADX proxy", ok: (priceAction.high - priceAction.low) / priceAction.prevClose > 0.003 });
  }

  if (filters) {
    components.push({ name: `Range Filter (${filters.rfConfirmsBull ? "▲" : filters.rfConfirmsBear ? "▼" : "—"})`, ok: filters.rfConfirmsBull });
    components.push({ name: `RQK (${filters.rqkConfirmsBull ? "▲" : filters.rqkConfirmsBear ? "▼" : "—"})`, ok: filters.rqkConfirmsBull });
    components.push({ name: `Chop ${filters.choppiness} (${filters.isChoppy ? "Ranging" : "Trending"})`, ok: !filters.isChoppy });
  }

  const volOk = (oiLongCount ?? 0) + (oiShortCount ?? 0) > 0;
  components.push({ name: "OI Activity", ok: volOk });

  const score = components.filter((c) => c.ok).length;
  const max = components.length;
  const pct = max > 0 ? score / max : 0;
  const label = pct >= 0.75 ? "STRONG" : pct >= 0.5 ? "MODERATE" : "WEAK";
  return { score, max, label, components };
}

// ---------- Weighted Sentiment (real indicator scores, matching Pine Script) ----------

export function computeSentiment(
  pcrValue: number, priceAction?: PriceAction,
  oiData?: { longCount: number; shortCount: number }, volRegime?: VolRegime,
  tech?: TechnicalIndicators | null,
): Sentiment {
  const comps: { name: string; score: number; weight: number }[] = [];

  if (tech) {
    const rsiScore = Math.max(-100, Math.min(100, (tech.rsiValue - 50) * 2));
    comps.push({ name: "RSI (14)", score: Math.round(rsiScore), weight: 0.25 });

    const atr = tech.adxProxy > 0 ? tech.adxProxy : 1;
    const macdScore = Math.max(-100, Math.min(100, (tech.macdHist / atr) * 100));
    comps.push({ name: "MACD Hist", score: Math.round(macdScore), weight: 0.20 });

    const emaScore = tech.emaTrend === "BULL" ? 100 : -100;
    comps.push({ name: "EMA 21/50", score: emaScore, weight: 0.25 });

    const vwapScore = tech.vwapBias === "BULL" ? 100 : -100;
    comps.push({ name: "VWAP", score: vwapScore, weight: 0.15 });
  } else {
    let rsiScore = 0;
    if (priceAction) rsiScore = Math.max(-100, Math.min(100, ((priceAction.ltp - priceAction.prevClose) / priceAction.prevClose) * 3000));
    comps.push({ name: "RSI proxy", score: Math.round(rsiScore), weight: 0.25 });
    let macdScore = 0;
    if (priceAction) macdScore = Math.max(-50, Math.min(50, ((priceAction.ltp - priceAction.open) / priceAction.open) * 2500));
    comps.push({ name: "MACD proxy", score: Math.round(macdScore), weight: 0.20 });
    const emaScore = priceAction ? (priceAction.ltp > priceAction.prevClose ? 30 : -30) : 0;
    comps.push({ name: "EMA proxy", score: emaScore, weight: 0.25 });
    const vwapScore = priceAction ? (priceAction.ltp > (priceAction.high + priceAction.low) / 2 ? 30 : -30) : 0;
    comps.push({ name: "VWAP proxy", score: Math.round(vwapScore), weight: 0.15 });
  }

  let adxScore = 0;
  if (oiData) adxScore = Math.max(-20, Math.min(20, (oiData.longCount - oiData.shortCount) * 7));
  comps.push({ name: "ADX (OI strength)", score: Math.round(adxScore), weight: 0.10 });
  const volScore = volRegime === "HIGH" ? -100 : volRegime === "LOW" ? 60 : 20;
  comps.push({ name: "Vol Regime", score: volScore, weight: 0.05 });

  const rawScore = comps.reduce((sum, c) => sum + c.score * c.weight, 0);
  const score = Math.max(-100, Math.min(100, Math.round(rawScore)));
  const side = score >= 60 ? "STRONG BUY" : score >= 20 ? "BUY" : score >= 5 ? "MILD BUY" : score <= -60 ? "STRONG SELL" : score <= -20 ? "SELL" : score <= -5 ? "MILD SELL" : "NEUTRAL";
  const optionsBias = score >= 20 ? "Call Bias" : score >= 5 ? "Slight Call" : score <= -20 ? "Put Bias" : score <= -5 ? "Slight Put" : "Balanced";
  const momentum = score > 20 ? "BULLISH" : score > 0 ? "Bullish Tilt" : score < -20 ? "BEARISH" : score < 0 ? "Bearish Tilt" : "FLAT";
  return { score, side, optionsBias, momentum, components: comps };
}

// ---------- Multi-factor Bias (real indicators > PCR, matching Pine Script) ----------

export function computeMultiFactorBias(
  pcrValue: number, priceAction?: PriceAction,
  tech?: TechnicalIndicators | null,
  filters?: AdvancedFilters | null,
  profile?: SegmentStrategyConfig | null,
  orbContext?: OrbContext | null,
  cprContext?: CprContext | null,
): { bias: "BULLISH" | "BEARISH" | "NEUTRAL"; strength: "STRONG" | "MODERATE" | "MILD" | "NEUTRAL"; confidence: number } {
  const cfg = withStrategyDefaults(profile);
  let bullPoints = 0;
  let bearPoints = 0;

  // REAL TECHNICAL INDICATORS (high weight — these match Pine Script)
  if (tech) {
    // EMA 21 > EMA 50 = BULL (weight: 3 points — primary trend)
    if (tech.emaTrend === "BULL") bullPoints += 3; else bearPoints += 3;

    // RSI (weight: 2 points)
    if (tech.rsiValue >= cfg.rsiBullishThreshold && tech.rsiValue < 80) bullPoints += 2;
    else if (tech.rsiValue <= cfg.rsiBearishThreshold && tech.rsiValue > 20) bearPoints += 2;

    // MACD histogram (weight: 2 points)
    if (tech.macdHist > 0) bullPoints += 2; else bearPoints += 2;

    // VWAP (weight: 1 point)
    if (tech.vwapBias === "BULL") bullPoints += 1; else bearPoints += 1;

    // ADX trending (weight: 1 point bonus for strong trends)
    if (tech.trendStrength === "STRONG") {
      if (tech.emaTrend === "BULL") bullPoints += 1; else bearPoints += 1;
    }
  } else if (priceAction) {
    const { ltp, open, prevClose } = priceAction;
    if (ltp > prevClose * 1.003) bullPoints += 2; else if (ltp > prevClose) bullPoints += 1;
    if (ltp < prevClose * 0.997) bearPoints += 2; else if (ltp < prevClose) bearPoints += 1;
    if (ltp > open * 1.002) bullPoints += 1;
    if (ltp < open * 0.998) bearPoints += 1;
  }

  // ADVANCED FILTERS (weight: 1 point each — confirmation layer)
  if (filters) {
    if (filters.rfConfirmsBull) bullPoints += 1; else if (filters.rfConfirmsBear) bearPoints += 1;
    if (filters.rqkConfirmsBull) bullPoints += 1; else if (filters.rqkConfirmsBear) bearPoints += 1;
    if (filters.isChoppy) { bullPoints = Math.max(0, bullPoints - 2); bearPoints = Math.max(0, bearPoints - 2); }
  }

  // PCR (weight: 1 point — supporting, NOT dominant)
  if (pcrValue > cfg.pcrBullishThreshold) bullPoints += 1;
  else if (pcrValue < cfg.pcrBearishThreshold) bearPoints += 1;

  // ORB confirmation adds conviction only on clear breakout.
  if (orbContext?.isBreakout) {
    if (orbContext.breakout === "ABOVE_ORB") bullPoints += 1;
    if (orbContext.breakout === "BELOW_ORB") bearPoints += 1;
  }

  // CPR context helps filter trend-vs-range quality.
  if (cprContext) {
    if (cprContext.position === "ABOVE_CPR") bullPoints += 1;
    if (cprContext.position === "BELOW_CPR") bearPoints += 1;

    if (cprContext.type === "NARROW_TREND") {
      if (cprContext.position === "ABOVE_CPR") bullPoints += 1;
      if (cprContext.position === "BELOW_CPR") bearPoints += 1;
    } else if (cprContext.type === "WIDE_RANGE") {
      bullPoints = Math.max(0, bullPoints - 1);
      bearPoints = Math.max(0, bearPoints - 1);
    }
  }

  const net = bullPoints - bearPoints;
  const total = bullPoints + bearPoints;
  const baseConfidence = total > 0 ? Math.round((Math.abs(net) / total) * 50 + 50) : 50;

  if (net >= cfg.biasStrongThreshold) return { bias: "BULLISH", strength: "STRONG", confidence: Math.min(92, baseConfidence) };
  if (net >= cfg.biasModerateThreshold) return { bias: "BULLISH", strength: "MODERATE", confidence: baseConfidence };
  if (net >= 1) return { bias: "BULLISH", strength: "MILD", confidence: baseConfidence };
  if (net <= -cfg.biasStrongThreshold) return { bias: "BEARISH", strength: "STRONG", confidence: Math.min(92, baseConfidence) };
  if (net <= -cfg.biasModerateThreshold) return { bias: "BEARISH", strength: "MODERATE", confidence: baseConfidence };
  if (net <= -1) return { bias: "BEARISH", strength: "MILD", confidence: baseConfidence };
  return { bias: "NEUTRAL", strength: "NEUTRAL", confidence: 50 };
}

// ---------- Targets & Stops ----------

const BASE_STOP_MULT = 1.1;
const T1_RATIO = 1.5;
const T2_RATIO = 3.0;
const T3_RATIO = 5.0;
const TRAIL_ATR_MULT = 0.8;

export function computeTargetsStops(
  entry: number, atr: number, bias: "BULLISH" | "BEARISH" | "NEUTRAL",
  strikeStep = 50, volInfo?: VolatilityInfo,
): TargetsStops {
  const stopMult = volInfo?.dynamicStopMult ?? BASE_STOP_MULT;
  const targetMult = volInfo?.dynamicTargetMult ?? 1.0;
  const slPoints = Math.max(atr * stopMult, strikeStep * 0.5);
  const snap = (v: number) => Math.round(v / strikeStep) * strikeStep;
  if (bias === "BULLISH") {
    const sl = entry - slPoints;
    const risk = entry - sl;
    return { entry, stopLoss: snap(sl), t1: snap(entry + risk * T1_RATIO * targetMult), t2: snap(entry + risk * T2_RATIO * targetMult), t3: snap(entry + risk * T3_RATIO * targetMult), trailingStop: snap(entry - atr * TRAIL_ATR_MULT), slPoints: parseFloat(slPoints.toFixed(1)), rr1: parseFloat((T1_RATIO * targetMult).toFixed(2)), rr2: parseFloat((T2_RATIO * targetMult).toFixed(2)), rr3: parseFloat((T3_RATIO * targetMult).toFixed(2)) };
  }
  if (bias === "BEARISH") {
    const sl = entry + slPoints;
    const risk = sl - entry;
    return { entry, stopLoss: snap(sl), t1: snap(entry - risk * T1_RATIO * targetMult), t2: snap(entry - risk * T2_RATIO * targetMult), t3: snap(entry - risk * T3_RATIO * targetMult), trailingStop: snap(entry + atr * TRAIL_ATR_MULT), slPoints: parseFloat(slPoints.toFixed(1)), rr1: parseFloat((T1_RATIO * targetMult).toFixed(2)), rr2: parseFloat((T2_RATIO * targetMult).toFixed(2)), rr3: parseFloat((T3_RATIO * targetMult).toFixed(2)) };
  }
  return { entry, stopLoss: entry, t1: entry, t2: entry, t3: entry, trailingStop: entry, slPoints: 0, rr1: 0, rr2: 0, rr3: 0 };
}

// ---------- Partial Exits ----------

export function computePartialExits(riskPerTrade = 2000, slPoints: number, rupeesPerPoint = 50): PartialExitPlan {
  const perLotRisk = slPoints * rupeesPerPoint;
  const totalLots = perLotRisk > 0 ? Math.max(1, Math.min(10, Math.floor(riskPerTrade / perLotRisk))) : 1;
  const t1Lots = Math.max(1, Math.floor(totalLots * 0.3));
  const t2Lots = Math.max(1, Math.floor(totalLots * 0.4));
  const t3Lots = Math.max(1, totalLots - t1Lots - t2Lots);
  return { t1Pct: 30, t2Pct: 40, t3Pct: 30, t1Lots, t2Lots, t3Lots, totalLots };
}

// ---------- Options Advisor (ITM-first for meaningful premiums) ----------

function estimateDelta(strike: number, currentPrice: number, isCall: boolean, volRegime: VolRegime = "NORMAL"): number {
  const moneyness = isCall ? (currentPrice - strike) / currentPrice : (strike - currentPrice) / currentPrice;
  let baseDelta = moneyness > 0.02 ? 0.7 : moneyness > -0.02 ? 0.5 : moneyness > -0.05 ? 0.3 : 0.15;
  const volAdj = volRegime === "HIGH" ? 1.1 : volRegime === "LOW" ? 0.9 : 1.0;
  return parseFloat(Math.max(0.1, Math.min(0.9, baseDelta * volAdj)).toFixed(4));
}

function getDaysToExpiry(expiryDay: ExpiryDay): number {
  const now = new Date();
  const currentDay = now.getDay();
  let daysAhead = (expiryDay - currentDay + 7) % 7;
  if (daysAhead === 0) {
    const istHour = now.getUTCHours() + 5 + (now.getUTCMinutes() + 30 >= 60 ? 1 : 0);
    const istMin = (now.getUTCMinutes() + 30) % 60;
    if (istHour > 15 || (istHour === 15 && istMin >= 30)) daysAhead = 7;
  }
  return daysAhead || 7;
}

export interface GreekStrikeData {
  strike: number;
  optionType: "CE" | "PE";
  delta: number;
  iv: number;
  tradeVolume: number;
}

/**
 * Pick the best strike for INTRADAY options trading.
 * ATM or 1 strike ITM — best gamma, reasonable premium (₹80-200 range).
 * Deep ITM is bad for intraday: high capital, low gamma, slow movement.
 */
export function pickBestITMStrike(
  greeks: GreekStrikeData[], underlying: number, isCall: boolean, strikeStep: number,
): GreekStrikeData | null {
  const targetType = isCall ? "CE" : "PE";
  const atmStrike = Math.round(underlying / strikeStep) * strikeStep;

  // For intraday: ATM (delta ~0.5) or 1 strike ITM (delta ~0.55-0.6)
  const maxITMDistance = strikeStep * 1.5;
  const candidates = greeks
    .filter((g) => g.optionType === targetType)
    .filter((g) => {
      const dist = isCall ? underlying - g.strike : g.strike - underlying;
      return dist >= -strikeStep * 0.5 && dist <= maxITMDistance;
    })
    .map((g) => ({ ...g, absDelta: Math.abs(g.delta) }));

  if (candidates.length === 0) return null;

  // Prefer ATM to 1-strike ITM (delta 0.45-0.60 = best gamma for intraday)
  const ideal = candidates.filter((c) => c.absDelta >= 0.45 && c.absDelta <= 0.60);
  if (ideal.length > 0) {
    ideal.sort((a, b) => Math.abs(a.absDelta - 0.52) - Math.abs(b.absDelta - 0.52));
    return ideal[0];
  }

  // Fallback: closest to ATM strike
  candidates.sort((a, b) => Math.abs(a.strike - atmStrike) - Math.abs(b.strike - atmStrike));
  return candidates[0];
}

export function computeOptionsAdvisor(
  underlying: number, atr: number, bias: "BULLISH" | "BEARISH" | "NEUTRAL",
  strikeStep = 50, mode: StrikeMode = "High Delta", volRegime: VolRegime = "NORMAL",
  realDelta?: number, realIV?: number, expiryDay: ExpiryDay = 4,
  bestGreekStrike?: GreekStrikeData | null,
): OptionsAdvisor {
  const effectiveBias = bias === "NEUTRAL" ? "BULLISH" : bias;
  const isBullish = effectiveBias === "BULLISH";
  const isCall = isBullish;

  let strike: number;
  let delta: number;
  let iv: number;

  if (bestGreekStrike) {
    strike = bestGreekStrike.strike;
    delta = Math.abs(bestGreekStrike.delta);
    iv = bestGreekStrike.iv;
  } else {
    // Fallback: ATM or 1 strike ITM (best for intraday)
    if (mode === "OTM Aggressive") {
      strike = isBullish
        ? Math.round((underlying + strikeStep) / strikeStep) * strikeStep
        : Math.round((underlying - strikeStep) / strikeStep) * strikeStep;
    } else {
      // ATM or 1 strike ITM — sweet spot for intraday
      strike = isBullish
        ? Math.round((underlying - strikeStep * 0.5) / strikeStep) * strikeStep
        : Math.round((underlying + strikeStep * 0.5) / strikeStep) * strikeStep;
    }
    delta = realDelta ?? estimateDelta(strike, underlying, isCall, volRegime);
    iv = realIV ?? (volRegime === "HIGH" ? 22 : volRegime === "LOW" ? 12 : 16);
  }

  const intrinsic = isCall ? Math.max(0, underlying - strike) : Math.max(0, strike - underlying);
  const basePremMult = 0.02;
  const volAdj = volRegime === "HIGH" ? 1.5 : volRegime === "LOW" ? 0.7 : 1.0;
  const timeValue = strike * basePremMult * volAdj * (atr / underlying);
  const premium = Math.max(5, Math.round(intrinsic + timeValue));

  const daysToExpiry = getDaysToExpiry(expiryDay);
  const theta = parseFloat((-premium / Math.max(1, daysToExpiry) * 0.6).toFixed(2));

  const diff = isCall ? underlying - strike : strike - underlying;
  const moneyness = diff > strikeStep * 0.5 ? "ITM" : Math.abs(diff) < strikeStep * 0.5 ? "ATM" : "OTM";
  const side: OptionsAdvisor["side"] = bias === "NEUTRAL" ? "BALANCED" : isBullish ? "CALL" : "PUT";

  // Intraday-optimized risk management:
  // Tight SL (20%) for confirmed multi-indicator signals
  // Realistic intraday targets: T1 +25%, T2 +50%, T3 +80%
  const optionTargets: OptionTargets = {
    premiumEntry: premium,
    premiumSL: Math.round(premium * 0.80),        // -20% SL (tight, confirmed signal)
    premiumT1: Math.round(premium * 1.25),         // +25% (quick scalp)
    premiumT2: Math.round(premium * 1.50),         // +50% (good move)
    premiumT3: Math.round(premium * 1.80),         // +80% (full run)
    premiumTrailSL: Math.round(premium * 1.10),    // lock 10% profit after T1
  };

  const recommendation = bias === "NEUTRAL"
    ? "WAIT / Straddle"
    : `BUY ${strike} ${side} @ ~₹${premium}`;

  return {
    strike, side, premium, delta, mode, daysToExpiry,
    iv: parseFloat(iv.toFixed(1)), theta, moneyness,
    recommendation, optionTargets,
  };
}

// ---------- Advanced Filters (ported from DIY Pine Script) ----------

export interface CandleData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function emaArray(data: number[], period: number): number[] {
  if (data.length === 0) return [];
  const result: number[] = [data[0]];
  const k = 2 / (period + 1);
  for (let i = 1; i < data.length; i++) {
    result.push(data[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

/**
 * Range Filter — dual-pass smoothing from diy.pine (smoothrng + rngfilt).
 * Removes noise from price; cross above/below filter line gives direction.
 */
export function computeRangeFilter(
  closes: number[], period = 20, mult = 3.0,
): { filt: number; upward: boolean; downward: boolean } {
  if (closes.length < period * 3)
    return { filt: closes[closes.length - 1] ?? 0, upward: false, downward: false };

  const absChanges: number[] = [];
  for (let i = 1; i < closes.length; i++) absChanges.push(Math.abs(closes[i] - closes[i - 1]));

  const avgRng = emaArray(absChanges, period);
  const wper = period * 2 - 1;
  const smoothRng = emaArray(avgRng, wper).map((v) => v * mult);

  const filtArr: number[] = [closes[0]];
  for (let i = 0; i < closes.length - 1; i++) {
    const x = closes[i + 1];
    const r = smoothRng[Math.min(i, smoothRng.length - 1)] ?? 0;
    const prev = filtArr[filtArr.length - 1];
    if (x > prev) filtArr.push(x - r < prev ? prev : x - r);
    else filtArr.push(x + r > prev ? prev : x + r);
  }

  const n = filtArr.length;
  if (n < 3) return { filt: filtArr[n - 1] ?? 0, upward: false, downward: false };

  const filt = filtArr[n - 1];
  const prevFilt = filtArr[n - 2];
  return { filt, upward: filt > prevFilt, downward: filt < prevFilt };
}

/**
 * Rational Quadratic Kernel (RQK) — Nadaraya-Watson estimator from diy.pine.
 * ML-inspired regression with minimal lag; detects trend with weighted past data.
 */
export function computeRQK(
  closes: number[], lookback = 8, relWeight = 8, startBar = 25,
): { value: number; prevValue: number; uptrend: boolean; downtrend: boolean } {
  const n = closes.length;
  if (n < 3) return { value: closes[n - 1] ?? 0, prevValue: closes[n - 2] ?? closes[0] ?? 0, uptrend: false, downtrend: false };

  function kernelReg(src: number[], len: number, h2: number): number {
    let curW = 0, cumW = 0;
    const maxI = Math.min(len, len + startBar);
    for (let i = 0; i < maxI; i++) {
      const idx = len - 1 - i;
      if (idx < 0) break;
      const w = Math.pow(1 + (i * i) / (h2 * h2 * 2 * relWeight), -relWeight);
      curW += src[idx] * w;
      cumW += w;
    }
    return cumW > 0 ? curW / cumW : src[len - 1];
  }

  const value = kernelReg(closes, n, lookback);
  const prevValue = kernelReg(closes, n - 1, lookback);

  return { value, prevValue, uptrend: value > prevValue, downtrend: value < prevValue };
}

/**
 * Choppiness Index — measures whether market is trending (low) or ranging/choppy (high).
 * CI = 100 * LOG10( SUM(ATR(1), period) / (HH - LL) ) / LOG10(period)
 * Above 61.8 = choppy, below = trending.
 */
export function computeChoppiness(
  highs: number[], lows: number[], closes: number[], period = 14,
): number {
  const n = closes.length;
  if (n < period + 1) return 50;

  let atrSum = 0;
  for (let i = n - period; i < n; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - (closes[i - 1] ?? closes[i])),
      Math.abs(lows[i] - (closes[i - 1] ?? closes[i])),
    );
    atrSum += tr;
  }

  let hh = -Infinity, ll = Infinity;
  for (let i = n - period; i < n; i++) {
    if (highs[i] > hh) hh = highs[i];
    if (lows[i] < ll) ll = lows[i];
  }

  const range = hh - ll;
  if (range <= 0) return 50;
  return 100 * Math.log10(atrSum / range) / Math.log10(period);
}

export interface AdvancedFilters {
  rangeFilter: { filt: number; upward: boolean; downward: boolean };
  rqk: { value: number; prevValue: number; uptrend: boolean; downtrend: boolean };
  choppiness: number;
  isChoppy: boolean;
  rfConfirmsBull: boolean;
  rfConfirmsBear: boolean;
  rqkConfirmsBull: boolean;
  rqkConfirmsBear: boolean;
}

export function computeAdvancedFilters(
  candles: CandleData[],
  choppinessThreshold = 61.8
): AdvancedFilters {
  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);

  const rf = computeRangeFilter(closes, 20, 3.0);
  const rqk = computeRQK(closes, 8, 8, 25);
  const chop = computeChoppiness(highs, lows, closes, 14);

  return {
    rangeFilter: rf,
    rqk,
    choppiness: parseFloat(chop.toFixed(1)),
    isChoppy: chop > choppinessThreshold,
    rfConfirmsBull: rf.upward,
    rfConfirmsBear: rf.downward,
    rqkConfirmsBull: rqk.uptrend,
    rqkConfirmsBear: rqk.downtrend,
  };
}

/**
 * Signal Expiry — if the same directional bias persists for more than N cycles
 * without fresh confirmation from advanced filters, expire to NEUTRAL.
 */
export interface SignalStateEntry {
  lastBias: string;
  cycleCount: number;
  lastConfirmedAt: number;
}

const SIGNAL_EXPIRY_CYCLES = 5;

const signalStateCache = new Map<string, SignalStateEntry>();

export function applySignalExpiry(
  symbol: string, bias: string, filtersConfirm: boolean,
): { expired: boolean; cycleCount: number } {
  const now = Date.now();
  const state = signalStateCache.get(symbol);

  if (!state || bias !== state.lastBias) {
    signalStateCache.set(symbol, { lastBias: bias, cycleCount: 0, lastConfirmedAt: now });
    return { expired: false, cycleCount: 0 };
  }

  if (filtersConfirm) {
    state.lastConfirmedAt = now;
    state.cycleCount = 0;
    return { expired: false, cycleCount: 0 };
  }

  state.cycleCount++;
  if (state.cycleCount > SIGNAL_EXPIRY_CYCLES) {
    return { expired: true, cycleCount: state.cycleCount };
  }
  return { expired: false, cycleCount: state.cycleCount };
}

/**
 * Alternate Signal — prevents consecutive signals in the same direction.
 * After BULLISH is acted upon, next must be BEARISH before another BULLISH.
 */
const lastActedDirection = new Map<string, string>();

export function applyAlternateSignal(
  symbol: string, bias: string,
): { blocked: boolean; reason?: string } {
  if (bias === "NEUTRAL") return { blocked: false };
  const last = lastActedDirection.get(symbol);
  if (last && last === bias) {
    return { blocked: true, reason: `Blocked: consecutive ${bias} — waiting for opposite signal` };
  }
  return { blocked: false };
}

export function recordSignalDirection(symbol: string, bias: string) {
  if (bias !== "NEUTRAL") lastActedDirection.set(symbol, bias);
}

// ---------- S/R Levels ----------

export function computeSRLevels(pdh: number, pdl: number, pdc: number): SRLevels {
  const pivot = (pdh + pdl + pdc) / 3;
  const cprTC = (pdh + pdl) / 2;
  const cprBC = pivot - (cprTC - pivot);
  const range = pdh - pdl;
  return { pdh, pdl, pdc, pivot, cprTC, cprBC, r1: 2 * pivot - pdl, r2: pivot + range, s1: 2 * pivot - pdh, s2: pivot - range, camH3: pdc + range * 1.1 / 4, camL3: pdc - range * 1.1 / 4 };
}

export function computeCprContext(
  srLevels: SRLevels,
  ltp: number,
  profile?: SegmentStrategyConfig | null
): CprContext {
  const cfg = withStrategyDefaults(profile);
  const widthPct =
    (Math.abs(srLevels.cprTC - srLevels.cprBC) / Math.max(1, srLevels.pdc)) *
    100;
  const type: CprContext["type"] =
    widthPct <= cfg.cprNarrowThresholdPct
      ? "NARROW_TREND"
      : widthPct >= cfg.cprWideThresholdPct
        ? "WIDE_RANGE"
        : "NORMAL";
  const position: CprContext["position"] =
    ltp > srLevels.cprTC
      ? "ABOVE_CPR"
      : ltp < srLevels.cprBC
        ? "BELOW_CPR"
        : "INSIDE_CPR";

  return {
    widthPct: parseFloat(widthPct.toFixed(3)),
    type,
    position,
  };
}

// ---------- Signal Generator ----------

export interface GenerateSignalOpts {
  pdh?: number; pdl?: number; pdc?: number;
  atr?: number; atrSma?: number;
  strikeStep?: number;
  greekDelta?: number; greekIV?: number;
  priceAction?: PriceAction;
  oiData?: { longCount: number; shortCount: number };
  expiryDay?: ExpiryDay;
  bestGreekStrike?: GreekStrikeData | null;
  advancedFilters?: AdvancedFilters | null;
  technicalIndicators?: TechnicalIndicators | null;
  strategyProfile?: SegmentStrategyConfig | null;
  orbContext?: OrbContext | null;
  cprContext?: CprContext | null;
  symbol?: string;
}

export function generateSignalFromPCR(
  pcrValue: number, underlyingValue: number, maxPainStrike?: number, opts?: GenerateSignalOpts,
): StrategySignal {
  const mp = maxPainStrike ?? underlyingValue;
  const atr = opts?.atr ?? underlyingValue * 0.008;
  const pdh = opts?.pdh ?? underlyingValue * 1.006;
  const pdl = opts?.pdl ?? underlyingValue * 0.994;
  const pdc = opts?.pdc ?? underlyingValue;
  const strikeStep = opts?.strikeStep ?? 50;
  const profile = withStrategyDefaults(opts?.strategyProfile);

  const tech = opts?.technicalIndicators ?? null;
  const filters = opts?.advancedFilters ?? null;
  const srLevels = computeSRLevels(pdh, pdl, pdc);
  const cprContext =
    opts?.cprContext ?? computeCprContext(srLevels, underlyingValue, profile);
  let { bias, strength, confidence } = computeMultiFactorBias(
    pcrValue,
    opts?.priceAction,
    tech,
    filters,
    profile,
    opts?.orbContext,
    cprContext
  );
  const pcr: PCRResult = {
    value: pcrValue,
    bias:
      pcrValue > profile.pcrBullishThreshold
        ? "BULLISH"
        : pcrValue < profile.pcrBearishThreshold
          ? "BEARISH"
          : "NEUTRAL",
    callOI: 0,
    putOI: 0,
  };
  const atrSma = opts?.atrSma ?? atr;
  const volInfo = computeVolatility(atr, atrSma);
  const signalStrength = computeSignalStrength(pcrValue, opts?.priceAction, volInfo.regime, opts?.oiData?.longCount, opts?.oiData?.shortCount, tech, filters);

  let signalExpired = false;
  let alternateBlocked = false;
  let alternateReason: string | undefined;

  // Signal Expiry & Alternate Signal (stateful checks)
  if (filters && opts?.symbol && bias !== "NEUTRAL") {
    const rfAgrees = (bias === "BULLISH" && filters.rfConfirmsBull) || (bias === "BEARISH" && filters.rfConfirmsBear);
    const rqkAgrees = (bias === "BULLISH" && filters.rqkConfirmsBull) || (bias === "BEARISH" && filters.rqkConfirmsBear);
    const filtersConfirm = (rfAgrees || rqkAgrees) && !filters.isChoppy;

    const expiry = applySignalExpiry(opts.symbol, bias, filtersConfirm);
    if (expiry.expired) {
      signalExpired = true;
      bias = "NEUTRAL"; strength = "NEUTRAL"; confidence = 40;
    }

    if (bias !== "NEUTRAL") {
      const alt = applyAlternateSignal(opts.symbol, bias);
      if (alt.blocked) { alternateBlocked = true; alternateReason = alt.reason; confidence = Math.max(35, confidence - 15); }
    }
  }

  const entry = underlyingValue;
  const targets = computeTargetsStops(entry, atr, bias, strikeStep, volInfo);
  const bullishTargets = computeTargetsStops(entry, atr, "BULLISH", strikeStep, volInfo);
  const bearishTargets = computeTargetsStops(entry, atr, "BEARISH", strikeStep, volInfo);

  const optionsAdvisor = computeOptionsAdvisor(
    underlyingValue, atr, bias, strikeStep, "High Delta", volInfo.regime,
    opts?.greekDelta, opts?.greekIV, opts?.expiryDay ?? 4,
    opts?.bestGreekStrike,
  );

  const sentiment = computeSentiment(pcrValue, opts?.priceAction, opts?.oiData, volInfo.regime, tech);
  const partialExits = bias !== "NEUTRAL" ? computePartialExits(2000, targets.slPoints) : undefined;
  const tradeDirection = bias === "BULLISH" ? "Long Only" : bias === "BEARISH" ? "Short Only" : "Both (Wait)";

  const strengthLabel = strength !== "NEUTRAL" ? ` (${strength})` : "";
  const biasLabel = bias === "NEUTRAL" ? "Sideways" : bias;
  const filterStatus = filters
    ? ` | RF:${filters.rfConfirmsBull ? "▲" : filters.rfConfirmsBear ? "▼" : "—"} RQK:${filters.rqkConfirmsBull ? "▲" : filters.rqkConfirmsBear ? "▼" : "—"} CHOP:${filters.choppiness}${filters.isChoppy ? "(choppy)" : ""}`
    : "";
  const expiryNote = signalExpired ? " | EXPIRED" : "";
  const altNote = alternateBlocked ? " | ALT-BLOCKED" : "";
  const orbNote = opts?.orbContext
    ? ` | ORB:${opts.orbContext.breakout}`
    : "";
  const cprNote = cprContext
    ? ` | CPR:${cprContext.position}/${cprContext.type}`
    : "";
  const summary = `${biasLabel}${strengthLabel} | PCR ${pcrValue.toFixed(2)} | Strength: ${signalStrength.score}/${signalStrength.max} | Vol: ${volInfo.regime} | Max Pain: ${mp}${filterStatus}${orbNote}${cprNote}${expiryNote}${altNote}`;

  return {
    bias, biasStrength: strength, entry, confidence,
    stopLoss: targets.stopLoss, target: targets.t3,
    t1: targets.t1, t2: targets.t2, t3: targets.t3, trailingStop: targets.trailingStop,
    pcr, maxPain: mp, summary,
    targets: bias !== "NEUTRAL" ? targets : undefined,
    bullishTargets, bearishTargets, optionsAdvisor, srLevels, sentiment,
    signalStrength, volatility: volInfo, partialExits, tradeDirection,
    advancedFilters: filters ?? undefined,
    orbContext: opts?.orbContext ?? undefined,
    cprContext,
    signalExpired, alternateBlocked, alternateReason,
  };
}

export function generateSignal(pcr: PCRResult, maxPainStrike: number, underlyingValue: number, opts?: GenerateSignalOpts): StrategySignal {
  return generateSignalFromPCR(pcr.value, underlyingValue, maxPainStrike, opts);
}
