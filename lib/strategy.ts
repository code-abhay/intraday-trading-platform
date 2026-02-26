import type { OptionChainRow } from "@/app/api/option-chain/route";

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
  score: number;       // 0-7
  max: number;         // always 7
  label: string;       // STRONG / MODERATE / WEAK
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
  t1Pct: number; // 30
  t2Pct: number; // 40
  t3Pct: number; // 30
  t1Lots: number;
  t2Lots: number;
  t3Lots: number;
  totalLots: number;
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
  moneyness: string; // ITM / ATM / OTM
  recommendation: string;
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
}

// ---------- NSE Option Chain functions ----------

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

// ---------- Volatility Regime (from Pine: atr/atr_sma ratio) ----------

const HIGH_VOL_THRESHOLD = 1.5;
const LOW_VOL_THRESHOLD = 0.7;

export function computeVolatility(
  atr: number,
  atrSma: number,
  baseStopMult = 1.1
): VolatilityInfo {
  const ratio = atrSma > 0 ? atr / atrSma : 1;
  let regime: VolRegime = "NORMAL";
  if (ratio > HIGH_VOL_THRESHOLD) regime = "HIGH";
  else if (ratio < LOW_VOL_THRESHOLD) regime = "LOW";

  // Pine: dynamic_atr_mult = HIGH ? 1.3x : LOW ? 0.8x : 1x
  const dynamicStopMult = regime === "HIGH" ? baseStopMult * 1.3
    : regime === "LOW" ? baseStopMult * 0.8
    : baseStopMult;

  // Pine: dynamic_target1 = HIGH ? 0.8x : LOW ? 1.2x : 1x (tighter targets in high vol)
  const dynamicTargetMult = regime === "HIGH" ? 0.8 : regime === "LOW" ? 1.2 : 1.0;

  return { atr, atrSma, ratio: parseFloat(ratio.toFixed(2)), regime, dynamicStopMult, dynamicTargetMult };
}

// ---------- Signal Strength (Pine: 0-7 composite) ----------

export interface PriceAction {
  ltp: number;
  open: number;
  prevClose: number;
  high: number;
  low: number;
}

export function computeSignalStrength(
  pcrValue: number,
  priceAction?: PriceAction,
  volRegime?: VolRegime,
  oiLongCount?: number,
  oiShortCount?: number,
): SignalStrength {
  const components: { name: string; ok: boolean }[] = [];

  // 1. Trend (EMA proxy: LTP vs prev close direction)
  const trendOk = priceAction ? priceAction.ltp > priceAction.prevClose : false;
  components.push({ name: "Trend (LTP > PrevClose)", ok: trendOk });

  // 2. RSI proxy: momentum (LTP vs Open)
  const rsiOk = priceAction ? Math.abs(priceAction.ltp - priceAction.open) / priceAction.open > 0.001 : false;
  components.push({ name: "Momentum (RSI proxy)", ok: rsiOk });

  // 3. MACD proxy: price above/below VWAP-like mid (open+prev close)/2
  const mid = priceAction ? (priceAction.open + priceAction.prevClose) / 2 : 0;
  const macdOk = priceAction ? priceAction.ltp > mid || priceAction.ltp < mid * 0.998 : false;
  components.push({ name: "MACD proxy", ok: macdOk });

  // 4. ADX proxy: range expansion (today's range vs average)
  const adxOk = priceAction ? (priceAction.high - priceAction.low) / priceAction.prevClose > 0.003 : false;
  components.push({ name: "ADX (range expansion)", ok: adxOk });

  // 5. VWAP proxy: price position relative to day mid
  const dayMid = priceAction ? (priceAction.high + priceAction.low) / 2 : 0;
  const vwapOk = priceAction ? priceAction.ltp !== dayMid : false;
  components.push({ name: "VWAP proxy", ok: vwapOk });

  // 6. Volume/OI activity
  const volOk = (oiLongCount ?? 0) + (oiShortCount ?? 0) > 0;
  components.push({ name: "OI Activity", ok: volOk });

  // 7. PCR not perfectly neutral
  const pcrOk = Math.abs(pcrValue - 1.0) > 0.02;
  components.push({ name: "PCR Signal", ok: pcrOk });

  const score = components.filter((c) => c.ok).length;
  const label = score >= 6 ? "STRONG" : score >= 4 ? "MODERATE" : "WEAK";
  return { score, max: 7, label, components };
}

