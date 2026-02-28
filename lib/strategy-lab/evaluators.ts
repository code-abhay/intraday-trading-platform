import type { SegmentId } from "@/lib/segments";
import {
  adx,
  aroon,
  atr,
  bearishDivergence,
  bollingerBands,
  bullishDivergence,
  crossedAbove,
  crossedBelow,
  ema,
  fibLevelsFromRange,
  highest,
  ichimoku,
  initialBalanceRange,
  lowest,
  macd,
  mfi,
  obv,
  parabolicSar,
  resampleCandles,
  rsi,
  sessionVWAP,
  sma,
  stochastic,
  supertrend,
  volumeStructureNodes,
} from "@/lib/strategy-lab/indicators";
import { STRATEGY_LAB_RULES, STRATEGY_LAB_RULES_BY_ID } from "@/lib/strategy-lab/rules";
import type {
  ExecutionProfile,
  LabCandle,
  LabOIBuildupPoint,
  LabSnapshot,
  RollingWindowEvaluation,
  SimulatedTrade,
  StrategyActivityDiagnostics,
  StrategyDuplicatePair,
  StrategyDuplicateSummary,
  StrategyConsistencyMetrics,
  StrategyEvaluation,
  StrategyId,
  StrategyKpis,
  StrategyRuleSpec,
  TradeDirection,
  TradeOutcome,
} from "@/lib/strategy-lab/types";

type TrailingMode = "NONE" | "EMA9" | "EMA21" | "SUPERTREND";

interface SignalCandidate {
  direction: TradeDirection;
  confidence: number;
  reason: string;
  stopLoss: number;
  trailingMode: TrailingMode;
  validateWithinBars?: number;
  postEntryAdxMin?: number;
}

type SignalDetectionResult =
  | SignalCandidate
  | {
      candidate: null;
      rejectionReason: string;
    };

interface HigherAlignedSeries {
  ema9: number[];
  ema21: number[];
  adx: number[];
  close: number[];
}

interface PreparedSeries {
  candles: LabCandle[];
  timeMs: number[];
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
  ema9: number[];
  ema21: number[];
  rsi14: number[];
  mfi14: number[];
  atr14: number[];
  adx14: number[];
  aroonUp: number[];
  aroonDown: number[];
  macdLine: number[];
  macdSignal: number[];
  macdHist: number[];
  ichimokuTenkan: number[];
  ichimokuKijun: number[];
  ichimokuSpanA: number[];
  ichimokuSpanB: number[];
  bollingerUpper: number[];
  bollingerLower: number[];
  bollingerWidthPct: number[];
  ibHigh: number[];
  ibLow: number[];
  hvn: number[];
  lvn: number[];
  volumeVacuum: number[];
  obv: number[];
  supertrendLine: number[];
  supertrendTrend: Array<1 | -1>;
  sar: number[];
  sarTrend: Array<1 | -1>;
  stochasticK: number[];
  stochasticD: number[];
  vwap: number[];
  volumeSma20: number[];
  snapshotsAligned: Array<LabSnapshot | null>;
  oiAligned: Array<LabOIBuildupPoint | null>;
  higher: Record<number, HigherAlignedSeries>;
}

interface ActiveTrade {
  strategyId: StrategyId;
  segment: SegmentId;
  direction: TradeDirection;
  entryIndex: number;
  entryTime: string;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskPoints: number;
  trailingMode: TrailingMode;
  maxBarsInTrade: number;
  signalReason: string;
  reachedOneR: boolean;
  validationDeadlineIndex?: number;
  requiredAdxAfterEntry?: number;
}

interface SimulateResult {
  trades: SimulatedTrade[];
  activity: StrategyActivityDiagnostics;
}

export const DUPLICATE_SIMILARITY_THRESHOLD = 72;

function toMs(time: string): number {
  const t = new Date(time).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function dateKey(time: string): string {
  return time.slice(0, 10);
}

function round2(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    Math.max(1, values.length - 1);
  return Math.sqrt(variance);
}

function adjusted(profile: ExecutionProfile, strictValue: number, balancedValue: number): number {
  return profile === "strict" ? strictValue : balancedValue;
}

function countTrue(values: boolean[]): number {
  return values.filter(Boolean).length;
}

function passesChecks(
  profile: ExecutionProfile,
  checks: boolean[],
  requiredIndexes: number[],
  strictMin: number,
  balancedMin: number
): boolean {
  for (const idx of requiredIndexes) {
    if (!checks[idx]) return false;
  }
  const minNeeded = profile === "strict" ? strictMin : balancedMin;
  return countTrue(checks) >= minNeeded;
}

function istMinutesFromStart(candleTime: string): number {
  const date = new Date(candleTime);
  const ms = date.getTime();
  if (Number.isNaN(ms)) return 0;
  const ist = new Date(ms + 330 * 60 * 1000);
  const totalMinutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const sessionStart = 9 * 60 + 15;
  return totalMinutes - sessionStart;
}

function getWindowBounds(fromIso: string, toIso: string): Array<{ from: string; to: string }> {
  const fromMs = toMs(fromIso);
  const toMsValue = toMs(toIso);
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMsValue) || toMsValue <= fromMs) {
    return [];
  }
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const windows: Array<{ from: string; to: string }> = [];
  let currentFrom = fromMs;
  while (currentFrom < toMsValue) {
    const currentTo = Math.min(toMsValue, currentFrom + weekMs);
    windows.push({
      from: new Date(currentFrom).toISOString(),
      to: new Date(currentTo).toISOString(),
    });
    currentFrom += weekMs;
  }
  return windows;
}

function alignByTime<T extends { time: string }>(
  targetMs: number[],
  rows: T[]
): Array<T | null> {
  if (targetMs.length === 0 || rows.length === 0) {
    return targetMs.map(() => null);
  }

  const sorted = [...rows].sort((a, b) => toMs(a.time) - toMs(b.time));
  const sortedMs = sorted.map((row) => toMs(row.time));
  const out: Array<T | null> = [];
  let pointer = -1;

  for (const t of targetMs) {
    while (pointer + 1 < sortedMs.length && sortedMs[pointer + 1] <= t) {
      pointer += 1;
    }
    out.push(pointer >= 0 ? sorted[pointer] : null);
  }

  return out;
}

function alignHigherSeries(
  baseOneMinuteCandles: LabCandle[],
  executionMs: number[],
  intervalMin: number
): HigherAlignedSeries {
  const higher = resampleCandles(baseOneMinuteCandles, intervalMin);
  if (higher.length === 0) {
    const blank = executionMs.map(() => 0);
    return { ema9: blank, ema21: blank, adx: blank, close: blank };
  }
  const closes = higher.map((c) => c.close);
  const higherEma9 = ema(closes, 9);
  const higherEma21 = ema(closes, 21);
  const higherAdx = adx(higher, 14);
  const higherMs = higher.map((c) => toMs(c.time));

  const alignedEma9: number[] = [];
  const alignedEma21: number[] = [];
  const alignedAdx: number[] = [];
  const alignedClose: number[] = [];
  let j = 0;

  for (const ms of executionMs) {
    while (j + 1 < higherMs.length && higherMs[j + 1] <= ms) j += 1;
    alignedEma9.push(higherEma9[j] ?? higherEma9[higherEma9.length - 1] ?? 0);
    alignedEma21.push(higherEma21[j] ?? higherEma21[higherEma21.length - 1] ?? 0);
    alignedAdx.push(higherAdx[j] ?? higherAdx[higherAdx.length - 1] ?? 0);
    alignedClose.push(closes[j] ?? closes[closes.length - 1] ?? 0);
  }

  return {
    ema9: alignedEma9,
    ema21: alignedEma21,
    adx: alignedAdx,
    close: alignedClose,
  };
}

function prepareSeries(
  candlesOneMinute: LabCandle[],
  snapshots: LabSnapshot[],
  oiPoints: LabOIBuildupPoint[],
  rule: StrategyRuleSpec
): PreparedSeries | null {
  const candles = resampleCandles(candlesOneMinute, rule.engine.executionIntervalMin);
  if (candles.length < 60) return null;

  const timeMs = candles.map((c) => toMs(c.time));
  const close = candles.map((c) => c.close);
  const open = candles.map((c) => c.open);
  const high = candles.map((c) => c.high);
  const low = candles.map((c) => c.low);
  const volume = candles.map((c) => c.volume);
  const ema9 = ema(close, 9);
  const ema21 = ema(close, 21);
  const rsi14 = rsi(close, 14);
  const mfi14 = mfi(candles, 14);
  const atr14 = atr(candles, rule.engine.atrPeriod);
  const adx14 = adx(candles, 14);
  const aroonSeries = aroon(candles, 14);
  const macdSeries = macd(close, 12, 26, 9);
  const ichimokuSeries = ichimoku(candles, 9, 26, 52);
  const bands = bollingerBands(close, 20, 2);
  const ibSeries = initialBalanceRange(
    candles,
    Math.max(15, Math.round(rule.engine.params.ibMinutes ?? 45))
  );
  const volumeStructure = volumeStructureNodes(
    candles,
    Math.max(20, Math.round(rule.engine.params.volumeNodeLookback ?? 48)),
    Math.max(8, Math.round(rule.engine.params.volumeNodeBins ?? 12))
  );
  const obvSeries = obv(candles);
  const st = supertrend(
    candles,
    Math.max(7, Math.round(rule.engine.params.supertrendAtrPeriod ?? 10)),
    Math.max(1.5, rule.engine.params.supertrendFactor ?? 3)
  );
  const sarSeries = parabolicSar(
    candles,
    Math.max(0.01, rule.engine.params.sarStep ?? 0.02),
    Math.max(0.1, rule.engine.params.sarMax ?? 0.2)
  );
  const stoch = stochastic(candles, 14, 3, 3);
  const vwap = sessionVWAP(candles);
  const volumeSma20 = sma(volume, 20);

  const higher: Record<number, HigherAlignedSeries> = {};
  for (const tf of rule.engine.higherIntervalsMin) {
    higher[tf] = alignHigherSeries(candlesOneMinute, timeMs, tf);
  }

  return {
    candles,
    timeMs,
    open,
    high,
    low,
    close,
    volume,
    ema9,
    ema21,
    rsi14,
    mfi14,
    atr14,
    adx14,
    aroonUp: aroonSeries.up,
    aroonDown: aroonSeries.down,
    macdLine: macdSeries.line,
    macdSignal: macdSeries.signal,
    macdHist: macdSeries.histogram,
    ichimokuTenkan: ichimokuSeries.tenkan,
    ichimokuKijun: ichimokuSeries.kijun,
    ichimokuSpanA: ichimokuSeries.spanA,
    ichimokuSpanB: ichimokuSeries.spanB,
    bollingerUpper: bands.upper,
    bollingerLower: bands.lower,
    bollingerWidthPct: bands.bandwidthPct,
    ibHigh: ibSeries.high,
    ibLow: ibSeries.low,
    hvn: volumeStructure.hvn,
    lvn: volumeStructure.lvn,
    volumeVacuum: volumeStructure.vacuum,
    obv: obvSeries,
    supertrendLine: st.line,
    supertrendTrend: st.trend,
    sar: sarSeries.sar,
    sarTrend: sarSeries.trend,
    stochasticK: stoch.k,
    stochasticD: stoch.d,
    vwap,
    volumeSma20,
    snapshotsAligned: alignByTime(timeMs, snapshots),
    oiAligned: alignByTime(timeMs, oiPoints),
    higher,
  };
}

