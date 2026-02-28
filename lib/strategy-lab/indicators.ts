import type { LabCandle } from "@/lib/strategy-lab/types";

function safe(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    return fallback;
  }
  return value;
}

export function resampleCandles(candles: LabCandle[], intervalMin: number): LabCandle[] {
  if (intervalMin <= 1 || candles.length === 0) return candles;
  const ms = intervalMin * 60 * 1000;
  const bucketMap = new Map<number, LabCandle[]>();
  for (const candle of candles) {
    const t = new Date(candle.time).getTime();
    if (Number.isNaN(t)) continue;
    const bucket = Math.floor(t / ms) * ms;
    if (!bucketMap.has(bucket)) bucketMap.set(bucket, []);
    bucketMap.get(bucket)!.push(candle);
  }

  return Array.from(bucketMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([bucket, chunk]) => {
      const open = chunk[0].open;
      const close = chunk[chunk.length - 1].close;
      const high = chunk.reduce((m, row) => Math.max(m, row.high), Number.NEGATIVE_INFINITY);
      const low = chunk.reduce((m, row) => Math.min(m, row.low), Number.POSITIVE_INFINITY);
      const volume = chunk.reduce((sum, row) => sum + safe(row.volume, 0), 0);
      return {
        time: new Date(bucket).toISOString(),
        open,
        high,
        low,
        close,
        volume,
      };
    });
}

export function ema(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    out.push(values[i] * k + out[i - 1] * (1 - k));
  }
  return out;
}

export function sma(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const out: number[] = [];
  let rolling = 0;
  for (let i = 0; i < values.length; i++) {
    rolling += values[i];
    if (i >= period) rolling -= values[i - period];
    const div = i + 1 < period ? i + 1 : period;
    out.push(rolling / div);
  }
  return out;
}

export function stdDev(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const out: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - period + 1);
    const window = values.slice(start, i + 1);
    const mean = window.reduce((sum, v) => sum + v, 0) / Math.max(1, window.length);
    const variance =
      window.reduce((sum, v) => sum + (v - mean) ** 2, 0) / Math.max(1, window.length);
    out.push(Math.sqrt(variance));
  }
  return out;
}

export function rsi(closes: number[], period = 14): number[] {
  if (closes.length === 0) return [];
  if (closes.length < period + 1) return closes.map(() => 50);
  const out: number[] = Array(closes.length).fill(50);
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  for (let i = 0; i < period && i < out.length; i++) {
    out[i] = out[period];
  }
  return out;
}

export interface MACDSeries {
  line: number[];
  signal: number[];
  histogram: number[];
}

export function macd(
  closes: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): MACDSeries {
  if (closes.length === 0) return { line: [], signal: [], histogram: [] };
  const fast = ema(closes, fastPeriod);
  const slow = ema(closes, slowPeriod);
  const line = closes.map((_, i) => safe(fast[i], closes[i]) - safe(slow[i], closes[i]));
  const signal = ema(line, signalPeriod);
  const histogram = line.map((v, i) => v - safe(signal[i], v));
  return { line, signal, histogram };
}

export function trueRange(candles: LabCandle[]): number[] {
  if (candles.length === 0) return [];
  const tr: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    tr.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  return tr;
}

export function atr(candles: LabCandle[], period = 14): number[] {
  const tr = trueRange(candles);
  return ema(tr, period);
}

export function adx(candles: LabCandle[], period = 14): number[] {
  if (candles.length < 2) return candles.map(() => 0);

  const plusDM: number[] = [0];
  const minusDM: number[] = [0];
  for (let i = 1; i < candles.length; i++) {
    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  const atrSeries = atr(candles, period);
  const plusDI = ema(plusDM, period).map((v, i) => {
    const denom = atrSeries[i] || 1;
    return (100 * v) / denom;
  });
  const minusDI = ema(minusDM, period).map((v, i) => {
    const denom = atrSeries[i] || 1;
    return (100 * v) / denom;
  });

  const dx = plusDI.map((v, i) => {
    const m = minusDI[i];
    const denom = v + m;
    if (denom <= 0) return 0;
    return (100 * Math.abs(v - m)) / denom;
  });

  return ema(dx, period);
}

export interface BollingerBands {
  middle: number[];
  upper: number[];
  lower: number[];
  bandwidthPct: number[];
}

export function bollingerBands(
  closes: number[],
  period = 20,
  mult = 2
): BollingerBands {
  const middle = sma(closes, period);
  const std = stdDev(closes, period);
  const upper = closes.map((_, i) => middle[i] + mult * std[i]);
  const lower = closes.map((_, i) => middle[i] - mult * std[i]);
  const bandwidthPct = closes.map((_, i) => {
    const mid = Math.max(0.00001, middle[i]);
    return (upper[i] - lower[i]) / mid;
  });
  return { middle, upper, lower, bandwidthPct };
}

export function obv(candles: LabCandle[]): number[] {
  if (candles.length === 0) return [];
  const out: number[] = [0];
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].close > candles[i - 1].close) {
      out.push(out[i - 1] + safe(candles[i].volume, 0));
    } else if (candles[i].close < candles[i - 1].close) {
      out.push(out[i - 1] - safe(candles[i].volume, 0));
    } else {
      out.push(out[i - 1]);
    }
  }
  return out;
}

