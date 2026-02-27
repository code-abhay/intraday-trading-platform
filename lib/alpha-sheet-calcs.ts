import {
  ALPHA_BREAKDOWN_MULTIPLIER,
  ALPHA_BREAKOUT_MULTIPLIER,
  ALPHA_CAPITAL,
  ALPHA_GOLD_FALLBACK_PRICE,
  ALPHA_GOLD_SYMBOL,
  ALPHA_P1_PRICE,
  ALPHA_P2_PRICE,
  ALPHA_Q1_QUANTITY,
  ALPHA_Q2_QUANTITY,
  ALPHA_RISK_RATE,
  ALPHA_TARGET_AMOUNT,
} from "@/lib/alpha-sheet-config";

export interface AlphaQuote {
  price: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  prevClose: number | null;
  change: number | null;
  changePct: number | null;
}

export interface AlphaRowInput {
  sheetRow: number;
  symbol: string;
  quote: AlphaQuote | null;
  unavailableReason?: string | null;
}

export interface AlphaSheetRow {
  sheetRow: number;
  symbol: string;
  quoteStatus: "ok" | "unavailable";
  unavailableReason: string | null;
  ltp: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  prevClose: number | null;
  change: number | null;
  changePct: number | null;
  breakout: boolean | null;
  breakdown: boolean | null;
  upSignal: "breakout" | " ";
  downSignal: "breakdown" | " ";
  buy: number | null; // O
  quantity: number | null; // P
  targetPerShare: number | null; // Q
}

export interface AlphaSheetTotals {
  symbolCount: number;
  quotedCount: number;
  unavailableCount: number;
  breakoutCount: number;
  breakdownCount: number;
}

export interface AlphaSheetSummary {
  timestampIso: string; // J56
  breakoutCount: number; // M56
  breakdownCount: number; // N56
  sellingCount: number; // K57
  buyingCount: number; // K58
  bias: "Bullish" | "Bearish"; // J59
  netAdvance: number; // K59
}

export interface AlphaPortfolioSummary {
  q1Label: "Q1";
  q2Label: "Q2";
  finalLabel: "Final";
  q1Qty: number; // T5
  q2Qty: number; // U5
  p1Label: "P1";
  p1Price: number; // T6
  p2Label: "P2";
  p2Price: number; // T7
  weightedAverage: number; // V5
  totalQuantity: number; // V6
  goldSymbol: string; // U9
  goldPrice: number; // V9
  pnl: number; // V10
  totalInvested: number; // V11
  riskRate: number; // U12
  riskAmount: number; // V12
}

function toFiniteNumber(value: number | null | undefined): number | null {
  if (value == null) return null;
  return Number.isFinite(value) ? value : null;
}

function deriveChange(ltp: number | null, prevClose: number | null): number | null {
  if (ltp == null || prevClose == null) return null;
  return ltp - prevClose;
}

function deriveChangePct(ltp: number | null, prevClose: number | null): number | null {
  if (ltp == null || prevClose == null || prevClose === 0) return null;
  return ((ltp - prevClose) / prevClose) * 100;
}