function resolveStop(
  direction: TradeDirection,
  fallbackPrice: number,
  stopLoss: number
): number {
  if (direction === "LONG") {
    if (!Number.isFinite(stopLoss) || stopLoss >= fallbackPrice) {
      return fallbackPrice * 0.995;
    }
    return stopLoss;
  }
  if (!Number.isFinite(stopLoss) || stopLoss <= fallbackPrice) {
    return fallbackPrice * 1.005;
  }
  return stopLoss;
}

function confidenceFromChecks(base: number, checks: boolean[]): number {
  const ok = checks.filter(Boolean).length;
  const total = Math.max(1, checks.length);
  return Math.min(95, Math.max(40, Math.round(base + (ok / total) * 30)));
}

function detectSignal(
  strategyId: StrategyId,
  series: PreparedSeries,
  rule: StrategyRuleSpec,
  i: number,
  profile: ExecutionProfile
): SignalDetectionResult {
  if (i < 3) return { candidate: null, rejectionReason: "insufficient_bars" };
  const close = series.close[i];
  const low = series.low[i];
  const high = series.high[i];
  const ema9Now = series.ema9[i];
  const ema21Now = series.ema21[i];
  const atrNow = Math.max(0.01, series.atr14[i] ?? 0);
  const adxNow = series.adx14[i] ?? 0;
  const adxPrev = series.adx14[i - 1] ?? adxNow;
  const macdHistNow = series.macdHist[i] ?? 0;
  const macdHistPrev = series.macdHist[i - 1] ?? macdHistNow;
  const macdLine = series.macdLine;
  const macdSignal = series.macdSignal;

  const higherBullMatches = rule.engine.higherIntervalsMin.filter((tf) => {
    const h = series.higher[tf];
    return Boolean(h && h.ema9[i] > h.ema21[i] && h.close[i] >= h.ema21[i]);
  });
  const higherBearMatches = rule.engine.higherIntervalsMin.filter((tf) => {
    const h = series.higher[tf];
    return Boolean(h && h.ema9[i] < h.ema21[i] && h.close[i] <= h.ema21[i]);
  });
  const requiredHigher = profile === "strict"
    ? rule.engine.higherIntervalsMin.length
    : Math.max(1, Math.ceil(rule.engine.higherIntervalsMin.length * 0.6));
  const higherBullish = higherBullMatches.length >= requiredHigher;
  const higherBearish = higherBearMatches.length >= requiredHigher;

  switch (strategyId) {
    case "ema_macd_trend_acceleration": {
      const minAdx = adjusted(profile, rule.engine.params.minAdx ?? 25, 20);
      const invalidationAdx = adjusted(profile, rule.engine.params.invalidationAdx ?? 20, 16);
      const minSlope = adjusted(profile, rule.engine.params.minMacdHistSlope ?? 0.02, 0);
      if (adxNow < invalidationAdx) {
        return { candidate: null, rejectionReason: "adx_too_low" };
      }

      const longChecks = [
        higherBullish,
        close > ema9Now && ema9Now > ema21Now,
        adxNow >= minAdx,
        macdHistNow > 0 && macdHistNow > macdHistPrev + minSlope,
        crossedAbove(macdLine, macdSignal, i) || macdLine[i] > macdSignal[i],
      ];
      if (passesChecks(profile, longChecks, [0, 1], longChecks.length, 4)) {
        const swingLow = lowest(series.low, i, 6);
        const stop = Math.min(swingLow, close - atrNow * rule.engine.stopAtrMult);
        return {
          direction: "LONG",
          confidence: confidenceFromChecks(62, longChecks),
          reason: "EMA stack + MACD acceleration + ADX expansion",
          stopLoss: stop,
          trailingMode: "EMA9",
        };
      }

      const shortChecks = [
        higherBearish,
        close < ema9Now && ema9Now < ema21Now,
        adxNow >= minAdx,
        macdHistNow < 0 && macdHistNow < macdHistPrev - minSlope,
        crossedBelow(macdLine, macdSignal, i) || macdLine[i] < macdSignal[i],
      ];
      if (passesChecks(profile, shortChecks, [0, 1], shortChecks.length, 4)) {
        const swingHigh = highest(series.high, i, 6);
        const stop = Math.max(swingHigh, close + atrNow * rule.engine.stopAtrMult);
        return {
          direction: "SHORT",
          confidence: confidenceFromChecks(62, shortChecks),
          reason: "EMA stack + MACD downside acceleration + ADX expansion",
          stopLoss: stop,
          trailingMode: "EMA9",
        };
      }

      return { candidate: null, rejectionReason: "trend_acceleration_confluence_missing" };
    }

    case "supertrend_adx_continuation": {
      const minAdx = adjusted(profile, rule.engine.params.minAdx ?? 24, 20);
      const higherTfAdx = adjusted(profile, rule.engine.params.higherTfAdx ?? 30, 24);
      const h60 = series.higher[60];
      const h60Bull = !h60 || (h60.ema9[i] > h60.ema21[i] && h60.adx[i] >= higherTfAdx);
      const h60Bear = !h60 || (h60.ema9[i] < h60.ema21[i] && h60.adx[i] >= higherTfAdx);
      const flipBull = series.supertrendTrend[i] === 1 && series.supertrendTrend[i - 1] === -1;
      const flipBear = series.supertrendTrend[i] === -1 && series.supertrendTrend[i - 1] === 1;
      const adxRising = adxNow >= minAdx && adxNow > adxPrev;

      const longChecks = [
        h60Bull,
        flipBull,
        adxRising,
        close > ema21Now,
        close > (series.high[i - 1] ?? close),
      ];
      if (passesChecks(profile, longChecks, [1, 3], longChecks.length, 4)) {
        const stop = Math.min(
          series.supertrendLine[i] ?? close - atrNow,
          close - atrNow * rule.engine.stopAtrMult
        );
        return {
          direction: "LONG",
          confidence: confidenceFromChecks(60, longChecks),
          reason: "Supertrend bullish flip with rising ADX",
          stopLoss: stop,
          trailingMode: "SUPERTREND",
        };
      }

      const shortChecks = [
        h60Bear,
        flipBear,
        adxRising,
        close < ema21Now,
        close < (series.low[i - 1] ?? close),
      ];
      if (passesChecks(profile, shortChecks, [1, 3], shortChecks.length, 4)) {
        const stop = Math.max(
          series.supertrendLine[i] ?? close + atrNow,
          close + atrNow * rule.engine.stopAtrMult
        );
        return {
          direction: "SHORT",
          confidence: confidenceFromChecks(60, shortChecks),
          reason: "Supertrend bearish flip with rising ADX",
          stopLoss: stop,
          trailingMode: "SUPERTREND",
        };
      }

      return { candidate: null, rejectionReason: "supertrend_confluence_missing" };
    }

    case "vwap_delta_reversion": {
      const stretch = adjusted(profile, rule.engine.params.vwapStretchAtr ?? 1, 0.8);
      const divLookback = Math.round(rule.engine.params.rsiDivergenceLookback ?? 18);
      const pcrUpper = adjusted(profile, rule.engine.params.pcrUpperExtreme ?? 1.3, 1.2);
      const pcrLower = adjusted(profile, rule.engine.params.pcrLowerExtreme ?? 0.75, 0.8);
      const snapshot = series.snapshotsAligned[i];
      const pcr = snapshot?.pcr ?? null;

      let stretchedDown = false;
      let stretchedUp = false;
      for (let j = Math.max(1, i - 5); j < i; j++) {
        if (series.low[j] < series.vwap[j] - (series.atr14[j] ?? atrNow) * stretch) {
          stretchedDown = true;
        }
        if (series.high[j] > series.vwap[j] + (series.atr14[j] ?? atrNow) * stretch) {
          stretchedUp = true;
        }
      }

      const bullDiv = bullishDivergence(series.low, series.rsi14, i, divLookback);
      const bearDiv = bearishDivergence(series.high, series.rsi14, i, divLookback);
      const flowBearish =
        (snapshot?.sellQty ?? 0) > (snapshot?.buyQty ?? 0) ||
        (pcr != null && pcr >= pcrUpper);
      const flowBullish =
        (snapshot?.buyQty ?? 0) > (snapshot?.sellQty ?? 0) ||
        (pcr != null && pcr <= pcrLower);

      const longChecks = [
        stretchedDown,
        crossedAbove(series.close, series.vwap, i),
        bullDiv,
        flowBearish,
        macdHistNow > macdHistPrev,
      ];
      if (passesChecks(profile, longChecks, [0, 1], longChecks.length, 3)) {
        const stop = lowest(series.low, i, 5) - atrNow * 0.4;
        return {
          direction: "LONG",
          confidence: confidenceFromChecks(58, longChecks),
          reason: "VWAP reclaim after oversold liquidity sweep",
          stopLoss: stop,
          trailingMode: "EMA9",
        };
      }

      const shortChecks = [
        stretchedUp,
        crossedBelow(series.close, series.vwap, i),
        bearDiv,
        flowBullish,
        macdHistNow < macdHistPrev,
      ];
      if (passesChecks(profile, shortChecks, [0, 1], shortChecks.length, 3)) {
        const stop = highest(series.high, i, 5) + atrNow * 0.4;
        return {
          direction: "SHORT",
          confidence: confidenceFromChecks(58, shortChecks),
          reason: "VWAP rejection after overbought liquidity sweep",
          stopLoss: stop,
          trailingMode: "EMA9",
        };
      }

      return { candidate: null, rejectionReason: "vwap_reversion_confluence_missing" };
    }

    case "gamma_expansion_breakout": {
      const squeezeWidth = adjusted(profile, rule.engine.params.squeezeBandwidthPct ?? 0.015, 0.02);
      const adxPreMax = rule.engine.params.preBreakAdxMax ?? 20;
      const adxPostMin = adjusted(profile, rule.engine.params.postBreakAdxMin ?? 25, 20);
      const volMult = adjusted(profile, rule.engine.params.breakoutVolumeMult ?? 1.5, 1.1);

      const bw = series.bollingerWidthPct[i] ?? 1;
      const isSqueeze = bw <= squeezeWidth;
      const adxHooking = adxPrev <= adxPreMax && adxNow > adxPrev;
      const obvBreakUp = series.obv[i] > highest(series.obv, i - 1, 12);
      const obvBreakDown = series.obv[i] < lowest(series.obv, i - 1, 12);
      const volumeConfirmed = (series.volume[i] ?? 0) > (series.volumeSma20[i] ?? 0) * volMult;
      const h15 = series.higher[15];
      const h15Bull = !h15 || h15.ema9[i] > h15.ema21[i];
      const h15Bear = !h15 || h15.ema9[i] < h15.ema21[i];

      const longChecks = [
        isSqueeze,
        adxHooking,
        obvBreakUp,
        close > (series.bollingerUpper[i] ?? close),
        crossedAbove(series.ema9, series.ema21, i) || series.ema9[i] > series.ema21[i],
        close > highest(series.high, i - 1, 8),
        volumeConfirmed,
        h15Bull,
      ];
      if (passesChecks(profile, longChecks, [0, 3], longChecks.length, 5)) {
        const stop = Math.min(
          series.ema21[i] - atrNow * rule.engine.stopAtrMult,
          low - atrNow * 0.2
        );
        return {
          direction: "LONG",
          confidence: confidenceFromChecks(64, longChecks),
          reason: "Squeeze breakout with OBV and ADX expansion",
          stopLoss: stop,
          trailingMode: "EMA9",
          validateWithinBars: 3,
          postEntryAdxMin: adxPostMin,
        };
      }

      const shortChecks = [
        isSqueeze,
        adxHooking,
        obvBreakDown,
        close < (series.bollingerLower[i] ?? close),
        crossedBelow(series.ema9, series.ema21, i) || series.ema9[i] < series.ema21[i],
        close < lowest(series.low, i - 1, 8),
        volumeConfirmed,
        h15Bear,
      ];
      if (passesChecks(profile, shortChecks, [0, 3], shortChecks.length, 5)) {
        const stop = Math.max(
          series.ema21[i] + atrNow * rule.engine.stopAtrMult,
          high + atrNow * 0.2
        );
        return {
          direction: "SHORT",
          confidence: confidenceFromChecks(64, shortChecks),
          reason: "Squeeze breakdown with OBV and ADX expansion",
          stopLoss: stop,
          trailingMode: "EMA9",
          validateWithinBars: 3,
          postEntryAdxMin: adxPostMin,
        };
      }

      return { candidate: null, rejectionReason: "gamma_breakout_confluence_missing" };
    }

    case "pcr_oi_sentiment_reversal": {
      const pcrUpper = adjusted(profile, rule.engine.params.pcrUpperExtreme ?? 1.35, 1.2);
      const pcrLower = adjusted(profile, rule.engine.params.pcrLowerExtreme ?? 0.72, 0.82);
      const minRsiLong = adjusted(profile, rule.engine.params.minRsiForLongRecovery ?? 32, 30);
      const maxRsiShort = adjusted(profile, rule.engine.params.maxRsiForShortFade ?? 68, 70);
      const snapshot = series.snapshotsAligned[i];
      if (!snapshot?.pcr) return { candidate: null, rejectionReason: "missing_pcr_data" };
      const oi = series.oiAligned[i];
      const pcr = snapshot.pcr;
      const shortPressure =
        oi ? oi.shortOiChange >= oi.longOiChange : (snapshot.sellQty ?? 0) >= (snapshot.buyQty ?? 0);
      const longPressure =
        oi ? oi.longOiChange >= oi.shortOiChange : (snapshot.buyQty ?? 0) >= (snapshot.sellQty ?? 0);

      const longChecks = [
        pcr >= pcrUpper,
        shortPressure,
        series.rsi14[i] > minRsiLong && series.rsi14[i - 1] <= minRsiLong,
        macdHistNow > macdHistPrev,
        close > ema9Now && ema9Now > ema21Now,
      ];
      if (passesChecks(profile, longChecks, [0], longChecks.length, 4)) {
        const stop = lowest(series.low, i, 8) - atrNow * rule.engine.stopAtrMult;
        return {
          direction: "LONG",
          confidence: confidenceFromChecks(56, longChecks),
          reason: "PCR extreme unwind with momentum recovery",
          stopLoss: stop,
          trailingMode: "EMA21",
        };
      }

      const shortChecks = [
        pcr <= pcrLower,
        longPressure,
        series.rsi14[i] < maxRsiShort && series.rsi14[i - 1] >= maxRsiShort,
        macdHistNow < macdHistPrev,
        close < ema9Now && ema9Now < ema21Now,
      ];
      if (passesChecks(profile, shortChecks, [0], shortChecks.length, 4)) {
        const stop = highest(series.high, i, 8) + atrNow * rule.engine.stopAtrMult;
        return {
          direction: "SHORT",
          confidence: confidenceFromChecks(56, shortChecks),
          reason: "PCR extreme fade with momentum rollover",
          stopLoss: stop,
          trailingMode: "EMA21",
        };
      }

      return { candidate: null, rejectionReason: "pcr_reversal_confluence_missing" };
    }

    case "rsi_divergence_stochastic_reversal": {
      const divLookback = Math.round(rule.engine.params.divergenceLookback ?? 18);
      const stochOversold = adjusted(profile, rule.engine.params.stochOversold ?? 20, 30);
      const stochOverbought = adjusted(profile, rule.engine.params.stochOverbought ?? 80, 70);
      const bullDiv = bullishDivergence(series.low, series.rsi14, i, divLookback);
      const bearDiv = bearishDivergence(series.high, series.rsi14, i, divLookback);
      const stochBullCross =
        series.stochasticK[i] > series.stochasticD[i] &&
        series.stochasticK[i - 1] <= series.stochasticD[i - 1] &&
        series.stochasticK[i] <= stochOversold + 10;
      const stochBearCross =
        series.stochasticK[i] < series.stochasticD[i] &&
        series.stochasticK[i - 1] >= series.stochasticD[i - 1] &&
        series.stochasticK[i] >= stochOverbought - 10;

      const longChecks = [
        higherBullish,
        bullDiv,
        stochBullCross || series.stochasticK[i] <= stochOversold,
        close > ema9Now,
        macdHistNow > macdHistPrev,
      ];
      if (passesChecks(profile, longChecks, [1], longChecks.length, 3)) {
        return {
          direction: "LONG",
          confidence: confidenceFromChecks(55, longChecks),
          reason: "RSI divergence reversal with stochastic confirmation",
          stopLoss: lowest(series.low, i, 6) - atrNow * 0.5,
          trailingMode: "EMA21",
        };
      }

      const shortChecks = [
        higherBearish,
        bearDiv,
        stochBearCross || series.stochasticK[i] >= stochOverbought,
        close < ema9Now,
        macdHistNow < macdHistPrev,
      ];
      if (passesChecks(profile, shortChecks, [1], shortChecks.length, 3)) {
        return {
          direction: "SHORT",
          confidence: confidenceFromChecks(55, shortChecks),
          reason: "RSI divergence reversal with stochastic confirmation",
          stopLoss: highest(series.high, i, 6) + atrNow * 0.5,
          trailingMode: "EMA21",
        };
      }

      return { candidate: null, rejectionReason: "rsi_stoch_reversal_missing" };
    }

    case "sar_vwap_opening_drive": {
      const cutoffMin = Math.round(rule.engine.params.openingCutoffMin ?? 120);
      const volumeMult = adjusted(profile, rule.engine.params.openingVolumeMult ?? 1.2, 1.05);
      const minutesFromOpen = istMinutesFromStart(series.candles[i].time);
      if (minutesFromOpen < 0 || minutesFromOpen > cutoffMin) {
        return { candidate: null, rejectionReason: "outside_opening_window" };
      }

      const sarFlipBull = series.sarTrend[i] === 1 && series.sarTrend[i - 1] === -1;
      const sarFlipBear = series.sarTrend[i] === -1 && series.sarTrend[i - 1] === 1;
      const volumeConfirmed = (series.volume[i] ?? 0) > (series.volumeSma20[i] ?? 0) * volumeMult;
      const obvUp = series.obv[i] > (series.obv[i - 1] ?? series.obv[i]);
      const obvDown = series.obv[i] < (series.obv[i - 1] ?? series.obv[i]);

      const longChecks = [
        higherBullish,
        sarFlipBull,
        close > series.vwap[i],
        volumeConfirmed,
        obvUp,
      ];
      if (passesChecks(profile, longChecks, [1, 2], longChecks.length, 4)) {
        return {
          direction: "LONG",
          confidence: confidenceFromChecks(58, longChecks),
          reason: "Opening drive long with SAR flip and VWAP hold",
          stopLoss: Math.min(series.sar[i], low - atrNow * 0.2),
          trailingMode: "SUPERTREND",
        };
      }

      const shortChecks = [
        higherBearish,
        sarFlipBear,
        close < series.vwap[i],
        volumeConfirmed,
        obvDown,
      ];
      if (passesChecks(profile, shortChecks, [1, 2], shortChecks.length, 4)) {
        return {
          direction: "SHORT",
          confidence: confidenceFromChecks(58, shortChecks),
          reason: "Opening drive short with SAR flip and VWAP rejection",
          stopLoss: Math.max(series.sar[i], high + atrNow * 0.2),
          trailingMode: "SUPERTREND",
        };
      }

      return { candidate: null, rejectionReason: "sar_vwap_opening_missing" };
    }

    case "stochastic_macd_range_crossover": {
      const adxRangeMax = adjusted(profile, rule.engine.params.adxRangeMax ?? 20, 24);
      const stochOversold = adjusted(profile, rule.engine.params.stochOversold ?? 25, 30);
      const stochOverbought = adjusted(profile, rule.engine.params.stochOverbought ?? 75, 70);
      const isRangeRegime = adxNow <= adxRangeMax && Math.abs(close - series.vwap[i]) <= atrNow * 1.3;

      const stochCrossUp =
        series.stochasticK[i] > series.stochasticD[i] &&
        series.stochasticK[i - 1] <= series.stochasticD[i - 1] &&
        series.stochasticK[i] <= stochOversold + 12;
      const stochCrossDown =
        series.stochasticK[i] < series.stochasticD[i] &&
        series.stochasticK[i - 1] >= series.stochasticD[i - 1] &&
        series.stochasticK[i] >= stochOverbought - 12;

      const macdCrossUp = crossedAbove(macdLine, macdSignal, i) || macdLine[i] > macdSignal[i];
      const macdCrossDown = crossedBelow(macdLine, macdSignal, i) || macdLine[i] < macdSignal[i];

      const longChecks = [
        isRangeRegime,
        stochCrossUp || series.stochasticK[i] <= stochOversold,
        macdCrossUp,
        macdHistNow >= macdHistPrev,
      ];
      if (passesChecks(profile, longChecks, [0, 1], longChecks.length, 3)) {
        return {
          direction: "LONG",
          confidence: confidenceFromChecks(52, longChecks),
          reason: "Range bounce with stochastic and MACD alignment",
          stopLoss: lowest(series.low, i, 6) - atrNow * 0.4,
          trailingMode: "EMA9",
        };
      }

      const shortChecks = [
        isRangeRegime,
        stochCrossDown || series.stochasticK[i] >= stochOverbought,
        macdCrossDown,
        macdHistNow <= macdHistPrev,
      ];
      if (passesChecks(profile, shortChecks, [0, 1], shortChecks.length, 3)) {
        return {
          direction: "SHORT",
          confidence: confidenceFromChecks(52, shortChecks),
          reason: "Range fade with stochastic and MACD alignment",
          stopLoss: highest(series.high, i, 6) + atrNow * 0.4,
          trailingMode: "EMA9",
        };
      }

      return { candidate: null, rejectionReason: "range_crossover_missing" };
    }

    case "fib_orderflow_continuation": {
      const lookbackBars = Math.max(20, Math.round(rule.engine.params.fibLookbackBars ?? 40));
      const toleranceAtr = adjusted(profile, rule.engine.params.fibZoneToleranceAtr ?? 0.3, 0.5);
      const pcrBullMin = adjusted(profile, rule.engine.params.pcrTrendBullMin ?? 1, 0.95);
      const pcrBearMax = adjusted(profile, rule.engine.params.pcrTrendBearMax ?? 1, 1.05);
      const swingHigh = highest(series.high, i, lookbackBars);
      const swingLow = lowest(series.low, i, lookbackBars);
      const fib = fibLevelsFromRange(swingHigh, swingLow);
      const nearBullZone =
        Math.abs(close - fib.level50) <= atrNow * toleranceAtr ||
        Math.abs(close - fib.level618) <= atrNow * toleranceAtr;
      const nearBearZone =
        Math.abs(close - (swingLow + (swingHigh - swingLow) * 0.5)) <= atrNow * toleranceAtr ||
        Math.abs(close - (swingLow + (swingHigh - swingLow) * 0.618)) <= atrNow * toleranceAtr;
      const snapshot = series.snapshotsAligned[i];
      const pcr = snapshot?.pcr ?? null;
      const superBull = series.supertrendTrend[i] === 1;
      const superBear = series.supertrendTrend[i] === -1;
      const macdBull = crossedAbove(macdLine, macdSignal, i) || macdLine[i] > macdSignal[i];
      const macdBear = crossedBelow(macdLine, macdSignal, i) || macdLine[i] < macdSignal[i];

      const longChecks = [
        higherBullish,
        superBull,
        nearBullZone,
        macdBull,
        pcr == null || pcr >= pcrBullMin,
      ];
      if (passesChecks(profile, longChecks, [0, 2], longChecks.length, 4)) {
        return {
          direction: "LONG",
          confidence: confidenceFromChecks(57, longChecks),
          reason: "Trend continuation at fib pullback zone",
          stopLoss: Math.min(fib.level786, lowest(series.low, i, 8)) - atrNow * 0.25,
          trailingMode: "SUPERTREND",
        };
      }

      const shortChecks = [
        higherBearish,
        superBear,
        nearBearZone,
        macdBear,
        pcr == null || pcr <= pcrBearMax,
      ];
      if (passesChecks(profile, shortChecks, [0, 2], shortChecks.length, 4)) {
        return {
          direction: "SHORT",
          confidence: confidenceFromChecks(57, shortChecks),
          reason: "Trend continuation short at fib pullback zone",
          stopLoss: Math.max(
            swingLow + (swingHigh - swingLow) * 0.786,
            highest(series.high, i, 8)
          ) + atrNow * 0.25,
          trailingMode: "SUPERTREND",
        };
      }

      return { candidate: null, rejectionReason: "fib_continuation_missing" };
    }
    case "kumo_volumetric_breakout": {
      const mfiLongMin = adjusted(profile, rule.engine.params.mfiLongMin ?? 60, 55);
      const mfiShortMax = adjusted(profile, rule.engine.params.mfiShortMax ?? 40, 45);
      const obvBreakLookback = Math.max(8, Math.round(rule.engine.params.obvBreakLookback ?? 12));
      const vacuumMin = adjusted(profile, rule.engine.params.vacuumMin ?? 0.35, 0.25);
      const breakoutVolumeMult = adjusted(profile, rule.engine.params.breakoutVolumeMult ?? 1.2, 1.05);
      const cloudTop = Math.max(series.ichimokuSpanA[i] ?? close, series.ichimokuSpanB[i] ?? close);
      const cloudBottom = Math.min(series.ichimokuSpanA[i] ?? close, series.ichimokuSpanB[i] ?? close);
      const breakoutUp = close > cloudTop && (series.close[i - 1] ?? close) <= cloudTop;
      const breakoutDown = close < cloudBottom && (series.close[i - 1] ?? close) >= cloudBottom;
      const obvBreakUp = series.obv[i] > highest(series.obv, i - 1, obvBreakLookback);
      const obvBreakDown = series.obv[i] < lowest(series.obv, i - 1, obvBreakLookback);
      const vacuumActive = (series.volumeVacuum[i] ?? 0) >= vacuumMin;
      const volumeConfirmed = (series.volume[i] ?? 0) >= (series.volumeSma20[i] ?? 0) * breakoutVolumeMult;

      const longChecks = [
        higherBullish,
        breakoutUp,
        obvBreakUp,
        (series.mfi14[i] ?? 50) >= mfiLongMin,
        close >= (series.hvn[i] ?? close),
        vacuumActive,
        volumeConfirmed,
      ];
      if (passesChecks(profile, longChecks, [1, 3], longChecks.length, 5)) {
        return {
          direction: "LONG",
          confidence: confidenceFromChecks(61, longChecks),
          reason: "Kumo breakout with volume-structure release",
          stopLoss: Math.min(cloudBottom - atrNow * 0.25, low - atrNow * rule.engine.stopAtrMult),
          trailingMode: "EMA21",
        };
      }

      const shortChecks = [
        higherBearish,
        breakoutDown,
        obvBreakDown,
        (series.mfi14[i] ?? 50) <= mfiShortMax,
        close <= (series.hvn[i] ?? close),
        vacuumActive,
        volumeConfirmed,
      ];
      if (passesChecks(profile, shortChecks, [1, 3], shortChecks.length, 5)) {
        return {
          direction: "SHORT",
          confidence: confidenceFromChecks(61, shortChecks),
          reason: "Kumo breakdown with volume-structure release",
          stopLoss: Math.max(cloudTop + atrNow * 0.25, high + atrNow * rule.engine.stopAtrMult),
          trailingMode: "EMA21",
        };
      }

      return { candidate: null, rejectionReason: "kumo_breakout_confluence_missing" };
    }
    case "ib_volatility_expansion": {
      const ibMinutes = Math.max(15, Math.round(rule.engine.params.ibMinutes ?? 45));
      const openingCutoffMin = Math.max(
        ibMinutes + 15,
        Math.round(rule.engine.params.openingCutoffMin ?? 210)
      );
      const minutesFromOpen = istMinutesFromStart(series.candles[i].time);
      if (minutesFromOpen < ibMinutes || minutesFromOpen > openingCutoffMin) {
        return { candidate: null, rejectionReason: "outside_ib_window" };
      }
      const aroonSpikeMin = adjusted(profile, rule.engine.params.aroonSpikeMin ?? 80, 70);
      const aroonConflictMax = adjusted(profile, rule.engine.params.aroonConflictMax ?? 50, 60);
      const atrExpansionMin = adjusted(profile, rule.engine.params.atrExpansionMin ?? 1.08, 1.02);
      const volumeMult = adjusted(profile, rule.engine.params.ibBreakVolumeMult ?? 1.15, 1.05);
      const ibHigh = series.ibHigh[i] ?? close;
      const ibLow = series.ibLow[i] ?? close;
      const breakoutUp = close > ibHigh && (series.close[i - 1] ?? close) <= ibHigh;
      const breakoutDown = close < ibLow && (series.close[i - 1] ?? close) >= ibLow;
      const atrExpanding = atrNow >= (series.atr14[i - 1] ?? atrNow) * atrExpansionMin;
      const volumeConfirmed = (series.volume[i] ?? 0) >= (series.volumeSma20[i] ?? 0) * volumeMult;

      const longChecks = [
        higherBullish,
        breakoutUp,
        (series.aroonUp[i] ?? 0) >= aroonSpikeMin,
        (series.aroonDown[i] ?? 100) <= aroonConflictMax,
        close > series.vwap[i] && series.supertrendTrend[i] === 1,
        atrExpanding,
        volumeConfirmed,
      ];
      if (passesChecks(profile, longChecks, [1, 2, 4], longChecks.length, 5)) {
        return {
          direction: "LONG",
          confidence: confidenceFromChecks(60, longChecks),
          reason: "Initial-balance breakout with morning momentum confirmation",
          stopLoss: Math.min(series.vwap[i] - atrNow * rule.engine.stopAtrMult, ibHigh - atrNow * 0.6),
          trailingMode: "SUPERTREND",
        };
      }

      const shortChecks = [
        higherBearish,
        breakoutDown,
        (series.aroonDown[i] ?? 0) >= aroonSpikeMin,
        (series.aroonUp[i] ?? 100) <= aroonConflictMax,
        close < series.vwap[i] && series.supertrendTrend[i] === -1,
        atrExpanding,
        volumeConfirmed,
      ];
      if (passesChecks(profile, shortChecks, [1, 2, 4], shortChecks.length, 5)) {
        return {
          direction: "SHORT",
          confidence: confidenceFromChecks(60, shortChecks),
          reason: "Initial-balance breakdown with morning momentum confirmation",
          stopLoss: Math.max(series.vwap[i] + atrNow * rule.engine.stopAtrMult, ibLow + atrNow * 0.6),
          trailingMode: "SUPERTREND",
        };
      }

      return { candidate: null, rejectionReason: "ib_expansion_confluence_missing" };
    }
    case "pcr_capitulation_reversal": {
      const snapshot = series.snapshotsAligned[i];
      if (!snapshot?.pcr) {
        return { candidate: null, rejectionReason: "missing_pcr_data" };
      }
      const pcrCapLow = adjusted(profile, rule.engine.params.pcrCapitulationLow ?? 0.62, 0.68);
      const pcrCapHigh = adjusted(profile, rule.engine.params.pcrCapitulationHigh ?? 1.48, 1.4);
      const mfiOversold = adjusted(profile, rule.engine.params.mfiOversold ?? 20, 25);
      const mfiOverbought = adjusted(profile, rule.engine.params.mfiOverbought ?? 80, 75);
      const mfiRecovery = Math.max(2, rule.engine.params.mfiRecovery ?? 3);
      const divLookback = Math.max(10, Math.round(rule.engine.params.divergenceLookback ?? 18));
      const oi = series.oiAligned[i];
      const pcr = snapshot.pcr;
      const lowerBand = series.bollingerLower[i] ?? close;
      const upperBand = series.bollingerUpper[i] ?? close;

      const bearishPressure =
        oi != null
          ? oi.shortOiChange >= oi.longOiChange
          : (snapshot.sellQty ?? 0) >= (snapshot.buyQty ?? 0);
      const bullishPressure =
        oi != null
          ? oi.longOiChange >= oi.shortOiChange
          : (snapshot.buyQty ?? 0) >= (snapshot.sellQty ?? 0);

      const longChecks = [
        pcr <= pcrCapLow,
        low <= lowerBand && close > lowerBand,
        (series.mfi14[i] ?? 50) >= mfiOversold + mfiRecovery &&
          (series.mfi14[i - 1] ?? 50) <= mfiOversold + mfiRecovery,
        bullishDivergence(series.low, series.mfi14, i, divLookback),
        bearishPressure,
        macdHistNow > macdHistPrev,
      ];
      if (passesChecks(profile, longChecks, [0, 1], longChecks.length, 4)) {
        return {
          direction: "LONG",
          confidence: confidenceFromChecks(57, longChecks),
          reason: "Capitulation fade with band re-entry and MFI recovery",
          stopLoss: lowest(series.low, i, 8) - atrNow * 0.35,
          trailingMode: "EMA21",
        };
      }

      const shortChecks = [
        pcr >= pcrCapHigh,
        high >= upperBand && close < upperBand,
        (series.mfi14[i] ?? 50) <= mfiOverbought - mfiRecovery &&
          (series.mfi14[i - 1] ?? 50) >= mfiOverbought - mfiRecovery,
        bearishDivergence(series.high, series.mfi14, i, divLookback),
        bullishPressure,
        macdHistNow < macdHistPrev,
      ];
      if (passesChecks(profile, shortChecks, [0, 1], shortChecks.length, 4)) {
        return {
          direction: "SHORT",
          confidence: confidenceFromChecks(57, shortChecks),
          reason: "Euphoria fade with band re-entry and MFI rollover",
          stopLoss: highest(series.high, i, 8) + atrNow * 0.35,
          trailingMode: "EMA21",
        };
      }

      return { candidate: null, rejectionReason: "pcr_capitulation_confluence_missing" };
    }
    case "channel_adx_oi_breakout": {
      const lookbackBars = Math.max(6, Math.round(rule.engine.params.channelLookbackBars ?? 9));
      const minAdx = adjusted(profile, rule.engine.params.minAdx ?? 28, 24);
      const oiSkewMin = adjusted(profile, rule.engine.params.oiSkewMin ?? 0.05, 0.02);
      const breakoutVolumeMult = adjusted(profile, rule.engine.params.breakoutVolumeMult ?? 1.1, 1.02);
      const channelHigh = highest(series.high, i - 1, lookbackBars);
      const channelLow = lowest(series.low, i - 1, lookbackBars);
      const breakoutUp = close > channelHigh;
      const breakoutDown = close < channelLow;
      const adxTrend = adxNow >= minAdx && adxNow > adxPrev;
      const snapshot = series.snapshotsAligned[i];
      const oi = series.oiAligned[i];
      const shortOiDominance =
        oi != null
          ? oi.shortOiChange > oi.longOiChange * (1 + oiSkewMin)
          : (snapshot?.sellQty ?? 0) > (snapshot?.buyQty ?? 0);
      const longOiDominance =
        oi != null
          ? oi.longOiChange > oi.shortOiChange * (1 + oiSkewMin)
          : (snapshot?.buyQty ?? 0) > (snapshot?.sellQty ?? 0);
      const volumeConfirmed = (series.volume[i] ?? 0) >= (series.volumeSma20[i] ?? 0) * breakoutVolumeMult;

      const longChecks = [
        higherBullish,
        breakoutUp,
        adxTrend,
        shortOiDominance,
        close > series.vwap[i],
        volumeConfirmed,
      ];
      if (passesChecks(profile, longChecks, [1, 2], longChecks.length, 4)) {
        return {
          direction: "LONG",
          confidence: confidenceFromChecks(60, longChecks),
          reason: "Channel breakout with ADX and OI participation",
          stopLoss: Math.min((channelHigh + channelLow) / 2 - atrNow * 0.2, close - atrNow),
          trailingMode: "EMA9",
          validateWithinBars: 3,
          postEntryAdxMin: Math.max(18, minAdx - 4),
        };
      }

      const shortChecks = [
        higherBearish,
        breakoutDown,
        adxTrend,
        longOiDominance,
        close < series.vwap[i],
        volumeConfirmed,
      ];
      if (passesChecks(profile, shortChecks, [1, 2], shortChecks.length, 4)) {
        return {
          direction: "SHORT",
          confidence: confidenceFromChecks(60, shortChecks),
          reason: "Channel breakdown with ADX and OI participation",
          stopLoss: Math.max((channelHigh + channelLow) / 2 + atrNow * 0.2, close + atrNow),
          trailingMode: "EMA9",
          validateWithinBars: 3,
          postEntryAdxMin: Math.max(18, minAdx - 4),
        };
      }

      return { candidate: null, rejectionReason: "channel_adx_oi_confluence_missing" };
    }
    default:
      return { candidate: null, rejectionReason: "unsupported_strategy" };
  }
}