export interface SupertrendSeries {
  line: number[];
  trend: Array<1 | -1>;
}

export function supertrend(
  candles: LabCandle[],
  period = 10,
  factor = 3
): SupertrendSeries {
  if (candles.length === 0) return { line: [], trend: [] };
  const atrSeries = atr(candles, period);
  const upperBasic = candles.map(
    (c, i) => (c.high + c.low) / 2 + factor * safe(atrSeries[i], 0)
  );
  const lowerBasic = candles.map(
    (c, i) => (c.high + c.low) / 2 - factor * safe(atrSeries[i], 0)
  );

  const finalUpper: number[] = [upperBasic[0]];
  const finalLower: number[] = [lowerBasic[0]];
  const trend: Array<1 | -1> = [1];
  const line: number[] = [lowerBasic[0]];

  for (let i = 1; i < candles.length; i++) {
    finalUpper[i] =
      upperBasic[i] < finalUpper[i - 1] || candles[i - 1].close > finalUpper[i - 1]
        ? upperBasic[i]
        : finalUpper[i - 1];
    finalLower[i] =
      lowerBasic[i] > finalLower[i - 1] || candles[i - 1].close < finalLower[i - 1]
        ? lowerBasic[i]
        : finalLower[i - 1];

    if (trend[i - 1] === -1 && candles[i].close > finalUpper[i]) trend[i] = 1;
    else if (trend[i - 1] === 1 && candles[i].close < finalLower[i]) trend[i] = -1;
    else trend[i] = trend[i - 1];

    line[i] = trend[i] === 1 ? finalLower[i] : finalUpper[i];
  }

  return { line, trend };
}

export function sessionVWAP(candles: LabCandle[]): number[] {
  if (candles.length === 0) return [];
  const out: number[] = [];
  let cumulativeTpv = 0;
  let cumulativeVolume = 0;
  let currentSession = "";

  for (const candle of candles) {
    const date = new Date(candle.time);
    const session = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
    if (session !== currentSession) {
      currentSession = session;
      cumulativeTpv = 0;
      cumulativeVolume = 0;
    }
    const tp = (candle.high + candle.low + candle.close) / 3;
    cumulativeTpv += tp * safe(candle.volume, 0);
    cumulativeVolume += safe(candle.volume, 0);
    out.push(cumulativeVolume > 0 ? cumulativeTpv / cumulativeVolume : candle.close);
  }

  return out;
}

export function crossedAbove(a: number[], b: number[], i: number): boolean {
  if (i < 1 || i >= a.length || i >= b.length) return false;
  return a[i - 1] <= b[i - 1] && a[i] > b[i];
}

export function crossedBelow(a: number[], b: number[], i: number): boolean {
  if (i < 1 || i >= a.length || i >= b.length) return false;
  return a[i - 1] >= b[i - 1] && a[i] < b[i];
}

function isPivotLow(values: number[], i: number): boolean {
  if (i < 1 || i >= values.length - 1) return false;
  return values[i] <= values[i - 1] && values[i] <= values[i + 1];
}

function isPivotHigh(values: number[], i: number): boolean {
  if (i < 1 || i >= values.length - 1) return false;
  return values[i] >= values[i - 1] && values[i] >= values[i + 1];
}

