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
 * PCR = Total Put OI / Total Call OI (from NSE option chain)
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
  if (value > 1.05) bias = "BULLISH";
  else if (value < 0.95) bias = "BEARISH";

  return { value, bias, callOI: totalCallOI, putOI: totalPutOI };
}

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

const T1_RR = 1.36;
const T2_RR = 2.73;
const T3_RR = 4.55;
const TRAIL_ATR_MULT = 0.5;

export function computeTargetsStops(
  entry: number,
  atr: number,
  bias: "BULLISH" | "BEARISH" | "NEUTRAL",
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

export function computeOptionsAdvisor(
  underlying: number,
  atr: number,
  bias: "BULLISH" | "BEARISH" | "NEUTRAL",
  strikeStep = 50,
  mode: "High Delta" | "ATM" | "OTM Aggressive" | "Balanced" = "Balanced",
  greekDelta?: number
): OptionsAdvisor {
  const baseStrike = Math.round(underlying / strikeStep) * strikeStep;

  // For NEUTRAL, recommend ATM CE (slight bullish lean) or straddle-style
  const effectiveBias = bias === "NEUTRAL" ? "BULLISH" : bias;
  const isBullish = effectiveBias === "BULLISH";
  const isBearish = effectiveBias === "BEARISH";

  const strikeShift =
    mode === "High Delta"
      ? isBullish ? -strikeStep : strikeStep
      : mode === "ATM"
        ? 0
        : mode === "OTM Aggressive"
          ? isBullish ? strikeStep : -strikeStep
          : isBullish ? strikeStep * 0.5 : -strikeStep * 0.5;

  const strike = Math.round((baseStrike + strikeShift) / strikeStep) * strikeStep;
  const premium = Math.max(20, atr * 0.6 + Math.abs(strike - underlying) * 0.25);

  const computedDelta = mode === "High Delta" ? 0.7 : mode === "ATM" ? 0.5 : mode === "OTM Aggressive" ? 0.3 : 0.45;
  const delta = greekDelta ?? (isBullish ? computedDelta : -computedDelta);

  const side: OptionsAdvisor["side"] =
    bias === "NEUTRAL" ? "BALANCED" : isBullish ? "CALL" : "PUT";

  const now = new Date();
  const day = now.getDay();
  const daysToThursday = (4 - day + 7) % 7;
  const daysToExpiry = daysToThursday === 0 ? 7 : daysToThursday;

  return { strike, side, premium: Math.round(premium), delta: parseFloat(delta.toFixed(4)), mode, daysToExpiry };
}

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

  return { pdh, pdl, pdc, pivot, cprTC, cprBC, r1, r2, s1, s2, camH3, camL3 };
}

/**
 * Multi-factor sentiment combining PCR + price action + OI buildup
 */
export function computeSentiment(
  pcrValue: number,
  priceAction?: { ltp: number; open: number; prevClose: number; high: number; low: number },
  oiData?: { longCount: number; shortCount: number }
): Sentiment {
  // PCR component: -100 to +100
  let pcrScore = 0;
  if (pcrValue > 1.2) pcrScore = 60;
  else if (pcrValue > 1.05) pcrScore = 30;
  else if (pcrValue < 0.8) pcrScore = -60;
  else if (pcrValue < 0.95) pcrScore = -30;
  else pcrScore = (pcrValue - 1) * 200; // -10 to +10 for 0.95-1.05

  // Price action component
  let priceScore = 0;
  if (priceAction) {
    const { ltp, open, prevClose } = priceAction;
    const changeFromPrevClose = ((ltp - prevClose) / prevClose) * 100;
    const changeFromOpen = ((ltp - open) / open) * 100;
    // Each can contribute ±20 points
    priceScore = Math.max(-40, Math.min(40, changeFromPrevClose * 20 + changeFromOpen * 10));
  }

  // OI Buildup component
  let oiScore = 0;
  if (oiData && (oiData.longCount + oiData.shortCount) > 0) {
    const netOI = oiData.longCount - oiData.shortCount;
    oiScore = Math.max(-20, Math.min(20, netOI * 5));
  }

  const rawScore = pcrScore + priceScore + oiScore;
  const score = Math.max(-100, Math.min(100, Math.round(rawScore)));

  const side =
    score >= 60 ? "STRONG BUY" :
    score >= 30 ? "BUY" :
    score >= 10 ? "MILD BUY" :
    score <= -60 ? "STRONG SELL" :
    score <= -30 ? "SELL" :
    score <= -10 ? "MILD SELL" :
    "NEUTRAL";

  const optionsBias =
    score >= 30 ? "Call Bias" :
    score >= 10 ? "Slight Call Bias" :
    score <= -30 ? "Put Bias" :
    score <= -10 ? "Slight Put Bias" :
    "Balanced";

  return { score, side, optionsBias };
}