function computeTradePnlPoints(
  direction: TradeDirection,
  entryPrice: number,
  exitPrice: number
): number {
  return direction === "LONG" ? exitPrice - entryPrice : entryPrice - exitPrice;
}

function classifyOutcome(pnlR: number): TradeOutcome {
  if (pnlR > 0.15) return "WIN";
  if (pnlR < -0.15) return "LOSS";
  return "SCRATCH";
}

function finalizeTrade(
  active: ActiveTrade,
  exitIndex: number,
  exitPrice: number,
  exitReason: string,
  series: PreparedSeries
): SimulatedTrade {
  const pnlPoints = computeTradePnlPoints(active.direction, active.entryPrice, exitPrice);
  const pnlR = active.riskPoints > 0 ? pnlPoints / active.riskPoints : 0;
  return {
    strategyId: active.strategyId,
    segment: active.segment,
    direction: active.direction,
    entryTime: active.entryTime,
    exitTime: series.candles[exitIndex]?.time ?? series.candles[series.candles.length - 1].time,
    barsHeld: Math.max(1, exitIndex - active.entryIndex + 1),
    entryPrice: round2(active.entryPrice),
    exitPrice: round2(exitPrice),
    stopLoss: round2(active.stopLoss),
    takeProfit: round2(active.takeProfit),
    riskPoints: round2(active.riskPoints),
    pnlPoints: round2(pnlPoints),
    pnlR: round2(pnlR),
    outcome: classifyOutcome(pnlR),
    reason: exitReason,
  };
}

