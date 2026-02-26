/**
 * Yahoo Finance fallback for live index prices when Angel One / NSE unavailable.
 * Used in demo mode to show current market levels.
 */

const YAHOO_SYMBOLS: Record<string, string> = {
  NIFTY: "^NSEI",
  BANKNIFTY: "^NSEBANK",
  SENSEX: "^BSESN",
  MIDCPNIFTY: "NIFTY_MIDCAP_100.NS", // Nifty Midcap 100 as proxy
};

export async function fetchYahooIndexPrice(symbol: string): Promise<number | null> {
  const yahooSymbol = YAHOO_SYMBOLS[symbol];
  if (!yahooSymbol) return null;

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`,
      { cache: "no-store" }
    );
    const json = (await res.json()) as {
      chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> };
    };
    const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice;
    return typeof price === "number" && price > 0 ? Math.round(price) : null;
  } catch {
    return null;
  }
}
