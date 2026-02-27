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