function manageTrailingStop(
  active: ActiveTrade,
  i: number,
  series: PreparedSeries
): ActiveTrade {
  const close = series.close[i];
  const favorableMove =
    active.direction === "LONG"
      ? close - active.entryPrice
      : active.entryPrice - close;

  if (!active.reachedOneR && favorableMove >= active.riskPoints) {
    active.reachedOneR = true;
  }

  if (!active.reachedOneR) return active;

  if (active.trailingMode === "EMA9") {
    const trail = series.ema9[i];
    if (active.direction === "LONG") {
      active.stopLoss = Math.max(active.stopLoss, trail);
    } else {
      active.stopLoss = Math.min(active.stopLoss, trail);
    }
  } else if (active.trailingMode === "EMA21") {
    const trail = series.ema21[i];
    if (active.direction === "LONG") {
      active.stopLoss = Math.max(active.stopLoss, trail);
    } else {
      active.stopLoss = Math.min(active.stopLoss, trail);
    }
  } else if (active.trailingMode === "SUPERTREND") {
    const trail = series.supertrendLine[i];
    if (active.direction === "LONG") {
      active.stopLoss = Math.max(active.stopLoss, trail);
    } else {
      active.stopLoss = Math.min(active.stopLoss, trail);
    }
  }

  return active;
}

