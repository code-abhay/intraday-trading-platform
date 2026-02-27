import {
  INTRADAY_BREAKDOWN_MULTIPLIER,
  INTRADAY_BREAKOUT_MULTIPLIER,
  INTRADAY_DEFAULT_CAPITAL,
  INTRADAY_FEE_RATE,
  INTRADAY_SELL_MULTIPLIER,
  INTRADAY_TARGET_RATE,
  INTRADAY_WATCH_BREAKOUT_MULTIPLIER,
} from "@/lib/intraday-sheet-config";

export interface IntradayQuote {
  price: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  prevClose: number | null;
  changePct: number | null;
}

export interface IntradayRowInput {
  symbol: string;
  quote: IntradayQuote | null;
  unavailableReason?: string | null;
}

export interface IntradaySheetGlobals {
  capital: number;
  targetAmount: number;
  feeAmount: number;
  gainAmount: number;
  gainRatio: number;
  monthlyProjection: number;
}

export interface IntradaySheetRow {
  symbol: string;
  quoteStatus: "ok" | "unavailable";
  unavailableReason: string | null;
  price: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  prevClose: number | null;
  changePct: number | null;
  watchBreakout: boolean | null;
  breakout: boolean | null;
  breakdown: boolean | null;
  tradeLabel: string | null;
  buySignal: number | null;
  sellSignal: number | null;
  buy: number | null;
  sell: number | null;
  targetPerShare: number | null;
  shares: number | null;
  profit: number | null;
  cmp: number | null;
  value: number | null;
  slDelta: number | null;
}

export interface IntradaySheetTotals {
  symbolCount: number;
  quotedCount: number;
  unavailableCount: number;
  breakoutCount: number;
  breakdownCount: number;
  watchBreakoutCount: number;
}

function toFiniteNumber(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value)) return null;
  return value;
}

function deriveChangePct(price: number | null, prevClose: number | null): number | null {
  if (price == null || prevClose == null || prevClose <= 0) return null;
  return ((price - prevClose) / prevClose) * 100;
}

export function computeIntradaySheetGlobals(
  capital: number = INTRADAY_DEFAULT_CAPITAL
): IntradaySheetGlobals {
  const targetAmount = capital * INTRADAY_TARGET_RATE;
  const feeAmount = capital * INTRADAY_FEE_RATE;
  const gainAmount = targetAmount - feeAmount;
  const gainRatio = capital > 0 ? gainAmount / capital : 0;
  const monthlyProjection = capital * ((1 + gainRatio) ** 20) - capital;

  return {
    capital,
    targetAmount,
    feeAmount,
    gainAmount,
    gainRatio,
    monthlyProjection,
  };
}

export function computeIntradaySheetRow(
  input: IntradayRowInput,
  globals: IntradaySheetGlobals
): IntradaySheetRow {
  const symbol = input.symbol;
  const quote = input.quote;

  const price = toFiniteNumber(quote?.price);
  const open = toFiniteNumber(quote?.open);
  const high = toFiniteNumber(quote?.high);
  const low = toFiniteNumber(quote?.low);
  const prevClose = toFiniteNumber(quote?.prevClose);
  const quoteChangePct = toFiniteNumber(quote?.changePct);
  const changePct = quoteChangePct ?? deriveChangePct(price, prevClose);

  const quoteStatus: "ok" | "unavailable" =
    quote && (price != null || open != null || high != null || low != null || prevClose != null)
      ? "ok"
      : "unavailable";

  const canCompute = prevClose != null && prevClose > 0;
  const hasCmp = price != null;

  const watchBreakout =
    canCompute && hasCmp ? price > INTRADAY_WATCH_BREAKOUT_MULTIPLIER * prevClose : null;
  const breakout = canCompute && hasCmp ? price > INTRADAY_BREAKOUT_MULTIPLIER * prevClose : null;
  const breakdown =
    canCompute && hasCmp ? price < INTRADAY_BREAKDOWN_MULTIPLIER * prevClose : null;

  const buySignal =
    canCompute && breakout ? prevClose * INTRADAY_BREAKOUT_MULTIPLIER : null;
  const sellSignal =
    canCompute && buySignal != null ? prevClose * INTRADAY_SELL_MULTIPLIER : null;

  const buy = canCompute ? prevClose * INTRADAY_BREAKOUT_MULTIPLIER : null;
  const shares =
    buy != null && buy > 0 ? Math.floor(globals.capital / buy) : null;
  const validShares = shares != null && shares > 0 ? shares : null;
  const targetPerShare =
    validShares != null ? globals.targetAmount / validShares : null;
  const sell = buy != null && targetPerShare != null ? buy + targetPerShare : null;
  const profit =
    validShares != null && targetPerShare != null ? validShares * targetPerShare : null;
  const cmp = price;
  const value = validShares != null && buy != null ? validShares * buy : null;
  const slDelta = sell != null && cmp != null ? sell - cmp : null;
  const tradeLabel = validShares != null ? `${symbol} * ${validShares}` : null;

  return {
    symbol,
    quoteStatus,
    unavailableReason: quoteStatus === "unavailable" ? input.unavailableReason ?? "Quote unavailable" : null,
    price,
    open,
    high,
    low,
    prevClose,
    changePct,
    watchBreakout,
    breakout,
    breakdown,
    tradeLabel,
    buySignal,
    sellSignal,
    buy,
    sell,
    targetPerShare,
    shares: validShares,
    profit,
    cmp,
    value,
    slDelta,
  };
}

export function computeIntradaySheetTotals(rows: IntradaySheetRow[]): IntradaySheetTotals {
  let quotedCount = 0;
  let unavailableCount = 0;
  let breakoutCount = 0;
  let breakdownCount = 0;
  let watchBreakoutCount = 0;

  for (const row of rows) {
    if (row.quoteStatus === "ok") quotedCount++;
    if (row.quoteStatus === "unavailable") unavailableCount++;
    if (row.breakout === true) breakoutCount++;
    if (row.breakdown === true) breakdownCount++;
    if (row.watchBreakout === true) watchBreakoutCount++;
  }

  return {
    symbolCount: rows.length,
    quotedCount,
    unavailableCount,
    breakoutCount,
    breakdownCount,
    watchBreakoutCount,
  };
}