// ---------- Weighted Sentiment (Pine Script approach) ----------

export function computeSentiment(
  pcrValue: number,
  priceAction?: PriceAction,
  oiData?: { longCount: number; shortCount: number },
  volRegime?: VolRegime,
): Sentiment {
  const comps: { name: string; score: number; weight: number }[] = [];

  // RSI proxy (25% weight): price momentum
  let rsiScore = 0;
  if (priceAction) {
    const changePct = ((priceAction.ltp - priceAction.prevClose) / priceAction.prevClose) * 100;
    rsiScore = Math.max(-100, Math.min(100, changePct * 30));
  }
  comps.push({ name: "RSI (momentum)", score: Math.round(rsiScore), weight: 0.25 });

  // MACD proxy (20%): short-term direction
  let macdScore = 0;
  if (priceAction) {
    const changeFromOpen = ((priceAction.ltp - priceAction.open) / priceAction.open) * 100;
    macdScore = Math.max(-50, Math.min(50, changeFromOpen * 25));
  }
  comps.push({ name: "MACD (direction)", score: Math.round(macdScore), weight: 0.20 });

  // EMA proxy (25%): trend direction from PCR + price
  let emaScore = 0;
  if (pcrValue > 1.05) emaScore = 30;
  else if (pcrValue < 0.95) emaScore = -30;
  if (priceAction && priceAction.ltp > priceAction.prevClose) emaScore += 15;
  else if (priceAction && priceAction.ltp < priceAction.prevClose) emaScore -= 15;
  comps.push({ name: "EMA (trend)", score: Math.round(emaScore), weight: 0.25 });

  // VWAP proxy (15%): position relative to day's range
  let vwapScore = 0;
  if (priceAction) {
    const range = priceAction.high - priceAction.low;
    if (range > 0) {
      const pos = (priceAction.ltp - priceAction.low) / range; // 0 to 1
      vwapScore = (pos - 0.5) * 40; // -20 to +20
    }
  }
  comps.push({ name: "VWAP (position)", score: Math.round(vwapScore), weight: 0.15 });

  // ADX proxy (10%): trend strength from OI
  let adxScore = 0;
  if (oiData) {
    const net = oiData.longCount - oiData.shortCount;
    adxScore = net * 7;
  }
  comps.push({ name: "ADX (OI strength)", score: Math.round(Math.max(-20, Math.min(20, adxScore))), weight: 0.10 });

  // Volatility regime (5%)
  let volScore = volRegime === "HIGH" ? -10 : volRegime === "LOW" ? 10 : 0;
  comps.push({ name: "Vol Regime", score: volScore, weight: 0.05 });

  const rawScore = comps.reduce((sum, c) => sum + c.score * c.weight, 0);
  const score = Math.max(-100, Math.min(100, Math.round(rawScore)));

  const side =
    score >= 40 ? "STRONG BUY" :
    score >= 20 ? "BUY" :
    score >= 5 ? "MILD BUY" :
    score <= -40 ? "STRONG SELL" :
    score <= -20 ? "SELL" :
    score <= -5 ? "MILD SELL" :
    "NEUTRAL";

  const optionsBias =
    score >= 20 ? "Call Bias" :
    score >= 5 ? "Slight Call Bias" :
    score <= -20 ? "Put Bias" :
    score <= -5 ? "Slight Put Bias" :
    "Balanced";

  const momentum =
    score > 20 ? "BULLISH" :
    score > 0 ? "Bullish Tilt" :
    score < -20 ? "BEARISH" :
    score < 0 ? "Bearish Tilt" :
    "FLAT";

  return { score, side, optionsBias, momentum, components: comps };
}

// ---------- Multi-factor Bias ----------