function simulateStrategy(
  segment: SegmentId,
  strategyId: StrategyId,
  candlesOneMinute: LabCandle[],
  snapshots: LabSnapshot[],
  oiPoints: LabOIBuildupPoint[],
  profile: ExecutionProfile
): SimulateResult {
  const rule = STRATEGY_LAB_RULES_BY_ID[strategyId];
  const series = prepareSeries(candlesOneMinute, snapshots, oiPoints, rule);
  if (!series) {
    return {
      trades: [],
      activity: {
        barsEvaluated: 0,
        signalCandidates: 0,
        entriesTaken: 0,
        blockedByDailyRisk: 0,
        blockedBySpacing: 0,
        blockedByRiskFilter: 0,
        rejectionReasons: {},
      },
    };
  }

  const trades: SimulatedTrade[] = [];
  const dailyRiskUsed = new Map<string, number>();
  let active: ActiveTrade | null = null;
  let lastExitIndex = -1000;
  const activity: StrategyActivityDiagnostics = {
    barsEvaluated: 0,
    signalCandidates: 0,
    entriesTaken: 0,
    blockedByDailyRisk: 0,
    blockedBySpacing: 0,
    blockedByRiskFilter: 0,
    rejectionReasons: {},
  };
  const effectiveRiskPerTrade =
    profile === "strict" ? rule.engine.riskPerTradePct : rule.engine.riskPerTradePct * 0.85;
  const effectiveDailyRiskCap =
    profile === "strict" ? rule.engine.dailyRiskCapPct : rule.engine.dailyRiskCapPct * 1.25;
  const effectiveMinBarsBetweenTrades =
    profile === "strict"
      ? rule.engine.minBarsBetweenTrades
      : Math.max(1, rule.engine.minBarsBetweenTrades - 1);

  for (let i = 35; i < series.candles.length; i++) {
    const day = dateKey(series.candles[i].time);

    if (active) {
      active = manageTrailingStop(active, i, series);
      const candle = series.candles[i];

      if (
        active.requiredAdxAfterEntry &&
        active.validationDeadlineIndex &&
        i >= active.validationDeadlineIndex &&
        (series.adx14[i] ?? 0) < active.requiredAdxAfterEntry
      ) {
        trades.push(finalizeTrade(active, i, candle.close, "ADX expansion failed", series));
        active = null;
        lastExitIndex = i;
        continue;
      }

      if (active.strategyId === "vwap_delta_reversion") {
        const failedReclaim =
          active.direction === "LONG"
            ? candle.close < series.vwap[i]
            : candle.close > series.vwap[i];
        if (failedReclaim && i > active.entryIndex + 1) {
          trades.push(finalizeTrade(active, i, candle.close, "VWAP reclaim/rejection failed", series));
          active = null;
          lastExitIndex = i;
          continue;
        }
      }

      if (active.strategyId === "kumo_volumetric_breakout" && i <= active.entryIndex + 3) {
        const cloudTop = Math.max(series.ichimokuSpanA[i] ?? candle.close, series.ichimokuSpanB[i] ?? candle.close);
        const cloudBottom = Math.min(series.ichimokuSpanA[i] ?? candle.close, series.ichimokuSpanB[i] ?? candle.close);
        const insideCloud = candle.close <= cloudTop && candle.close >= cloudBottom;
        if (insideCloud) {
          trades.push(finalizeTrade(active, i, candle.close, "Kumo re-entry invalidation", series));
          active = null;
          lastExitIndex = i;
          continue;
        }
      }

      const stopHit =
        active.direction === "LONG"
          ? candle.low <= active.stopLoss
          : candle.high >= active.stopLoss;
      const targetHit =
        active.direction === "LONG"
          ? candle.high >= active.takeProfit
          : candle.low <= active.takeProfit;

      // Conservative sequencing when both are touched inside the same bar.
      if (stopHit) {
        trades.push(finalizeTrade(active, i, active.stopLoss, "Stop loss hit", series));
        active = null;
        lastExitIndex = i;
        continue;
      }
      if (targetHit) {
        trades.push(finalizeTrade(active, i, active.takeProfit, "Target hit", series));
        active = null;
        lastExitIndex = i;
        continue;
      }

      const barsHeld = i - active.entryIndex + 1;
      const nextDay = i + 1 < series.candles.length ? dateKey(series.candles[i + 1].time) : day;
      if (barsHeld >= active.maxBarsInTrade) {
        trades.push(finalizeTrade(active, i, candle.close, "Time stop", series));
        active = null;
        lastExitIndex = i;
        continue;
      }
      if (day !== nextDay) {
        trades.push(finalizeTrade(active, i, candle.close, "Session close", series));
        active = null;
        lastExitIndex = i;
        continue;
      }
    }

    if (active) continue;
    activity.barsEvaluated += 1;
    if (i - lastExitIndex < effectiveMinBarsBetweenTrades) {
      activity.blockedBySpacing += 1;
      continue;
    }

    const usedRisk = dailyRiskUsed.get(day) ?? 0;
    if (usedRisk + effectiveRiskPerTrade > effectiveDailyRiskCap) {
      activity.blockedByDailyRisk += 1;
      continue;
    }

    const detection = detectSignal(strategyId, series, rule, i, profile);
    if ("candidate" in detection) {
      activity.rejectionReasons[detection.rejectionReason] =
        (activity.rejectionReasons[detection.rejectionReason] ?? 0) + 1;
      continue;
    }
    const candidate = detection;
    activity.signalCandidates += 1;

    const entry = series.close[i];
    const stop = resolveStop(candidate.direction, entry, candidate.stopLoss);
    const risk = Math.abs(entry - stop);
    if (!Number.isFinite(risk) || risk <= Math.max(0.05, entry * 0.0002)) {
      activity.blockedByRiskFilter += 1;
      continue;
    }

    const takeProfit =
      candidate.direction === "LONG"
        ? entry + risk * rule.engine.targetR
        : entry - risk * rule.engine.targetR;

    active = {
      strategyId,
      segment,
      direction: candidate.direction,
      entryIndex: i,
      entryTime: series.candles[i].time,
      entryPrice: entry,
      stopLoss: stop,
      takeProfit,
      riskPoints: risk,
      trailingMode: candidate.trailingMode,
      maxBarsInTrade: rule.engine.maxBarsInTrade,
      signalReason: candidate.reason,
      reachedOneR: false,
      validationDeadlineIndex:
        candidate.validateWithinBars != null ? i + candidate.validateWithinBars : undefined,
      requiredAdxAfterEntry: candidate.postEntryAdxMin,
    };

    dailyRiskUsed.set(day, usedRisk + effectiveRiskPerTrade);
    activity.entriesTaken += 1;
  }

  if (active) {
    const finalIndex = series.candles.length - 1;
    const finalClose = series.close[finalIndex];
    trades.push(finalizeTrade(active, finalIndex, finalClose, "Range end", series));
  }

  return { trades, activity };
}