/**
 * Multi-factor bias: combines PCR + price action for better directional signal
 */
export function computeMultiFactorBias(
  pcrValue: number,
  priceAction?: { ltp: number; open: number; prevClose: number },
): { bias: "BULLISH" | "BEARISH" | "NEUTRAL"; strength: "STRONG" | "MODERATE" | "MILD" | "NEUTRAL"; confidence: number } {
  let bullPoints = 0;
  let bearPoints = 0;

  // PCR signal (strongest weight)
  if (pcrValue > 1.2) bullPoints += 3;
  else if (pcrValue > 1.05) bullPoints += 2;
  else if (pcrValue > 1.0) bullPoints += 1;
  if (pcrValue < 0.8) bearPoints += 3;
  else if (pcrValue < 0.95) bearPoints += 2;
  else if (pcrValue < 1.0) bearPoints += 1;

  // Price action signals
  if (priceAction) {
    const { ltp, open, prevClose } = priceAction;
    // LTP vs prev close
    if (ltp > prevClose * 1.003) bullPoints += 2;
    else if (ltp > prevClose) bullPoints += 1;
    if (ltp < prevClose * 0.997) bearPoints += 2;
    else if (ltp < prevClose) bearPoints += 1;

    // LTP vs today's open
    if (ltp > open * 1.002) bullPoints += 1;
    if (ltp < open * 0.998) bearPoints += 1;

    // Gap analysis
    if (open > prevClose * 1.003) bullPoints += 1; // gap up
    if (open < prevClose * 0.997) bearPoints += 1; // gap down
  }

  const net = bullPoints - bearPoints;
  const total = bullPoints + bearPoints;
  const baseConfidence = total > 0 ? Math.round((Math.abs(net) / total) * 50 + 50) : 50;

  if (net >= 4) return { bias: "BULLISH", strength: "STRONG", confidence: Math.min(90, baseConfidence) };
  if (net >= 2) return { bias: "BULLISH", strength: "MODERATE", confidence: baseConfidence };
  if (net >= 1) return { bias: "BULLISH", strength: "MILD", confidence: baseConfidence };
  if (net <= -4) return { bias: "BEARISH", strength: "STRONG", confidence: Math.min(90, baseConfidence) };
  if (net <= -2) return { bias: "BEARISH", strength: "MODERATE", confidence: baseConfidence };
  if (net <= -1) return { bias: "BEARISH", strength: "MILD", confidence: baseConfidence };

  return { bias: "NEUTRAL", strength: "NEUTRAL", confidence: 50 };
}

const FALLBACK_ATR_PCT = 0.008;
const FALLBACK_RANGE_PCT = 0.006;

export interface GenerateSignalOpts {
  pdh?: number;
  pdl?: number;
  pdc?: number;
  atr?: number;
  strikeStep?: number;
  greekDelta?: number;
  priceAction?: { ltp: number; open: number; prevClose: number; high: number; low: number };
  oiData?: { longCount: number; shortCount: number };
}