function getRecentPivotIndices(
  values: number[],
  from: number,
  to: number,
  pivotFn: (arr: number[], idx: number) => boolean
): number[] {
  const out: number[] = [];
  for (let i = Math.max(1, from); i <= Math.min(values.length - 2, to); i++) {
    if (pivotFn(values, i)) out.push(i);
  }
  return out;
}

export function bullishDivergence(
  prices: number[],
  oscillator: number[],
  index: number,
  lookback = 20
): boolean {
  const start = Math.max(1, index - lookback);
  const pivots = getRecentPivotIndices(prices, start, index - 1, isPivotLow);
  if (pivots.length < 2) return false;
  const b = pivots[pivots.length - 1];
  const a = pivots[pivots.length - 2];
  return prices[b] < prices[a] && oscillator[b] > oscillator[a];
}

export function bearishDivergence(
  prices: number[],
  oscillator: number[],
  index: number,
  lookback = 20
): boolean {
  const start = Math.max(1, index - lookback);
  const pivots = getRecentPivotIndices(prices, start, index - 1, isPivotHigh);
  if (pivots.length < 2) return false;
  const b = pivots[pivots.length - 1];
  const a = pivots[pivots.length - 2];
  return prices[b] > prices[a] && oscillator[b] < oscillator[a];
}

export function highest(values: number[], index: number, length: number): number {
  const start = Math.max(0, index - length + 1);
  let h = Number.NEGATIVE_INFINITY;
  for (let i = start; i <= index; i++) {
    h = Math.max(h, values[i]);
  }
  return h;
}

export function lowest(values: number[], index: number, length: number): number {
  const start = Math.max(0, index - length + 1);
  let l = Number.POSITIVE_INFINITY;
  for (let i = start; i <= index; i++) {
    l = Math.min(l, values[i]);
  }
  return l;
}

export interface StochasticSeries {
  k: number[];
  d: number[];
}

export function stochastic(
  candles: LabCandle[],
  period = 14,
  smoothK = 3,
  smoothD = 3
): StochasticSeries {
  if (candles.length === 0) return { k: [], d: [] };
  const rawK = candles.map((candle, index) => {
    const start = Math.max(0, index - period + 1);
    let hh = Number.NEGATIVE_INFINITY;
    let ll = Number.POSITIVE_INFINITY;
    for (let i = start; i <= index; i++) {
      hh = Math.max(hh, candles[i].high);
      ll = Math.min(ll, candles[i].low);
    }
    const denom = hh - ll;
    if (denom <= 0) return 50;
    return ((candle.close - ll) / denom) * 100;
  });
  const k = sma(rawK, smoothK);
  const d = sma(k, smoothD);
  return { k, d };
}

export interface ParabolicSarSeries {
  sar: number[];
  trend: Array<1 | -1>;
}

export function parabolicSar(
  candles: LabCandle[],
  step = 0.02,
  maxStep = 0.2
): ParabolicSarSeries {
  if (candles.length === 0) return { sar: [], trend: [] };
  if (candles.length === 1) return { sar: [candles[0].low], trend: [1] };

  const sar: number[] = Array(candles.length).fill(0);
  const trend: Array<1 | -1> = Array(candles.length).fill(1);

  let isUpTrend = candles[1].close >= candles[0].close;
  let af = step;
  let ep = isUpTrend ? Math.max(candles[0].high, candles[1].high) : Math.min(candles[0].low, candles[1].low);
  sar[0] = isUpTrend ? candles[0].low : candles[0].high;
  sar[1] = isUpTrend ? candles[0].low : candles[0].high;
  trend[0] = isUpTrend ? 1 : -1;
  trend[1] = trend[0];

  for (let i = 2; i < candles.length; i++) {
    const prevSar = sar[i - 1];
    const current = candles[i];
    const prev = candles[i - 1];
    let nextSar = prevSar + af * (ep - prevSar);

    if (isUpTrend) {
      nextSar = Math.min(nextSar, prev.low, candles[i - 2].low);
      if (current.low < nextSar) {
        isUpTrend = false;
        nextSar = ep;
        ep = current.low;
        af = step;
      } else {
        if (current.high > ep) {
          ep = current.high;
          af = Math.min(maxStep, af + step);
        }
      }
    } else {
      nextSar = Math.max(nextSar, prev.high, candles[i - 2].high);
      if (current.high > nextSar) {
        isUpTrend = true;
        nextSar = ep;
        ep = current.high;
        af = step;
      } else {
        if (current.low < ep) {
          ep = current.low;
          af = Math.min(maxStep, af + step);
        }
      }
    }

    sar[i] = nextSar;
    trend[i] = isUpTrend ? 1 : -1;
  }

  return { sar, trend };
}