function computeMaxDrawdownR(values: number[]): number {
  let peak = 0;
  let cumulative = 0;
  let maxDrawdown = 0;
  for (const value of values) {
    cumulative += value;
    if (cumulative > peak) peak = cumulative;
    const drawdown = peak - cumulative;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  return maxDrawdown;
}

function computeSharpeLike(values: number[]): number {
  if (values.length < 2) return values.length === 1 ? values[0] : 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + (v - mean) * (v - mean), 0) /
    Math.max(1, values.length - 1);
  const stdev = Math.sqrt(variance);
  if (stdev === 0) return mean > 0 ? 3 : 0;
  return (mean / stdev) * Math.sqrt(values.length);
}

export function computeKpis(trades: SimulatedTrade[]): StrategyKpis {
  const wins = trades.filter((t) => t.outcome === "WIN");
  const losses = trades.filter((t) => t.outcome === "LOSS");
  const scratches = trades.filter((t) => t.outcome === "SCRATCH");
  const rValues = trades.map((t) => t.pnlR);
  const netR = rValues.reduce((s, v) => s + v, 0);
  const netPoints = trades.reduce((s, t) => s + t.pnlPoints, 0);
  const grossWinR = wins.reduce((s, t) => s + t.pnlR, 0);
  const grossLossR = losses.reduce((s, t) => s + Math.abs(t.pnlR), 0);
  const tradesCount = trades.length;
  const winRate = tradesCount ? (wins.length / tradesCount) * 100 : 0;
  const avgR = tradesCount ? netR / tradesCount : 0;
  const expectancyR = avgR;
  const profitFactor = grossLossR > 0 ? grossWinR / grossLossR : grossWinR > 0 ? 9.99 : 0;
  const maxDrawdownR = computeMaxDrawdownR(rValues);
  const sharpeLike = computeSharpeLike(rValues);

  return {
    trades: tradesCount,
    wins: wins.length,
    losses: losses.length,
    scratches: scratches.length,
    winRate: round2(winRate),
    netPoints: round2(netPoints),
    netR: round2(netR),
    avgR: round2(avgR),
    expectancyR: round2(expectancyR),
    profitFactor: round2(profitFactor),
    maxDrawdownR: round2(maxDrawdownR),
    sharpeLike: round2(sharpeLike),
  };
}