/**
 * Generate signal from PCR with multi-factor bias
 */
export function generateSignalFromPCR(
  pcrValue: number,
  underlyingValue: number,
  maxPainStrike?: number,
  opts?: GenerateSignalOpts
): StrategySignal {
  const mp = maxPainStrike ?? underlyingValue;
  const atr = opts?.atr ?? underlyingValue * FALLBACK_ATR_PCT;
  const pdh = opts?.pdh ?? underlyingValue * (1 + FALLBACK_RANGE_PCT);
  const pdl = opts?.pdl ?? underlyingValue * (1 - FALLBACK_RANGE_PCT);
  const pdc = opts?.pdc ?? underlyingValue;
  const strikeStep = opts?.strikeStep ?? 50;

  // Use multi-factor bias instead of PCR-only
  const { bias, strength, confidence } = computeMultiFactorBias(pcrValue, opts?.priceAction);

  const pcr: PCRResult = {
    value: pcrValue,
    bias: pcrValue > 1.05 ? "BULLISH" : pcrValue < 0.95 ? "BEARISH" : "NEUTRAL",
    callOI: 0,
    putOI: 0,
  };

  return generateSignal(pcr, mp, underlyingValue, {
    ...opts,
    atr,
    pdh,
    pdl,
    pdc,
    strikeStep,
    overrideBias: bias,
    overrideStrength: strength,
    overrideConfidence: confidence,
  });
}

export function generateSignal(
  pcr: PCRResult,
  maxPainStrike: number,
  underlyingValue: number,
  opts?: GenerateSignalOpts & {
    overrideBias?: "BULLISH" | "BEARISH" | "NEUTRAL";
    overrideStrength?: "STRONG" | "MODERATE" | "MILD" | "NEUTRAL";
    overrideConfidence?: number;
  }
): StrategySignal {
  const strikeStep = opts?.strikeStep ?? 50;
  const atr = opts?.atr ?? underlyingValue * FALLBACK_ATR_PCT;
  const pdh = opts?.pdh ?? underlyingValue * (1 + FALLBACK_RANGE_PCT);
  const pdl = opts?.pdl ?? underlyingValue * (1 - FALLBACK_RANGE_PCT);
  const pdc = opts?.pdc ?? underlyingValue;

  const bias = opts?.overrideBias ?? pcr.bias;
  const biasStrength = opts?.overrideStrength ?? (bias === "NEUTRAL" ? "NEUTRAL" : "MODERATE");
  const confidence = opts?.overrideConfidence ?? 50;

  const entry = underlyingValue;

  // Always compute targets for the active bias
  const targets = computeTargetsStops(entry, atr, bias, strikeStep);

  // Also compute both-side targets so the UI can show them when NEUTRAL
  const bullishTargets = computeTargetsStops(entry, atr, "BULLISH", strikeStep);
  const bearishTargets = computeTargetsStops(entry, atr, "BEARISH", strikeStep);

  const optionsAdvisor = computeOptionsAdvisor(
    underlyingValue,
    atr,
    bias,
    strikeStep,
    "Balanced",
    opts?.greekDelta
  );

  const srLevels = computeSRLevels(pdh, pdl, pdc);
  const sentiment = computeSentiment(pcr.value, opts?.priceAction, opts?.oiData);

  const strengthLabel = biasStrength !== "NEUTRAL" ? ` (${biasStrength})` : "";
  const biasLabel = bias === "NEUTRAL" ? "Sideways" : bias;

  const summary = `${biasLabel}${strengthLabel} | PCR ${pcr.value.toFixed(2)} | Max Pain: ${maxPainStrike} | Confidence: ${confidence}%`;

  return {
    bias,
    biasStrength,
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
    targets: bias !== "NEUTRAL" ? targets : undefined,
    bullishTargets,
    bearishTargets,
    optionsAdvisor,
    srLevels,
    sentiment,
  };
}