export interface FibLevels {
  level50: number;
  level618: number;
  level786: number;
}

export function fibLevelsFromRange(high: number, low: number): FibLevels {
  const range = high - low;
  return {
    level50: high - range * 0.5,
    level618: high - range * 0.618,
    level786: high - range * 0.786,
  };
}

export function mfi(candles: LabCandle[], period = 14): number[] {
  if (candles.length === 0) return [];
  const typical = candles.map((c) => (c.high + c.low + c.close) / 3);
  const moneyFlow = candles.map((c, i) => typical[i] * safe(c.volume, 0));
  const positive: number[] = Array(candles.length).fill(0);
  const negative: number[] = Array(candles.length).fill(0);

  for (let i = 1; i < candles.length; i++) {
    if (typical[i] > typical[i - 1]) {
      positive[i] = moneyFlow[i];
    } else if (typical[i] < typical[i - 1]) {
      negative[i] = moneyFlow[i];
    }
  }

  const out: number[] = Array(candles.length).fill(50);
  let posRoll = 0;
  let negRoll = 0;
  for (let i = 0; i < candles.length; i++) {
    posRoll += positive[i];
    negRoll += negative[i];
    if (i >= period) {
      posRoll -= positive[i - period];
      negRoll -= negative[i - period];
    }
    if (i + 1 < period) {
      out[i] = i > 0 ? out[i - 1] : 50;
      continue;
    }
    if (negRoll <= 0 && posRoll <= 0) {
      out[i] = 50;
      continue;
    }
    if (negRoll <= 0) {
      out[i] = 100;
      continue;
    }
    const ratio = posRoll / Math.max(0.00001, negRoll);
    out[i] = 100 - 100 / (1 + ratio);
  }
  return out;
}

export interface AroonSeries {
  up: number[];
  down: number[];
}

export function aroon(candles: LabCandle[], period = 14): AroonSeries {
  if (candles.length === 0) return { up: [], down: [] };
  const up: number[] = [];
  const down: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    const start = Math.max(0, i - period + 1);
    let highestIndex = start;
    let lowestIndex = start;
    for (let j = start; j <= i; j++) {
      if (candles[j].high >= candles[highestIndex].high) highestIndex = j;
      if (candles[j].low <= candles[lowestIndex].low) lowestIndex = j;
    }
    const span = Math.max(1, i - start + 1);
    const barsSinceHigh = i - highestIndex;
    const barsSinceLow = i - lowestIndex;
    up.push(((span - barsSinceHigh) / span) * 100);
    down.push(((span - barsSinceLow) / span) * 100);
  }
  return { up, down };
}

export interface IchimokuSeries {
  tenkan: number[];
  kijun: number[];
  spanA: number[];
  spanB: number[];
}

export function ichimoku(
  candles: LabCandle[],
  conversionPeriod = 9,
  basePeriod = 26,
  spanBPeriod = 52
): IchimokuSeries {
  if (candles.length === 0) return { tenkan: [], kijun: [], spanA: [], spanB: [] };

  function midpoint(index: number, length: number): number {
    const start = Math.max(0, index - length + 1);
    let hh = Number.NEGATIVE_INFINITY;
    let ll = Number.POSITIVE_INFINITY;
    for (let i = start; i <= index; i++) {
      hh = Math.max(hh, candles[i].high);
      ll = Math.min(ll, candles[i].low);
    }
    return (hh + ll) / 2;
  }

  const tenkan = candles.map((_, i) => midpoint(i, conversionPeriod));
  const kijun = candles.map((_, i) => midpoint(i, basePeriod));
  const spanA = candles.map((_, i) => (tenkan[i] + kijun[i]) / 2);
  const spanB = candles.map((_, i) => midpoint(i, spanBPeriod));
  return { tenkan, kijun, spanA, spanB };
}

function toIstTimeParts(value: string): { sessionKey: string; minuteOfDay: number } | null {
  const date = new Date(value);
  const ms = date.getTime();
  if (Number.isNaN(ms)) return null;
  const ist = new Date(ms + 330 * 60 * 1000);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const d = String(ist.getUTCDate()).padStart(2, "0");
  return {
    sessionKey: `${y}-${m}-${d}`,
    minuteOfDay: ist.getUTCHours() * 60 + ist.getUTCMinutes(),
  };
}