function qualityBonus(quality: StrategyRuleSpec["qualityRating"]): number {
  if (quality === "A+") return 2;
  if (quality === "A") return 1.3;
  return 0.8;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rangeDays(fromIso: string, toIso: string): number {
  const from = toMs(fromIso);
  const to = toMs(toIso);
  const diff = to - from;
  if (!Number.isFinite(diff) || diff <= 0) return 1;
  return Math.max(1, diff / (24 * 60 * 60 * 1000));
}

export function computeEvaluationScore(
  kpis: StrategyKpis,
  quality: StrategyRuleSpec["qualityRating"]
): number {
  const cappedProfitFactor = Math.min(4, kpis.profitFactor);
  const cappedSharpe = Math.min(3, Math.max(-3, kpis.sharpeLike));
  const scoreRaw =
    kpis.netR * 6 +
    (kpis.winRate / 100) * 16 +
    cappedProfitFactor * 5 +
    kpis.expectancyR * 10 +
    cappedSharpe * 4 -
    kpis.maxDrawdownR * 6 +
    qualityBonus(quality);
  const sampleConfidence = clamp(kpis.trades / 14, 0, 1);
  let score = scoreRaw * (0.45 + sampleConfidence * 0.55);
  if (kpis.trades < 3) score -= 10;
  else if (kpis.trades < 6) score -= 4;
  if (kpis.trades > 40) score += 2;
  return round2(score);
}

function computeRollingWindows(
  trades: SimulatedTrade[],
  fromIso: string,
  toIso: string,
  quality: StrategyRuleSpec["qualityRating"]
): RollingWindowEvaluation[] {
  const bounds = getWindowBounds(fromIso, toIso);
  if (!bounds.length) return [];
  return bounds.map((bound) => {
    const fromMs = toMs(bound.from);
    const toMsValue = toMs(bound.to);
    const windowTrades = trades.filter((trade) => {
      const t = toMs(trade.entryTime);
      return t >= fromMs && t < toMsValue;
    });
    const kpis = computeKpis(windowTrades);
    const score = computeEvaluationScore(kpis, quality);
    return {
      from: bound.from,
      to: bound.to,
      kpis,
      score,
    };
  });
}

function computeConsistency(
  windows: RollingWindowEvaluation[]
): StrategyConsistencyMetrics {
  if (!windows.length) {
    return {
      windows: 0,
      positiveWindows: 0,
      positiveWindowRate: 0,
      medianNetR: 0,
      netRStdDev: 0,
      consistencyScore: 0,
    };
  }
  const netRs = windows.map((windowItem) => windowItem.kpis.netR);
  const positiveWindows = netRs.filter((value) => value > 0).length;
  const positiveWindowRate = positiveWindows / windows.length;
  const windowsWithTrades = windows.filter((windowItem) => windowItem.kpis.trades > 0).length;
  const activityRate = windowsWithTrades / windows.length;
  const medianNetR = median(netRs);
  const netRStdDev = stdDev(netRs);
  const consistencyScore =
    positiveWindowRate * 40 +
    activityRate * 20 +
    medianNetR * 10 -
    netRStdDev * 8;
  return {
    windows: windows.length,
    positiveWindows,
    positiveWindowRate: round2(positiveWindowRate * 100),
    medianNetR: round2(medianNetR),
    netRStdDev: round2(netRStdDev),
    consistencyScore: round2(consistencyScore),
  };
}

function computeReliabilityScore(
  kpis: StrategyKpis,
  windows: RollingWindowEvaluation[],
  fromIso: string,
  toIso: string
): number {
  const days = rangeDays(fromIso, toIso);
  const tradesPerDay = kpis.trades / days;
  let densityScore = 0;
  if (tradesPerDay <= 0.5) {
    densityScore = (tradesPerDay / 0.5) * 25;
  } else if (tradesPerDay <= 3) {
    densityScore = 25 + ((tradesPerDay - 0.5) / 2.5) * 55;
  } else if (tradesPerDay <= 6) {
    densityScore = 80 + ((tradesPerDay - 3) / 3) * 15;
  } else if (tradesPerDay <= 10) {
    densityScore = 95 - ((tradesPerDay - 6) / 4) * 25;
  } else {
    densityScore = Math.max(35, 70 - (tradesPerDay - 10) * 3);
  }
  densityScore = clamp(densityScore, 0, 100);

  const windowsWithTrades = windows.filter((windowItem) => windowItem.kpis.trades > 0).length;
  const coverageScore =
    windows.length > 0 ? (windowsWithTrades / windows.length) * 100 : kpis.trades > 0 ? 100 : 0;
  const sampleScore = clamp(kpis.trades * 4, 0, 100);
  const drawdownGuard = clamp(100 - kpis.maxDrawdownR * 12, 0, 100);

  let reliability =
    densityScore * 0.35 +
    coverageScore * 0.3 +
    sampleScore * 0.2 +
    drawdownGuard * 0.15;

  if (kpis.trades < 3) reliability *= 0.5;
  else if (kpis.trades < 6) reliability *= 0.75;

  return round2(clamp(reliability, 0, 100));
}

function entryOverlapPct(aTrades: SimulatedTrade[], bTrades: SimulatedTrade[]): number {
  if (!aTrades.length || !bTrades.length) return 0;
  const aKeys = new Set(aTrades.map((trade) => `${trade.entryTime.slice(0, 16)}|${trade.direction}`));
  const bKeys = new Set(bTrades.map((trade) => `${trade.entryTime.slice(0, 16)}|${trade.direction}`));
  const [small, large] = aKeys.size <= bKeys.size ? [aKeys, bKeys] : [bKeys, aKeys];
  let shared = 0;
  for (const key of small) {
    if (large.has(key)) shared += 1;
  }
  return round2((shared / Math.max(1, small.size)) * 100);
}

function directionAgreementPct(aTrades: SimulatedTrade[], bTrades: SimulatedTrade[]): number {
  if (!aTrades.length || !bTrades.length) return 0;
  const aLong = aTrades.filter((trade) => trade.direction === "LONG").length / aTrades.length;
  const bLong = bTrades.filter((trade) => trade.direction === "LONG").length / bTrades.length;
  return round2(clamp((1 - Math.abs(aLong - bLong)) * 100, 0, 100));
}

function tradeCountSimilarityPct(aCount: number, bCount: number): number {
  if (aCount === 0 && bCount === 0) return 0;
  const maxCount = Math.max(1, aCount, bCount);
  const diff = Math.abs(aCount - bCount);
  return round2(clamp((1 - diff / maxCount) * 100, 0, 100));
}

function pearson(valuesA: number[], valuesB: number[]): number {
  if (valuesA.length !== valuesB.length || valuesA.length < 2) return 0;
  const meanA = valuesA.reduce((sum, value) => sum + value, 0) / valuesA.length;
  const meanB = valuesB.reduce((sum, value) => sum + value, 0) / valuesB.length;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < valuesA.length; i++) {
    const da = valuesA[i] - meanA;
    const db = valuesB[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  if (varA <= 0 || varB <= 0) return 0;
  return clamp(cov / Math.sqrt(varA * varB), -1, 1);
}

function netRCorrelationPct(aTrades: SimulatedTrade[], bTrades: SimulatedTrade[]): number {
  if (!aTrades.length || !bTrades.length) return 0;
  const aDaily = new Map<string, number>();
  const bDaily = new Map<string, number>();
  for (const trade of aTrades) {
    const key = dateKey(trade.entryTime);
    aDaily.set(key, (aDaily.get(key) ?? 0) + trade.pnlR);
  }
  for (const trade of bTrades) {
    const key = dateKey(trade.entryTime);
    bDaily.set(key, (bDaily.get(key) ?? 0) + trade.pnlR);
  }
  const keys = Array.from(new Set([...aDaily.keys(), ...bDaily.keys()])).sort();
  if (keys.length < 2) return 50;
  const seriesA = keys.map((key) => aDaily.get(key) ?? 0);
  const seriesB = keys.map((key) => bDaily.get(key) ?? 0);
  const corr = pearson(seriesA, seriesB);
  return round2(((corr + 1) / 2) * 100);
}

function buildSimilarityReasons(pair: {
  entryOverlapPct: number;
  directionAgreementPct: number;
  tradeCountSimilarityPct: number;
  netRCorrelationPct: number;
}): string[] {
  const reasons: string[] = [];
  if (pair.entryOverlapPct >= 70) reasons.push("entry_time_overlap");
  if (pair.directionAgreementPct >= 85) reasons.push("directional_alignment");
  if (pair.tradeCountSimilarityPct >= 85) reasons.push("trade_frequency_match");
  if (pair.netRCorrelationPct >= 75) reasons.push("daily_netr_correlation");
  if (!reasons.length) reasons.push("multi_factor_overlap");
  return reasons;
}

function duplicatePenaltyFromSimilarity(maxSimilarity: number, nearDuplicateCount: number): number {
  if (maxSimilarity < DUPLICATE_SIMILARITY_THRESHOLD) return 0;
  const penaltyRaw =
    (maxSimilarity - DUPLICATE_SIMILARITY_THRESHOLD) * 0.32 + nearDuplicateCount * 0.9;
  return round2(clamp(penaltyRaw, 0, 12));
}

export function evaluateStrategyForSegment(
  strategyId: StrategyId,
  segment: SegmentId,
  candlesOneMinute: LabCandle[],
  snapshots: LabSnapshot[],
  oiPoints: LabOIBuildupPoint[],
  options?: {
    profile?: ExecutionProfile;
    fromIso?: string;
    toIso?: string;
  }
): StrategyEvaluation {
  const rule = STRATEGY_LAB_RULES_BY_ID[strategyId];
  const profile = options?.profile ?? "balanced";
  const simulation = simulateStrategy(
    segment,
    strategyId,
    candlesOneMinute,
    snapshots,
    oiPoints,
    profile
  );
  const trades = simulation.trades;
  const kpis = computeKpis(trades);
  const baseScore = computeEvaluationScore(kpis, rule.qualityRating);
  const fallbackFrom = candlesOneMinute[0]?.time ?? new Date().toISOString();
  const fallbackTo = candlesOneMinute[candlesOneMinute.length - 1]?.time ?? new Date().toISOString();
  const rollingWindows = computeRollingWindows(
    trades,
    options?.fromIso ?? fallbackFrom,
    options?.toIso ?? fallbackTo,
    rule.qualityRating
  );
  const consistency = computeConsistency(rollingWindows);
  const activeFrom = options?.fromIso ?? fallbackFrom;
  const activeTo = options?.toIso ?? fallbackTo;
  const reliabilityScore = computeReliabilityScore(kpis, rollingWindows, activeFrom, activeTo);
  const finalScore = round2(
    baseScore * 0.4 + consistency.consistencyScore * 0.38 + reliabilityScore * 0.22
  );

  return {
    strategyId: rule.id,
    strategyName: rule.name,
    segment,
    qualityRating: rule.qualityRating,
    profile,
    kpis,
    baseScore,
    consistencyScore: consistency.consistencyScore,
    reliabilityScore,
    duplicatePenalty: 0,
    duplicateRisk: 0,
    scoreBreakdown: {
      baseScore: round2(baseScore),
      consistencyScore: round2(consistency.consistencyScore),
      reliabilityScore: round2(reliabilityScore),
      duplicatePenalty: 0,
      finalScore,
    },
    score: finalScore,
    activity: simulation.activity,
    rollingWindows,
    consistency,
    trades,
  };
}

function buildDuplicatePairsForSegment(
  evaluations: StrategyEvaluation[]
): StrategyDuplicatePair[] {
  const pairs: StrategyDuplicatePair[] = [];
  for (let i = 0; i < evaluations.length; i++) {
    for (let j = i + 1; j < evaluations.length; j++) {
      const a = evaluations[i];
      const b = evaluations[j];
      const overlap = entryOverlapPct(a.trades, b.trades);
      const direction = directionAgreementPct(a.trades, b.trades);
      const tradeCount = tradeCountSimilarityPct(a.kpis.trades, b.kpis.trades);
      const correlation = netRCorrelationPct(a.trades, b.trades);
      const similarity = round2(
        overlap * 0.45 + direction * 0.2 + tradeCount * 0.2 + correlation * 0.15
      );
      pairs.push({
        segment: a.segment,
        strategyAId: a.strategyId,
        strategyAName: a.strategyName,
        strategyBId: b.strategyId,
        strategyBName: b.strategyName,
        similarity,
        entryOverlapPct: overlap,
        directionAgreementPct: direction,
        tradeCountSimilarityPct: tradeCount,
        netRCorrelationPct: correlation,
        reasons: buildSimilarityReasons({
          entryOverlapPct: overlap,
          directionAgreementPct: direction,
          tradeCountSimilarityPct: tradeCount,
          netRCorrelationPct: correlation,
        }),
      });
    }
  }
  return pairs.sort((a, b) => b.similarity - a.similarity);
}

export function applyDuplicatePenaltiesForSegment(evaluations: StrategyEvaluation[]): {
  evaluations: StrategyEvaluation[];
  pairs: StrategyDuplicatePair[];
  summaries: StrategyDuplicateSummary[];
  threshold: number;
} {
  if (!evaluations.length) {
    return {
      evaluations: [],
      pairs: [],
      summaries: [],
      threshold: DUPLICATE_SIMILARITY_THRESHOLD,
    };
  }
  const pairs = buildDuplicatePairsForSegment(evaluations);
  const relatedByStrategy = new Map<string, StrategyDuplicatePair[]>();
  for (const pair of pairs) {
    const aKey = `${pair.segment}::${pair.strategyAId}`;
    const bKey = `${pair.segment}::${pair.strategyBId}`;
    if (!relatedByStrategy.has(aKey)) relatedByStrategy.set(aKey, []);
    if (!relatedByStrategy.has(bKey)) relatedByStrategy.set(bKey, []);
    relatedByStrategy.get(aKey)!.push(pair);
    relatedByStrategy.get(bKey)!.push(pair);
  }

  const summaries: StrategyDuplicateSummary[] = [];
  const adjusted = evaluations.map((evaluation) => {
    const key = `${evaluation.segment}::${evaluation.strategyId}`;
    const related = relatedByStrategy.get(key) ?? [];
    const similarities = related.map((pair) => pair.similarity);
    const maxSimilarity = similarities.length ? Math.max(...similarities) : 0;
    const avgSimilarity =
      similarities.length > 0
        ? similarities.reduce((sum, value) => sum + value, 0) / similarities.length
        : 0;
    const nearDuplicateCount = similarities.filter(
      (value) => value >= DUPLICATE_SIMILARITY_THRESHOLD
    ).length;
    const duplicatePenalty = duplicatePenaltyFromSimilarity(maxSimilarity, nearDuplicateCount);
    const adjustedScore = round2(evaluation.score - duplicatePenalty);

    summaries.push({
      segment: evaluation.segment,
      strategyId: evaluation.strategyId,
      strategyName: evaluation.strategyName,
      maxSimilarity: round2(maxSimilarity),
      averageSimilarity: round2(avgSimilarity),
      nearDuplicateCount,
      duplicatePenalty,
    });

    return {
      ...evaluation,
      duplicateRisk: round2(maxSimilarity),
      duplicatePenalty,
      score: adjustedScore,
      scoreBreakdown: {
        ...evaluation.scoreBreakdown,
        duplicatePenalty,
        finalScore: adjustedScore,
      },
    };
  });

  return {
    evaluations: adjusted.sort((a, b) => b.score - a.score),
    pairs,
    summaries: summaries.sort((a, b) => b.maxSimilarity - a.maxSimilarity),
    threshold: DUPLICATE_SIMILARITY_THRESHOLD,
  };
}

export interface SegmentEvaluationResult {
  evaluations: StrategyEvaluation[];
  duplicatePairs: StrategyDuplicatePair[];
  duplicateSummaries: StrategyDuplicateSummary[];
  duplicateThreshold: number;
}

export function evaluateStrategiesForSegmentDetailed(params: {
  segment: SegmentId;
  strategyIds?: StrategyId[];
  candlesOneMinute: LabCandle[];
  snapshots: LabSnapshot[];
  oiPoints: LabOIBuildupPoint[];
  profile?: ExecutionProfile;
  fromIso?: string;
  toIso?: string;
}): SegmentEvaluationResult {
  const selected =
    params.strategyIds && params.strategyIds.length > 0
      ? STRATEGY_LAB_RULES.filter((rule) => params.strategyIds?.includes(rule.id))
      : STRATEGY_LAB_RULES;

  const rawEvaluations = selected.map((rule) =>
    evaluateStrategyForSegment(
      rule.id,
      params.segment,
      params.candlesOneMinute,
      params.snapshots,
      params.oiPoints,
      {
        profile: params.profile ?? "balanced",
        fromIso: params.fromIso,
        toIso: params.toIso,
      }
    )
  );
  const duplicateAnalysis = applyDuplicatePenaltiesForSegment(rawEvaluations);
  return {
    evaluations: duplicateAnalysis.evaluations,
    duplicatePairs: duplicateAnalysis.pairs,
    duplicateSummaries: duplicateAnalysis.summaries,
    duplicateThreshold: duplicateAnalysis.threshold,
  };
}

export function evaluateStrategiesForSegment(params: {
  segment: SegmentId;
  strategyIds?: StrategyId[];
  candlesOneMinute: LabCandle[];
  snapshots: LabSnapshot[];
  oiPoints: LabOIBuildupPoint[];
  profile?: ExecutionProfile;
  fromIso?: string;
  toIso?: string;
}): StrategyEvaluation[] {
  return evaluateStrategiesForSegmentDetailed(params).evaluations;
}
