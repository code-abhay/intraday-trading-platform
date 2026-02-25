import type { OptionChainRow } from "@/app/api/option-chain/route";

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

export interface StrategySignal {
  bias: "BULLISH" | "BEARISH" | "NEUTRAL";
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
  optionsAdvisor?: OptionsAdvisor;
  srLevels?: SRLevels;
  sentiment?: Sentiment;
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

export interface OptionsAdvisor {
  strike: number;
  side: "CALL" | "PUT" | "BALANCED";
  premium: number;
  delta: number;
  mode: string;
  daysToExpiry: number;
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
}

/**
 * PCR = Total Put OI / Total Call OI
 * > 1.2 → Bullish, < 0.8 → Bearish
 */
export function computePCR(data: OptionChainRow[]): PCRResult {
  let totalCallOI = 0;
  let totalPutOI = 0;

  for (const row of data) {
    if (row.CE) totalCallOI += row.CE.openInterest;
    if (row.PE) totalPutOI += row.PE.openInterest;
  }

  const value = totalCallOI > 0 ? totalPutOI / totalCallOI : 0;
  let bias: PCRResult["bias"] = "NEUTRAL";
  if (value > 1.2) bias = "BULLISH";
  else if (value < 0.8) bias = "BEARISH";

  return { value, bias, callOI: totalCallOI, putOI: totalPutOI };
}

/**
 * OI Buildup matrix:
 * Price ↑ + OI ↑ → Long Buildup
 * Price ↓ + OI ↑ → Short Buildup
 * Price ↑ + OI ↓ → Short Covering
 * Price ↓ + OI ↓ → Long Unwinding
 */
export function computeOIBuildup(
  data: OptionChainRow[],
  underlyingValue: number
): OIBuildupRow[] {
  return data.map((row) => {
    const callChange = row.CE?.changeinOpenInterest ?? 0;
    const putChange = row.PE?.changeinOpenInterest ?? 0;

    const callBuildup: OIBuildupRow["callBuildup"] =
      callChange > 0 ? "LONG" : callChange < 0 ? "SHORT_COVER" : "NEUTRAL";
    const putBuildup: OIBuildupRow["putBuildup"] =
      putChange > 0 ? "LONG" : putChange < 0 ? "SHORT_COVER" : "NEUTRAL";

    return {
      strikePrice: row.strikePrice,
      callOI: row.CE?.openInterest ?? 0,
      putOI: row.PE?.openInterest ?? 0,
      callChangeOI: callChange,
      putChangeOI: putChange,
      callBuildup,
      putBuildup,
    };
  });
}

/**
 * Max Pain = strike with minimum total payout for option writers
 */
export function computeMaxPain(
  data: OptionChainRow[],
  underlyingValue: number
): MaxPainResult[] {
  const strikes = [...new Set(data.map((r) => r.strikePrice))].sort(
    (a, b) => a - b
  );

  const payouts: MaxPainResult[] = strikes.map((strike) => {
    let totalPayout = 0;
    for (const row of data) {
      if (row.strikePrice !== strike) continue;
      const callOI = row.CE?.openInterest ?? 0;
      const putOI = row.PE?.openInterest ?? 0;
      totalPayout +=
        Math.max(0, underlyingValue - strike) * callOI +
        Math.max(0, strike - underlyingValue) * putOI;
    }
    return { strike, totalPayout };
  });

  return payouts.sort((a, b) => a.totalPayout - b.totalPayout);
}

/** T1/T2/T3 multipliers (Pine script defaults) */
const T1_RR = 1.36;
const T2_RR = 2.73;
const T3_RR = 4.55;
const TRAIL_ATR_MULT = 0.5;

/**
 * Compute T1, T2, T3, SL, Trailing Stop from entry and ATR
 */
export function computeTargetsStops(
  entry: number,
  atr: number,
  bias: StrategySignal["bias"],
  strikeStep = 50
): TargetsStops {
  const slPoints = Math.max(atr * 1.1, strikeStep);
  const isLong = bias === "BULLISH";
  const isShort = bias === "BEARISH";

  if (isLong) {
    const sl = entry - slPoints;
    return {
      entry,
      stopLoss: Math.round(sl / strikeStep) * strikeStep,
      t1: Math.round((entry + slPoints * T1_RR) / strikeStep) * strikeStep,
      t2: Math.round((entry + slPoints * T2_RR) / strikeStep) * strikeStep,
      t3: Math.round((entry + slPoints * T3_RR) / strikeStep) * strikeStep,
      trailingStop: Math.round((entry - atr * TRAIL_ATR_MULT) / strikeStep) * strikeStep,
      slPoints,
      rr1: T1_RR,
      rr2: T2_RR,
      rr3: T3_RR,
    };
  }
  if (isShort) {
    const sl = entry + slPoints;
    return {
      entry,
      stopLoss: Math.round(sl / strikeStep) * strikeStep,
      t1: Math.round((entry - slPoints * T1_RR) / strikeStep) * strikeStep,
      t2: Math.round((entry - slPoints * T2_RR) / strikeStep) * strikeStep,
      t3: Math.round((entry - slPoints * T3_RR) / strikeStep) * strikeStep,
      trailingStop: Math.round((entry + atr * TRAIL_ATR_MULT) / strikeStep) * strikeStep,
      slPoints,
      rr1: T1_RR,
      rr2: T2_RR,
      rr3: T3_RR,
    };
  }
  return {
    entry,
    stopLoss: entry,
    t1: entry,
    t2: entry,
    t3: entry,
    trailingStop: entry,
    slPoints: 0,
    rr1: T1_RR,
    rr2: T2_RR,
    rr3: T3_RR,
  };
}

/**
 * Options Advisor: strike, premium, delta from Pine logic
 */
export function computeOptionsAdvisor(
  underlying: number,
  atr: number,
  bias: StrategySignal["bias"],
  strikeStep = 50,
  mode: "High Delta" | "ATM" | "OTM Aggressive" | "Balanced" = "Balanced"
): OptionsAdvisor {
  const baseStrike = Math.round(underlying / strikeStep) * strikeStep;
  const isBullish = bias === "BULLISH";
  const isBearish = bias === "BEARISH";

  const strikeShift =
    mode === "High Delta"
      ? isBullish ? -strikeStep : isBearish ? strikeStep : 0
      : mode === "ATM"
        ? 0
        : mode === "OTM Aggressive"
          ? isBullish ? strikeStep : isBearish ? -strikeStep : 0
          : isBullish ? strikeStep * 0.5 : isBearish ? -strikeStep * 0.5 : 0;

  const strike = Math.round((baseStrike + strikeShift) / strikeStep) * strikeStep;
  const premium = Math.max(20, atr * 0.6 + Math.abs(strike - underlying) * 0.25);

  const deltaMap =
    mode === "High Delta" ? 0.7 : mode === "ATM" ? 0.5 : mode === "OTM Aggressive" ? 0.3 : 0.45;
  const delta = isBullish ? deltaMap : isBearish ? -deltaMap : 0;

  const side: OptionsAdvisor["side"] =
    isBullish ? "CALL" : isBearish ? "PUT" : "BALANCED";

  const now = new Date();
  const day = now.getDay();
  const daysToTuesday = (2 - day + 7) % 7;
  const daysToExpiry = daysToTuesday === 0 ? 7 : daysToTuesday;

  return { strike, side, premium, delta, mode, daysToExpiry };
}

/**
 * S/R Levels from PDH, PDL, PDC (Pivot, CPR, R1/R2/S1/S2, Camarilla)
 */
export function computeSRLevels(pdh: number, pdl: number, pdc: number): SRLevels {
  const pivot = (pdh + pdl + pdc) / 3;
  const cprTC = (pdh + pdl) / 2;
  const cprBC = pivot - (cprTC - pivot);
  const range = pdh - pdl;

  const r1 = 2 * pivot - pdl;
  const r2 = pivot + range;
  const s1 = 2 * pivot - pdh;
  const s2 = pivot - range;

  const camRange = range * 1.1;
  const camH3 = pdc + camRange / 4;
  const camL3 = pdc - camRange / 4;

  return {
    pdh,
    pdl,
    pdc,
    pivot,
    cprTC,
    cprBC,
    r1,
    r2,
    s1,
    s2,
    camH3,
    camL3,
  };
}

/**
 * Sentiment from PCR (simplified; full version uses RSI/MACD/EMA)
 */
export function computeSentiment(pcrValue: number): Sentiment {
  const score = pcrValue > 1.2 ? 60 : pcrValue < 0.8 ? -60 : (pcrValue - 1) * 100;
  const side =
    score >= 60 ? "STRONG BUY" : score >= 20 ? "BUY" : score <= -60 ? "STRONG SELL" : score <= -20 ? "SELL" : "NEUTRAL";
  const optionsBias = score > 20 ? "Call Bias" : score < -20 ? "Put Bias" : "Balanced";
  return { score, side, optionsBias };
}

/** Fallback ATR when no candle data (≈0.8% of price for NIFTY) */
const FALLBACK_ATR_PCT = 0.008;
/** Fallback PDH/PDL range when no prior day data */
const FALLBACK_RANGE_PCT = 0.006;

/**
 * Generate intraday bias and signal from PCR value only (e.g. from Angel One)
 */
export function generateSignalFromPCR(
  pcrValue: number,
  underlyingValue: number,
  maxPainStrike?: number,
  opts?: { pdh?: number; pdl?: number; pdc?: number; atr?: number; strikeStep?: number }
): StrategySignal {
  let bias: StrategySignal["bias"] = "NEUTRAL";
  if (pcrValue > 1.2) bias = "BULLISH";
  else if (pcrValue < 0.8) bias = "BEARISH";

  const pcr: PCRResult = {
    value: pcrValue,
    bias,
    callOI: 0,
    putOI: 0,
  };

  const mp = maxPainStrike ?? underlyingValue;
  const atr = opts?.atr ?? underlyingValue * FALLBACK_ATR_PCT;
  const pdh = opts?.pdh ?? underlyingValue * (1 + FALLBACK_RANGE_PCT);
  const pdl = opts?.pdl ?? underlyingValue * (1 - FALLBACK_RANGE_PCT);
  const pdc = opts?.pdc ?? underlyingValue;
  const strikeStep = opts?.strikeStep ?? 50;

  return generateSignal(pcr, mp, underlyingValue, { atr, pdh, pdl, pdc, strikeStep });
}

/**
 * Generate intraday bias and signal from PCR + OI
 */
export function generateSignal(
  pcr: PCRResult,
  maxPainStrike: number,
  underlyingValue: number,
  opts?: { atr?: number; pdh?: number; pdl?: number; pdc?: number; strikeStep?: number }
): StrategySignal {
  const strikeStep = opts?.strikeStep ?? 50;
  const atr = opts?.atr ?? underlyingValue * FALLBACK_ATR_PCT;
  const pdh = opts?.pdh ?? underlyingValue * (1 + FALLBACK_RANGE_PCT);
  const pdl = opts?.pdl ?? underlyingValue * (1 - FALLBACK_RANGE_PCT);
  const pdc = opts?.pdc ?? underlyingValue;

  const entry = underlyingValue;
  const targets = computeTargetsStops(entry, atr, pcr.bias, strikeStep);
  const optionsAdvisor = computeOptionsAdvisor(
    underlyingValue,
    atr,
    pcr.bias,
    strikeStep,
    "Balanced"
  );
  const srLevels = computeSRLevels(pdh, pdl, pdc);
  const sentiment = computeSentiment(pcr.value);

  let confidence = 50;
  if (pcr.value > 1.3 || pcr.value < 0.7) confidence = 75;
  if (pcr.value > 1.5 || pcr.value < 0.5) confidence = 85;

  const summary =
    pcr.bias === "NEUTRAL"
      ? `PCR ${pcr.value.toFixed(2)} - Neutral. Max Pain: ${maxPainStrike}`
      : `PCR ${pcr.value.toFixed(2)} - ${pcr.bias}. Max Pain: ${maxPainStrike}`;

  return {
    bias: pcr.bias,
    entry,
    stopLoss: targets.stopLoss,
    target: targets.t3,
    t1: targets.t1,
    t2: targets.t2,
    t3: targets.t3,
    trailingStop: targets.trailingStop,
    confidence,
    pcr,
    maxPain: maxPainStrike,
    summary,
    targets,
    optionsAdvisor,
    srLevels,
    sentiment,
  };
}