export function computeMultiFactorBias(
  pcrValue: number,
  priceAction?: PriceAction,
): { bias: "BULLISH" | "BEARISH" | "NEUTRAL"; strength: "STRONG" | "MODERATE" | "MILD" | "NEUTRAL"; confidence: number } {
  let bullPoints = 0;
  let bearPoints = 0;

  if (pcrValue > 1.2) bullPoints += 3;
  else if (pcrValue > 1.05) bullPoints += 2;
  else if (pcrValue > 1.0) bullPoints += 1;
  if (pcrValue < 0.8) bearPoints += 3;
  else if (pcrValue < 0.95) bearPoints += 2;
  else if (pcrValue < 1.0) bearPoints += 1;

  if (priceAction) {
    const { ltp, open, prevClose } = priceAction;
    if (ltp > prevClose * 1.003) bullPoints += 2;
    else if (ltp > prevClose) bullPoints += 1;
    if (ltp < prevClose * 0.997) bearPoints += 2;
    else if (ltp < prevClose) bearPoints += 1;
    if (ltp > open * 1.002) bullPoints += 1;
    if (ltp < open * 0.998) bearPoints += 1;
    if (open > prevClose * 1.003) bullPoints += 1;
    if (open < prevClose * 0.997) bearPoints += 1;
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

// ---------- Targets & Stops (Pine: ATR-based with dynamic multiplier) ----------

const BASE_STOP_MULT = 1.1;
const T1_RATIO = 1.5;  // Pine: target1_atr_mult / atr_mult_stop
const T2_RATIO = 3.0;
const T3_RATIO = 5.0;
const TRAIL_ATR_MULT = 0.8; // Pine default

export function computeTargetsStops(
  entry: number,
  atr: number,
  bias: "BULLISH" | "BEARISH" | "NEUTRAL",
  strikeStep = 50,
  volInfo?: VolatilityInfo,
): TargetsStops {
  const stopMult = volInfo?.dynamicStopMult ?? BASE_STOP_MULT;
  const targetMult = volInfo?.dynamicTargetMult ?? 1.0;

  const slPoints = Math.max(atr * stopMult, strikeStep * 0.5);
  const isLong = bias === "BULLISH";
  const isShort = bias === "BEARISH";

  const snap = (v: number) => Math.round(v / strikeStep) * strikeStep;

  if (isLong) {
    const sl = entry - slPoints;
    const risk = entry - sl;
    return {
      entry,
      stopLoss: snap(sl),
      t1: snap(entry + risk * T1_RATIO * targetMult),
      t2: snap(entry + risk * T2_RATIO * targetMult),
      t3: snap(entry + risk * T3_RATIO * targetMult),
      trailingStop: snap(entry - atr * TRAIL_ATR_MULT),
      slPoints: parseFloat(slPoints.toFixed(1)),
      rr1: parseFloat((T1_RATIO * targetMult).toFixed(2)),
      rr2: parseFloat((T2_RATIO * targetMult).toFixed(2)),
      rr3: parseFloat((T3_RATIO * targetMult).toFixed(2)),
    };
  }
  if (isShort) {
    const sl = entry + slPoints;
    const risk = sl - entry;
    return {
      entry,
      stopLoss: snap(sl),
      t1: snap(entry - risk * T1_RATIO * targetMult),
      t2: snap(entry - risk * T2_RATIO * targetMult),
      t3: snap(entry - risk * T3_RATIO * targetMult),
      trailingStop: snap(entry + atr * TRAIL_ATR_MULT),
      slPoints: parseFloat(slPoints.toFixed(1)),
      rr1: parseFloat((T1_RATIO * targetMult).toFixed(2)),
      rr2: parseFloat((T2_RATIO * targetMult).toFixed(2)),
      rr3: parseFloat((T3_RATIO * targetMult).toFixed(2)),
    };
  }
  return { entry, stopLoss: entry, t1: entry, t2: entry, t3: entry, trailingStop: entry, slPoints: 0, rr1: 0, rr2: 0, rr3: 0 };
}

// ---------- Partial Exit Plan (Pine: 30/40/30) ----------

export function computePartialExits(riskPerTrade = 2000, slPoints: number, rupeesPerPoint = 50): PartialExitPlan {
  const perLotRisk = slPoints * rupeesPerPoint;
  const totalLots = perLotRisk > 0 ? Math.max(1, Math.min(10, Math.floor(riskPerTrade / perLotRisk))) : 1;
  const t1Pct = 30;
  const t2Pct = 40;
  const t3Pct = 30;
  const t1Lots = Math.max(1, Math.floor(totalLots * t1Pct / 100));
  const t2Lots = Math.max(1, Math.floor(totalLots * t2Pct / 100));
  const t3Lots = Math.max(1, totalLots - t1Lots - t2Lots);
  return { t1Pct, t2Pct, t3Pct, t1Lots, t2Lots, t3Lots, totalLots };
}

// ---------- Options Advisor (Pine: 4 strike modes + delta estimation) ----------

function estimateDelta(strike: number, currentPrice: number, isCall: boolean, volRegime: VolRegime = "NORMAL"): number {
  // Pine: moneyness-based delta estimation
  const moneyness = isCall
    ? (currentPrice - strike) / currentPrice
    : (strike - currentPrice) / currentPrice;

  let baseDelta = moneyness > 0.02 ? 0.7
    : moneyness > -0.02 ? 0.5
    : moneyness > -0.05 ? 0.3
    : 0.15;

  const volAdj = volRegime === "HIGH" ? 1.1 : volRegime === "LOW" ? 0.9 : 1.0;
  return parseFloat(Math.max(0.1, Math.min(0.9, baseDelta * volAdj)).toFixed(4));
}

export function computeOptionsAdvisor(
  underlying: number,
  atr: number,
  bias: "BULLISH" | "BEARISH" | "NEUTRAL",
  strikeStep = 50,
  mode: StrikeMode = "Balanced",
  volRegime: VolRegime = "NORMAL",
  realDelta?: number,
  realIV?: number,
): OptionsAdvisor {
  const baseStrike = Math.round(underlying / strikeStep) * strikeStep;
  const effectiveBias = bias === "NEUTRAL" ? "BULLISH" : bias;
  const isBullish = effectiveBias === "BULLISH";

  // Pine: strike selection based on mode
  let strike: number;
  if (mode === "High Delta") {
    // ITM for higher delta / responsiveness
    strike = isBullish
      ? Math.round((underlying - strikeStep) / strikeStep) * strikeStep
      : Math.round((underlying + strikeStep) / strikeStep) * strikeStep;
  } else if (mode === "ATM") {
    strike = baseStrike;
  } else if (mode === "OTM Aggressive") {
    // OTM for better R:R
    const dist = atr * 1.5;
    strike = isBullish
      ? Math.round((underlying + dist) / strikeStep) * strikeStep
      : Math.round((underlying - dist) / strikeStep) * strikeStep;
  } else {
    // Balanced: slight OTM
    const dist = atr * 0.7;
    strike = isBullish
      ? Math.round((underlying + dist) / strikeStep) * strikeStep
      : Math.round((underlying - dist) / strikeStep) * strikeStep;
  }

  const isCall = isBullish;
  const delta = realDelta ?? estimateDelta(strike, underlying, isCall, volRegime);

  // Premium estimation (Pine approach)
  const intrinsic = isCall ? Math.max(0, underlying - strike) : Math.max(0, strike - underlying);
  const basePremMult = 0.02; // Pine: premium_base_mult
  const volAdj = volRegime === "HIGH" ? 1.5 : volRegime === "LOW" ? 0.7 : 1.0;
  const timeValue = strike * basePremMult * volAdj * (atr / underlying);
  const premium = Math.round(intrinsic + timeValue);

  // IV estimation
  const iv = realIV ?? (volRegime === "HIGH" ? 22 : volRegime === "LOW" ? 12 : 16);

  // Theta (Pine: time decay per day)
  const now = new Date();
  const day = now.getDay();
  const daysToThursday = (4 - day + 7) % 7;
  const daysToExpiry = daysToThursday === 0 ? 7 : daysToThursday;
  const theta = parseFloat((-premium / Math.max(1, daysToExpiry) * 0.6).toFixed(2));

  // Moneyness label
  const diff = isCall ? underlying - strike : strike - underlying;
  const moneyness = diff > strikeStep * 0.5 ? "ITM" : Math.abs(diff) < strikeStep * 0.5 ? "ATM" : "OTM";

  const side: OptionsAdvisor["side"] = bias === "NEUTRAL" ? "BALANCED" : isBullish ? "CALL" : "PUT";

  const recommendation = bias === "NEUTRAL"
    ? "WAIT / Straddle"
    : `BUY ${strike} ${side} @ ~₹${premium}`;

  return {
    strike, side, premium, delta, mode, daysToExpiry,
    iv: parseFloat(iv.toFixed(1)),
    theta,
    moneyness,
    recommendation,
  };
}

// ---------- S/R Levels ----------

export function computeSRLevels(pdh: number, pdl: number, pdc: number): SRLevels {
  const pivot = (pdh + pdl + pdc) / 3;
  const cprTC = (pdh + pdl) / 2;
  const cprBC = pivot - (cprTC - pivot);
  const range = pdh - pdl;
  return {
    pdh, pdl, pdc, pivot, cprTC, cprBC,
    r1: 2 * pivot - pdl,
    r2: pivot + range,
    s1: 2 * pivot - pdh,
    s2: pivot - range,
    camH3: pdc + range * 1.1 / 4,
    camL3: pdc - range * 1.1 / 4,
  };
}

// ---------- Signal Generator ----------

const FALLBACK_ATR_PCT = 0.008;
const FALLBACK_RANGE_PCT = 0.006;

export interface GenerateSignalOpts {
  pdh?: number;
  pdl?: number;
  pdc?: number;
  atr?: number;
  atrSma?: number;
  strikeStep?: number;
  greekDelta?: number;
  greekIV?: number;
  priceAction?: PriceAction;
  oiData?: { longCount: number; shortCount: number };
  dailyRanges?: number[]; // last N daily ranges for ATR SMA
}

export function generateSignalFromPCR(
  pcrValue: number,
  underlyingValue: number,
  maxPainStrike?: number,
  opts?: GenerateSignalOpts,
): StrategySignal {
  const mp = maxPainStrike ?? underlyingValue;
  const atr = opts?.atr ?? underlyingValue * FALLBACK_ATR_PCT;
  const pdh = opts?.pdh ?? underlyingValue * (1 + FALLBACK_RANGE_PCT);
  const pdl = opts?.pdl ?? underlyingValue * (1 - FALLBACK_RANGE_PCT);
  const pdc = opts?.pdc ?? underlyingValue;
  const strikeStep = opts?.strikeStep ?? 50;

  const { bias, strength, confidence } = computeMultiFactorBias(pcrValue, opts?.priceAction);

  const pcr: PCRResult = {
    value: pcrValue,
    bias: pcrValue > 1.05 ? "BULLISH" : pcrValue < 0.95 ? "BEARISH" : "NEUTRAL",
    callOI: 0, putOI: 0,
  };

  // Volatility regime
  const atrSma = opts?.atrSma ?? atr;
  const volInfo = computeVolatility(atr, atrSma);

  // Signal strength
  const signalStrength = computeSignalStrength(
    pcrValue, opts?.priceAction, volInfo.regime,
    opts?.oiData?.longCount, opts?.oiData?.shortCount,
  );

  const entry = underlyingValue;
  const targets = computeTargetsStops(entry, atr, bias, strikeStep, volInfo);
  const bullishTargets = computeTargetsStops(entry, atr, "BULLISH", strikeStep, volInfo);
  const bearishTargets = computeTargetsStops(entry, atr, "BEARISH", strikeStep, volInfo);

  const optionsAdvisor = computeOptionsAdvisor(
    underlyingValue, atr, bias, strikeStep, "Balanced", volInfo.regime,
    opts?.greekDelta, opts?.greekIV,
  );

  const srLevels = computeSRLevels(pdh, pdl, pdc);
  const sentiment = computeSentiment(pcrValue, opts?.priceAction, opts?.oiData, volInfo.regime);

  const partialExits = bias !== "NEUTRAL"
    ? computePartialExits(2000, targets.slPoints)
    : undefined;

  const tradeDirection = bias === "BULLISH" ? "Long Only"
    : bias === "BEARISH" ? "Short Only"
    : "Both (Wait)";

  const strengthLabel = strength !== "NEUTRAL" ? ` (${strength})` : "";
  const biasLabel = bias === "NEUTRAL" ? "Sideways" : bias;
  const summary = `${biasLabel}${strengthLabel} | PCR ${pcrValue.toFixed(2)} | Strength: ${signalStrength.score}/${signalStrength.max} | Vol: ${volInfo.regime} | Max Pain: ${mp}`;

  return {
    bias, biasStrength: strength, entry, confidence,
    stopLoss: targets.stopLoss, target: targets.t3,
    t1: targets.t1, t2: targets.t2, t3: targets.t3,
    trailingStop: targets.trailingStop,
    pcr, maxPain: mp, summary,
    targets: bias !== "NEUTRAL" ? targets : undefined,
    bullishTargets, bearishTargets,
    optionsAdvisor, srLevels, sentiment,
    signalStrength, volatility: volInfo, partialExits, tradeDirection,
  };
}

export function generateSignal(
  pcr: PCRResult,
  maxPainStrike: number,
  underlyingValue: number,
  opts?: GenerateSignalOpts,
): StrategySignal {
  return generateSignalFromPCR(pcr.value, underlyingValue, maxPainStrike, opts);
}
