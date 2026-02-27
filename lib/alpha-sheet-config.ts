export type AlphaExchange = "NSE" | "BSE";

export interface AlphaSheetSymbol {
  sheetRow: number;
  symbol: string;
  sourceSymbol: string;
  preferredExchange: AlphaExchange;
  aliases: string[];
}

export const ALPHA_BREAKOUT_MULTIPLIER = 1.01;
export const ALPHA_BREAKDOWN_MULTIPLIER = 0.99;
export const ALPHA_CAPITAL = 300_000;
export const ALPHA_TARGET_AMOUNT = 3_500;

export const ALPHA_SIGNAL_START_ROW = 3;
export const ALPHA_SIGNAL_END_ROW = 53;

export const ALPHA_Q1_QUANTITY = 798;
export const ALPHA_Q2_QUANTITY = 966;
export const ALPHA_P1_PRICE = 128.54;
export const ALPHA_P2_PRICE = 129.3;
export const ALPHA_GOLD_SYMBOL = "GOLDETF";
export const ALPHA_GOLD_FALLBACK_PRICE = 154.4;
export const ALPHA_RISK_RATE = 0.02;

export const ALPHA_POLL_INTERVAL_MS = 30_000;
export const ALPHA_API_CACHE_TTL_MS = 12_000;

const RAW_ALPHA_SYMBOLS: Array<{ sheetRow: number; symbol: string }> = [
  { sheetRow: 3, symbol: "ADANIENT" },
  { sheetRow: 4, symbol: "ADANIPORTS" },
  { sheetRow: 5, symbol: "APOLLOHOSP" },
  { sheetRow: 6, symbol: "ASIANPAINT" },
  { sheetRow: 7, symbol: "AXISBANK" },
  { sheetRow: 8, symbol: "BAJAJ-AUTO" },
  { sheetRow: 9, symbol: "BAJAJFINSV" },
  { sheetRow: 10, symbol: "BAJFINANCE" },
  { sheetRow: 11, symbol: "BHARTIARTL" },
  { sheetRow: 12, symbol: "BPCL" },
  { sheetRow: 13, symbol: "BRITANNIA" },
  { sheetRow: 14, symbol: "CIPLA" },
  { sheetRow: 15, symbol: "COALINDIA" },
  { sheetRow: 16, symbol: "DRREDDY" },
  { sheetRow: 17, symbol: "EICHERMOT" },
  { sheetRow: 18, symbol: "GRASIM" },
  { sheetRow: 19, symbol: "HCLTECH" },
  { sheetRow: 20, symbol: "HDFCBANK" },
  { sheetRow: 21, symbol: "HDFCLIFE" },
  { sheetRow: 22, symbol: "HEROMOTOCO" },
  { sheetRow: 23, symbol: "HINDALCO" },
  { sheetRow: 24, symbol: "HINDUNILVR" },
  { sheetRow: 25, symbol: "ICICIBANK" },
  { sheetRow: 26, symbol: "INDUSINDBK" },
  { sheetRow: 27, symbol: "IPCALAB" },
  { sheetRow: 28, symbol: "JSWSTEEL" },
  { sheetRow: 29, symbol: "KOTAKBANK" },
  { sheetRow: 30, symbol: "LT" },
  { sheetRow: 31, symbol: "M&M" },
  { sheetRow: 32, symbol: "MARUTI" },
  { sheetRow: 33, symbol: "NESTLEIND" },
  { sheetRow: 34, symbol: "nse:BEL" },
  { sheetRow: 35, symbol: "NSE:INFY" },
  { sheetRow: 36, symbol: "nse:ITC" },
  { sheetRow: 37, symbol: "nse:TCS" },
  { sheetRow: 38, symbol: "nse:TITAN" },
  { sheetRow: 39, symbol: "NTPC" },
  { sheetRow: 40, symbol: "ONGC" },
  { sheetRow: 41, symbol: "POWERGRID" },
  { sheetRow: 42, symbol: "RELIANCE" },
  { sheetRow: 43, symbol: "SBILIFE" },
  { sheetRow: 44, symbol: "SBIN" },
  { sheetRow: 45, symbol: "SHRIRAMFIN" },
  { sheetRow: 46, symbol: "SUNPHARMA" },
  { sheetRow: 47, symbol: "TATACONSUM" },
  { sheetRow: 48, symbol: "TMPV" },
  { sheetRow: 49, symbol: "TATASTEEL" },
  { sheetRow: 50, symbol: "TECHM" },
  { sheetRow: 51, symbol: "TRENT" },
  { sheetRow: 52, symbol: "ULTRACEMCO" },
  { sheetRow: 53, symbol: "WIPRO" },
  { sheetRow: 54, symbol: "GOLDBEES" },
  { sheetRow: 55, symbol: "GOLDETF" },
];

const ALPHA_SYMBOL_RENAMES: Record<string, string> = {
  "NSE:BEL": "BEL",
  "NSE:INFY": "INFY",
  "NSE:ITC": "ITC",
  "NSE:TCS": "TCS",
  "NSE:TITAN": "TITAN",
};

function normalizeSymbol(raw: string): string {
  const upper = raw.trim().toUpperCase();
  const noPrefix = upper.replace(/^NSE:/, "").replace(/^BSE:/, "");
  return ALPHA_SYMBOL_RENAMES[upper] ?? ALPHA_SYMBOL_RENAMES[noPrefix] ?? noPrefix;
}

export const ALPHA_SHEET_SYMBOLS: AlphaSheetSymbol[] = RAW_ALPHA_SYMBOLS.map(
  ({ sheetRow, symbol }) => {
    const normalized = normalizeSymbol(symbol);
    return {
      sheetRow,
      symbol: normalized,
      sourceSymbol: symbol,
      preferredExchange: "NSE",
      aliases: [symbol, symbol.toUpperCase(), normalized, `${normalized}-EQ`],
    };
  }
);