export interface InitialBalanceRangeSeries {
  high: number[];
  low: number[];
}

export function initialBalanceRange(
  candles: LabCandle[],
  openingRangeMinutes = 45
): InitialBalanceRangeSeries {
  if (candles.length === 0) return { high: [], low: [] };
  const outHigh: number[] = [];
  const outLow: number[] = [];

  let currentSession = "";
  let ibHigh = Number.NEGATIVE_INFINITY;
  let ibLow = Number.POSITIVE_INFINITY;

  for (let i = 0; i < candles.length; i++) {
    const parts = toIstTimeParts(candles[i].time);
    if (!parts) {
      outHigh.push(i > 0 ? outHigh[i - 1] : candles[i].high);
      outLow.push(i > 0 ? outLow[i - 1] : candles[i].low);
      continue;
    }
    if (parts.sessionKey !== currentSession) {
      currentSession = parts.sessionKey;
      ibHigh = Number.NEGATIVE_INFINITY;
      ibLow = Number.POSITIVE_INFINITY;
    }

    const minuteFromOpen = parts.minuteOfDay - (9 * 60 + 15);
    if (minuteFromOpen >= 0 && minuteFromOpen <= openingRangeMinutes) {
      ibHigh = Math.max(ibHigh, candles[i].high);
      ibLow = Math.min(ibLow, candles[i].low);
    }
    if (!Number.isFinite(ibHigh) || !Number.isFinite(ibLow)) {
      ibHigh = candles[i].high;
      ibLow = candles[i].low;
    }

    outHigh.push(ibHigh);
    outLow.push(ibLow);
  }

  return { high: outHigh, low: outLow };
}

export interface VolumeStructureSeries {
  hvn: number[];
  lvn: number[];
  vacuum: number[];
}

export function volumeStructureNodes(
  candles: LabCandle[],
  lookback = 48,
  bins = 12
): VolumeStructureSeries {
  if (candles.length === 0) return { hvn: [], lvn: [], vacuum: [] };

  const hvn: number[] = [];
  const lvn: number[] = [];
  const vacuum: number[] = [];
  const safeBins = Math.max(6, Math.round(bins));
  const safeLookback = Math.max(16, Math.round(lookback));

  for (let i = 0; i < candles.length; i++) {
    const start = Math.max(0, i - safeLookback + 1);
    let rangeHigh = Number.NEGATIVE_INFINITY;
    let rangeLow = Number.POSITIVE_INFINITY;
    for (let j = start; j <= i; j++) {
      rangeHigh = Math.max(rangeHigh, candles[j].high);
      rangeLow = Math.min(rangeLow, candles[j].low);
    }
    const range = Math.max(0.00001, rangeHigh - rangeLow);
    const step = range / safeBins;
    const volumeBins = Array(safeBins).fill(0);

    for (let j = start; j <= i; j++) {
      const tp = (candles[j].high + candles[j].low + candles[j].close) / 3;
      const idx = Math.max(
        0,
        Math.min(safeBins - 1, Math.floor((tp - rangeLow) / Math.max(0.00001, step)))
      );
      volumeBins[idx] += safe(candles[j].volume, 0);
    }

    let hvnIdx = 0;
    let lvnIdx = 0;
    for (let j = 1; j < volumeBins.length; j++) {
      if (volumeBins[j] > volumeBins[hvnIdx]) hvnIdx = j;
      if (volumeBins[j] < volumeBins[lvnIdx]) lvnIdx = j;
    }

    const close = candles[i].close;
    const currentIdx = Math.max(
      0,
      Math.min(safeBins - 1, Math.floor((close - rangeLow) / Math.max(0.00001, step)))
    );
    const maxVol = Math.max(1, volumeBins[hvnIdx]);
    const currentVol = volumeBins[currentIdx];

    hvn.push(rangeLow + (hvnIdx + 0.5) * step);
    lvn.push(rangeLow + (lvnIdx + 0.5) * step);
    vacuum.push(Math.max(0, Math.min(1, 1 - currentVol / maxVol)));
  }

  return { hvn, lvn, vacuum };
}
