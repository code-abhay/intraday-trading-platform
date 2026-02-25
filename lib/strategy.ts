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
  confidence: number;
  pcr: PCRResult;
  maxPain: number;
  summary: string;
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

/**
 * Generate intraday bias and signal from PCR value only (e.g. from Angel One)
 */
export function generateSignalFromPCR(
  pcrValue: number,
  underlyingValue: number,
  maxPainStrike?: number
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
  return generateSignal(pcr, mp, underlyingValue);
}

/**
 * Generate intraday bias and signal from PCR + OI
 */
export function generateSignal(
  pcr: PCRResult,
  maxPainStrike: number,
  underlyingValue: number
): StrategySignal {
  const pointsPerLevel = 50;
  const entry = underlyingValue;
  const stopLoss =
    pcr.bias === "BULLISH"
      ? underlyingValue - pointsPerLevel
      : pcr.bias === "BEARISH"
        ? underlyingValue + pointsPerLevel
        : underlyingValue;
  const target =
    pcr.bias === "BULLISH"
      ? underlyingValue + pointsPerLevel * 2
      : pcr.bias === "BEARISH"
        ? underlyingValue - pointsPerLevel * 2
        : underlyingValue;

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
    stopLoss,
    target,
    confidence,
    pcr,
    maxPain: maxPainStrike,
    summary,
  };
}