export function computeAlphaSheetRow(input: AlphaRowInput): AlphaSheetRow {
  const ltp = toFiniteNumber(input.quote?.price);
  const open = toFiniteNumber(input.quote?.open);
  const high = toFiniteNumber(input.quote?.high);
  const low = toFiniteNumber(input.quote?.low);
  const prevClose = toFiniteNumber(input.quote?.prevClose);

  const providedChange = toFiniteNumber(input.quote?.change);
  const providedChangePct = toFiniteNumber(input.quote?.changePct);
  const change = providedChange ?? deriveChange(ltp, prevClose);
  const changePct = providedChangePct ?? deriveChangePct(ltp, prevClose);

  const hasQuote = ltp != null || open != null || high != null || low != null || prevClose != null;
  const quoteStatus: "ok" | "unavailable" = hasQuote ? "ok" : "unavailable";

  const canSignal = ltp != null && prevClose != null && prevClose > 0;
  const breakout = canSignal ? ltp > ALPHA_BREAKOUT_MULTIPLIER * prevClose : null;
  const breakdown = canSignal ? ltp < ALPHA_BREAKDOWN_MULTIPLIER * prevClose : null;

  const upSignal: "breakout" | " " = breakout ? "breakout" : " ";
  const downSignal: "breakdown" | " " = breakdown ? "breakdown" : " ";

  const buy = prevClose != null ? ALPHA_BREAKOUT_MULTIPLIER * prevClose : null;
  const quantity = ltp != null && ltp > 0 ? Math.floor(ALPHA_CAPITAL / ltp) : null;
  const validQty = quantity != null && quantity > 0 ? quantity : null;
  const targetPerShare = validQty != null ? ALPHA_TARGET_AMOUNT / validQty : null;

  return {
    sheetRow: input.sheetRow,
    symbol: input.symbol,
    quoteStatus,
    unavailableReason: quoteStatus === "unavailable" ? input.unavailableReason ?? "Quote unavailable" : null,
    ltp,
    open,
    high,
    low,
    prevClose,
    change,
    changePct,
    breakout,
    breakdown,
    upSignal,
    downSignal,
    buy,
    quantity: validQty,
    targetPerShare,
  };
}

export function computeAlphaSheetTotals(rows: AlphaSheetRow[]): AlphaSheetTotals {
  let quotedCount = 0;
  let unavailableCount = 0;
  let breakoutCount = 0;
  let breakdownCount = 0;

  for (const row of rows) {
    if (row.quoteStatus === "ok") quotedCount++;
    if (row.quoteStatus === "unavailable") unavailableCount++;
    if (row.breakout === true) breakoutCount++;
    if (row.breakdown === true) breakdownCount++;
  }

  return {
    symbolCount: rows.length,
    quotedCount,
    unavailableCount,
    breakoutCount,
    breakdownCount,
  };
}

export function computeAlphaSheetSummary(
  rows: AlphaSheetRow[],
  now: Date = new Date()
): AlphaSheetSummary {
  const breakoutCount = rows.filter((row) => row.upSignal === "breakout").length;
  const breakdownCount = rows.filter((row) => row.downSignal === "breakdown").length;
  const sellingCount = rows.filter((row) => (row.change ?? 0) < 0).length;
  const buyingCount = rows.filter((row) => (row.change ?? 0) > 0).length;
  const bias: "Bullish" | "Bearish" = buyingCount > sellingCount ? "Bullish" : "Bearish";
  const netAdvance = buyingCount - sellingCount;

  return {
    timestampIso: now.toISOString(),
    breakoutCount,
    breakdownCount,
    sellingCount,
    buyingCount,
    bias,
    netAdvance,
  };
}

export function computeAlphaPortfolioSummary(rows: AlphaSheetRow[]): AlphaPortfolioSummary {
  const weightedAverage =
    (ALPHA_Q1_QUANTITY * ALPHA_P1_PRICE + ALPHA_Q2_QUANTITY * ALPHA_P2_PRICE) /
    (ALPHA_Q1_QUANTITY + ALPHA_Q2_QUANTITY);
  const totalQuantity = ALPHA_Q1_QUANTITY + ALPHA_Q2_QUANTITY;

  const goldRow = rows.find((row) => row.symbol.toUpperCase() === ALPHA_GOLD_SYMBOL);
  const goldPrice = goldRow?.ltp ?? ALPHA_GOLD_FALLBACK_PRICE;
  const pnl = totalQuantity * (goldPrice - weightedAverage);
  const totalInvested = weightedAverage * totalQuantity;
  const riskAmount = ALPHA_RISK_RATE * totalInvested;

  return {
    q1Label: "Q1",
    q2Label: "Q2",
    finalLabel: "Final",
    q1Qty: ALPHA_Q1_QUANTITY,
    q2Qty: ALPHA_Q2_QUANTITY,
    p1Label: "P1",
    p1Price: ALPHA_P1_PRICE,
    p2Label: "P2",
    p2Price: ALPHA_P2_PRICE,
    weightedAverage,
    totalQuantity,
    goldSymbol: ALPHA_GOLD_SYMBOL,
    goldPrice,
    pnl,
    totalInvested,
    riskRate: ALPHA_RISK_RATE,
    riskAmount,
  };
}
