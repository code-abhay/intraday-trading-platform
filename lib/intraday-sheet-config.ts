export type IntradayExchange = "NSE" | "BSE";

export interface IntradaySheetSymbol {
  symbol: string;
  sourceSymbols: string[];
  preferredExchange: IntradayExchange;
  aliases: string[];
}

export const INTRADAY_DEFAULT_CAPITAL = 100_000;
export const INTRADAY_TARGET_RATE = 0.012;
export const INTRADAY_FEE_RATE = 0.002;
export const INTRADAY_BREAKOUT_MULTIPLIER = 1.01;
export const INTRADAY_BREAKDOWN_MULTIPLIER = 0.99;
export const INTRADAY_WATCH_BREAKOUT_MULTIPLIER = 1.009;
export const INTRADAY_SELL_MULTIPLIER = 1.018;

export const INTRADAY_POLL_INTERVAL_MS = 30_000;
export const INTRADAY_API_CACHE_TTL_MS = 12_000;

const RAW_EXCEL_SYMBOLS = [
  "JIOFIN",
  "KOTAKBANK",
  "AXISBANK",
  "BAJAJ-AUTO",
  "ICICIBANK",
  "SBIN",
  "INDUSINDBK",
  "SUNPHARMA",
  "HDFCLIFE",
  "HDFCBANK",
  "TATACONSUM",
  "SBILIFE",
  "DIVISLAB",
  "NESTLEIND",
  "HEROMOTOCO",
  "M&M",
  "NSE:LT",
  "EICHERMOT",
  "SHREECEM",
  "BAJAJFINSv",
  "RELIANCE",
  "MARUTI",
  "HCLTECH",
  "ASIANPAINT",
  "pnb",
  "TATAMOTORS",
  "NSE:IOC",
  "HINDUNILVR",
  "BRITANNIA",
  "BHARTIARTL",
  "NHPC",
  "nse:TITAN",
  "GRASIM",
  "CIPLA",
  "NSE:ITC",
  "HINDALCO",
  "NSE:TCS",
  "ADANIPORTS",
  "NSE:UPL",
  "BAJFINANCE",
  "ULTRACEMCO",
  "DRREDDY",
  "BPCL",
  "NSE:INFY",
  "TECHM",
  "COALINDIA",
  "JSWSTEEL",
  "TATASTEEL",
  "POWERGRID",
  "WIPRO",
  "ONGC",
  "hdfclife",
] as const;

const SYMBOL_RENAMES: Record<string, string> = {
  "NSE:LT": "LT",
  "NSE:IOC": "IOC",
  "NSE:TITAN": "TITAN",
  "NSE:ITC": "ITC",
  "NSE:TCS": "TCS",
  "NSE:UPL": "UPL",
  "NSE:INFY": "INFY",
};

function normalizeSymbol(raw: string): string {
  const upper = raw.trim().toUpperCase();
  const withoutPrefix = upper.replace(/^NSE:/, "").replace(/^BSE:/, "");
  const renamed = SYMBOL_RENAMES[upper] ?? SYMBOL_RENAMES[withoutPrefix] ?? withoutPrefix;
  return renamed;
}

function buildSymbols(): IntradaySheetSymbol[] {
  const deduped = new Map<string, IntradaySheetSymbol>();

  for (const raw of RAW_EXCEL_SYMBOLS) {
    const normalized = normalizeSymbol(raw);
    const existing = deduped.get(normalized);
    if (existing) {
      if (!existing.sourceSymbols.includes(raw)) {
        existing.sourceSymbols.push(raw);
      }
      continue;
    }

    deduped.set(normalized, {
      symbol: normalized,
      sourceSymbols: [raw],
      preferredExchange: "NSE",
      aliases: [raw.toUpperCase(), raw, `${normalized}-EQ`],
    });
  }

  return Array.from(deduped.values());
}

export const INTRADAY_SHEET_SYMBOLS: IntradaySheetSymbol[] = buildSymbols();
