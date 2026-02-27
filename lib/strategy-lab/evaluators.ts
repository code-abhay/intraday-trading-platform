import type { SegmentId } from "@/lib/segments";
import {
  adx,
  atr,
  bearishDivergence,
  bollingerBands,
  bullishDivergence,
  crossedAbove,
  crossedBelow,
  ema,
  highest,
  lowest,
  macd,
  obv,
  resampleCandles,
  rsi,
  sessionVWAP,
  sma,
  supertrend,
} from "@/lib/strategy-lab/indicators";
import { STRATEGY_LAB_RULES, STRATEGY_LAB_RULES_BY_ID } from "@/lib/strategy-lab/rules";
import type {
  LabCandle,
  LabOIBuildupPoint,
  LabSnapshot,
  SimulatedTrade,
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
  atr14: number[];
  adx14: number[];
  macdLine: number[];
  macdSignal: number[];
  macdHist: number[];
  bollingerUpper: number[];
  bollingerLower: number[];
  bollingerWidthPct: number[];
  obv: number[];
  supertrendLine: number[];
  supertrendTrend: Array<1 | -1>;
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
  const atr14 = atr(candles, rule.engine.atrPeriod);
  const adx14 = adx(candles, 14);
  const macdSeries = macd(close, 12, 26, 9);
  const bands = bollingerBands(close, 20, 2);
  const obvSeries = obv(candles);
  const st = supertrend(
    candles,
    Math.max(7, Math.round(rule.engine.params.supertrendAtrPeriod ?? 10)),
    Math.max(1.5, rule.engine.params.supertrendFactor ?? 3)
  );
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
    atr14,
    adx14,
    macdLine: macdSeries.line,
    macdSignal: macdSeries.signal,
    macdHist: macdSeries.histogram,
    bollingerUpper: bands.upper,
    bollingerLower: bands.lower,
    bollingerWidthPct: bands.bandwidthPct,
    obv: obvSeries,
    supertrendLine: st.line,
    supertrendTrend: st.trend,
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
  i: number
): SignalCandidate | null {
  if (i < 3) return null;
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

  const higherBullish = rule.engine.higherIntervalsMin.every((tf) => {
    const h = series.higher[tf];
    return h && h.ema9[i] > h.ema21[i] && h.close[i] >= h.ema21[i];
  });
  const higherBearish = rule.engine.higherIntervalsMin.every((tf) => {
    const h = series.higher[tf];
    return h && h.ema9[i] < h.ema21[i] && h.close[i] <= h.ema21[i];
  });

  switch (strategyId) {
    case "ema_macd_trend_acceleration": {
      const minAdx = rule.engine.params.minAdx ?? 25;
      const invalidationAdx = rule.engine.params.invalidationAdx ?? 20;
      const minSlope = rule.engine.params.minMacdHistSlope ?? 0.02;
      if (adxNow < invalidationAdx) return null;

      const longChecks = [
        higherBullish,
        close > ema9Now && ema9Now > ema21Now,
        adxNow >= minAdx,
        macdHistNow > 0 && macdHistNow > macdHistPrev + minSlope,
        crossedAbove(macdLine, macdSignal, i) || macdLine[i] > macdSignal[i],
      ];
      if (longChecks.every(Boolean)) {
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
      if (shortChecks.every(Boolean)) {
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

      return null;
    }

    case "supertrend_adx_continuation": {
      const minAdx = rule.engine.params.minAdx ?? 24;
      const higherTfAdx = rule.engine.params.higherTfAdx ?? 30;
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
      if (longChecks.every(Boolean)) {
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
      if (shortChecks.every(Boolean)) {
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

      return null;
    }

    case "vwap_delta_reversion": {
      const stretch = rule.engine.params.vwapStretchAtr ?? 1;
      const divLookback = Math.round(rule.engine.params.rsiDivergenceLookback ?? 18);
      const pcrUpper = rule.engine.params.pcrUpperExtreme ?? 1.3;
      const pcrLower = rule.engine.params.pcrLowerExtreme ?? 0.75;
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
      if (longChecks.every(Boolean)) {
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
      if (shortChecks.every(Boolean)) {
        const stop = highest(series.high, i, 5) + atrNow * 0.4;
        return {
          direction: "SHORT",
          confidence: confidenceFromChecks(58, shortChecks),
          reason: "VWAP rejection after overbought liquidity sweep",
          stopLoss: stop,
          trailingMode: "EMA9",
        };
      }

      return null;
    }

    case "gamma_expansion_breakout": {
      const squeezeWidth = rule.engine.params.squeezeBandwidthPct ?? 0.015;
      const adxPreMax = rule.engine.params.preBreakAdxMax ?? 20;
      const adxPostMin = rule.engine.params.postBreakAdxMin ?? 25;
      const volMult = rule.engine.params.breakoutVolumeMult ?? 1.5;

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
      if (longChecks.every(Boolean)) {
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
      if (shortChecks.every(Boolean)) {
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

      return null;
    }

    case "pcr_oi_sentiment_reversal": {
      const pcrUpper = rule.engine.params.pcrUpperExtreme ?? 1.35;
      const pcrLower = rule.engine.params.pcrLowerExtreme ?? 0.72;
      const minRsiLong = rule.engine.params.minRsiForLongRecovery ?? 32;
      const maxRsiShort = rule.engine.params.maxRsiForShortFade ?? 68;
      const snapshot = series.snapshotsAligned[i];
      if (!snapshot?.pcr) return null;
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
      if (longChecks.every(Boolean)) {
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
      if (shortChecks.every(Boolean)) {
        const stop = highest(series.high, i, 8) + atrNow * rule.engine.stopAtrMult;
        return {
          direction: "SHORT",
          confidence: confidenceFromChecks(56, shortChecks),
          reason: "PCR extreme fade with momentum rollover",
          stopLoss: stop,
          trailingMode: "EMA21",
        };
      }

      return null;
    }
    default:
      return null;
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
  oiPoints: LabOIBuildupPoint[]
): SimulatedTrade[] {
  const rule = STRATEGY_LAB_RULES_BY_ID[strategyId];
  const series = prepareSeries(candlesOneMinute, snapshots, oiPoints, rule);
  if (!series) return [];

  const trades: SimulatedTrade[] = [];
  const dailyRiskUsed = new Map<string, number>();
  let active: ActiveTrade | null = null;
  let lastExitIndex = -1000;

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
    if (i - lastExitIndex < rule.engine.minBarsBetweenTrades) continue;

    const usedRisk = dailyRiskUsed.get(day) ?? 0;
    if (usedRisk + rule.engine.riskPerTradePct > rule.engine.dailyRiskCapPct) continue;

    const candidate = detectSignal(strategyId, series, rule, i);
    if (!candidate) continue;

    const entry = series.close[i];
    const stop = resolveStop(candidate.direction, entry, candidate.stopLoss);
    const risk = Math.abs(entry - stop);
    if (!Number.isFinite(risk) || risk <= Math.max(0.05, entry * 0.0002)) continue;

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

    dailyRiskUsed.set(day, usedRisk + rule.engine.riskPerTradePct);
  }

  if (active) {
    const finalIndex = series.candles.length - 1;
    const finalClose = series.close[finalIndex];
    trades.push(finalizeTrade(active, finalIndex, finalClose, "Range end", series));
  }

  return trades;
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

export function computeEvaluationScore(
  kpis: StrategyKpis,
  quality: StrategyRuleSpec["qualityRating"]
): number {
  const scoreRaw =
    kpis.netR * 8 +
    (kpis.winRate / 100) * 20 +
    kpis.profitFactor * 6 +
    kpis.expectancyR * 12 +
    kpis.sharpeLike * 4 -
    kpis.maxDrawdownR * 5 +
    qualityBonus(quality);
  let score = scoreRaw;
  if (kpis.trades < 3) score -= 6;
  if (kpis.trades > 25) score += 2;
  return round2(score);
}

export function evaluateStrategyForSegment(
  strategyId: StrategyId,
  segment: SegmentId,
  candlesOneMinute: LabCandle[],
  snapshots: LabSnapshot[],
  oiPoints: LabOIBuildupPoint[]
): StrategyEvaluation {
  const rule = STRATEGY_LAB_RULES_BY_ID[strategyId];
  const trades = simulateStrategy(segment, strategyId, candlesOneMinute, snapshots, oiPoints);
  const kpis = computeKpis(trades);
  const score = computeEvaluationScore(kpis, rule.qualityRating);
  return {
    strategyId: rule.id,
    strategyName: rule.name,
    segment,
    qualityRating: rule.qualityRating,
    kpis,
    score,
    trades,
  };
}

export function evaluateStrategiesForSegment(params: {
  segment: SegmentId;
  strategyIds?: StrategyId[];
  candlesOneMinute: LabCandle[];
  snapshots: LabSnapshot[];
  oiPoints: LabOIBuildupPoint[];
}): StrategyEvaluation[] {
  const selected =
    params.strategyIds && params.strategyIds.length > 0
      ? STRATEGY_LAB_RULES.filter((rule) => params.strategyIds?.includes(rule.id))
      : STRATEGY_LAB_RULES;

  return selected
    .map((rule) =>
      evaluateStrategyForSegment(
        rule.id,
        params.segment,
        params.candlesOneMinute,
        params.snapshots,
        params.oiPoints
      )
    )
    .sort((a, b) => b.score - a.score);
}
