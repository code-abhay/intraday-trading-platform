/**
 * Angel One SmartAPI client
 * Docs: https://smartapi.angelbroking.com/docs
 */

const BASE_URL = "https://apiconnect.angelone.in";

export interface AngelOneConfig {
  apiKey: string;
  clientId: string;
  pin: string;
}

export interface AngelOneTokens {
  jwtToken: string;
  refreshToken: string;
  feedToken: string;
}

export interface AngelOneLoginResponse {
  status: boolean;
  message: string;
  data?: AngelOneTokens;
  errorcode?: string;
}

export interface AngelOnePCRItem {
  pcr: number;
  tradingSymbol: string;
}

export interface AngelOneOIBuildupItem {
  symbolToken: string;
  ltp: string;
  netChange: string;
  percentChange: string | number;
  tradingSymbol: string;
  opnInterest: string | number;
  netChangeOpnInterest: string | number;
}

function getAngelHeaders(jwtToken: string, apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${jwtToken}`,
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-ClientLocalIP": "127.0.0.1",
    "X-ClientPublicIP": "127.0.0.1",
    "X-MACAddress": "00:00:00:00:00:00",
    "X-PrivateKey": apiKey,
  };
}

export async function angelOneLogin(
  config: AngelOneConfig,
  totp: string
): Promise<AngelOneTokens> {
  const res = await fetch(
    `${BASE_URL}/rest/auth/angelbroking/user/v1/loginByPassword`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-UserType": "USER",
        "X-SourceID": "WEB",
        "X-ClientLocalIP": "127.0.0.1",
        "X-ClientPublicIP": "127.0.0.1",
        "X-MACAddress": "00:00:00:00:00:00",
        "X-PrivateKey": config.apiKey,
      },
      body: JSON.stringify({
        clientcode: config.clientId,
        password: config.pin,
        totp,
      }),
    }
  );

  const json = (await res.json()) as AngelOneLoginResponse;
  if (!json.status || !json.data) {
    throw new Error(json.message || json.errorcode || "Login failed");
  }
  return json.data;
}

export async function angelOneGetPCR(
  jwtToken: string,
  apiKey: string
): Promise<AngelOnePCRItem[]> {
  const res = await fetch(
    `${BASE_URL}/rest/secure/angelbroking/marketData/v1/putCallRatio`,
    {
      method: "GET",
      headers: getAngelHeaders(jwtToken, apiKey),
    }
  );

  const json = (await res.json()) as {
    status: boolean;
    data?: AngelOnePCRItem[] | null;
    message?: string;
  };
  if (!json.status) {
    throw new Error(json.message || "Failed to fetch PCR");
  }
  if (!json.data || !Array.isArray(json.data) || json.data.length === 0) {
    throw new Error(json.message || "No data available");
  }
  return json.data;
}

export async function angelOneGetOIBuildup(
  jwtToken: string,
  apiKey: string,
  dataType: "Long Built Up" | "Short Built Up" | "Short Covering" | "Long Unwinding",
  expiryType: "NEAR" | "NEXT" | "FAR" = "NEAR"
): Promise<AngelOneOIBuildupItem[]> {
  const res = await fetch(
    `${BASE_URL}/rest/secure/angelbroking/marketData/v1/OIBuildup`,
    {
      method: "POST",
      headers: getAngelHeaders(jwtToken, apiKey),
      body: JSON.stringify({
        expirytype: expiryType,
        datatype: dataType,
      }),
    }
  );

  const json = (await res.json()) as {
    status: boolean;
    data?: AngelOneOIBuildupItem[];
    message?: string;
  };
  if (!json.status || !json.data) {
    throw new Error(json.message || "Failed to fetch OI buildup");
  }
  return json.data;
}

export interface AngelOneLTPData {
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export async function angelOneGetLTP(
  jwtToken: string,
  apiKey: string,
  exchange: string,
  symbolToken: string,
  tradingSymbol: string
): Promise<number> {
  const data = await angelOneGetLTPFull(jwtToken, apiKey, exchange, symbolToken, tradingSymbol);
  return data.ltp;
}

export async function angelOneGetLTPFull(
  jwtToken: string,
  apiKey: string,
  exchange: string,
  symbolToken: string,
  tradingSymbol: string
): Promise<AngelOneLTPData> {
  const res = await fetch(
    `${BASE_URL}/rest/secure/angelbroking/order/v1/getLtpData`,
    {
      method: "POST",
      headers: getAngelHeaders(jwtToken, apiKey),
      body: JSON.stringify({
        exchange,
        tradingsymbol: tradingSymbol,
        symboltoken: symbolToken,
      }),
    }
  );

  const json = (await res.json()) as {
    status: boolean;
    data?: Record<string, string | number | undefined>;
    message?: string;
  };
  if (!json.status || !json.data) {
    throw new Error(json.message || "Failed to fetch LTP");
  }
  const num = (v: string | number | undefined) =>
    typeof v === "string" ? parseFloat(v) || 0 : (v ?? 0);
  return {
    ltp: num(json.data.ltp),
    open: num(json.data.open),
    high: num(json.data.high),
    low: num(json.data.low),
    close: num(json.data.close),
  };
}

/** NIFTY 50 index - from Angel One Scrip Master */
export const NIFTY_INDEX_TOKEN = "99926000";
export const NIFTY_INDEX_SYMBOL = "NIFTY";

// --- Live Market Data API (FULL / OHLC / LTP) ---
// Docs: https://smartapi.angelbroking.com/docs/MarketData (Live Market Data section)

export interface MarketQuoteFull {
  exchange: string;
  tradingSymbol: string;
  symbolToken: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number; // previous day close
  lastTradeQty: number;
  exchFeedTime: string;
  exchTradeTime: string;
  netChange: number;
  percentChange: number;
  avgPrice: number;
  tradeVolume: number;
  opnInterest: number;
  lowerCircuit: number;
  upperCircuit: number;
  totBuyQuan: number;
  totSellQuan: number;
  "52WeekLow": number;
  "52WeekHigh": number;
  depth?: {
    buy: { price: number; quantity: number; orders: number }[];
    sell: { price: number; quantity: number; orders: number }[];
  };
}

/**
 * Fetch real-time market data using the Live Market Data API.
 * FULL mode gives LTP, today's OHLC, prev close, volume, OI, depth.
 */
export async function angelOneGetMarketQuote(
  jwtToken: string,
  apiKey: string,
  exchange: string,
  symbolToken: string,
  mode: "FULL" | "OHLC" | "LTP" = "FULL"
): Promise<MarketQuoteFull | null> {
  const res = await fetch(
    `${BASE_URL}/rest/secure/angelbroking/market/v1/quote/`,
    {
      method: "POST",
      headers: getAngelHeaders(jwtToken, apiKey),
      body: JSON.stringify({
        mode,
        exchangeTokens: {
          [exchange]: [symbolToken],
        },
      }),
    }
  );

  const json = (await res.json()) as {
    status: boolean;
    data?: {
      fetched?: MarketQuoteFull[];
      unfetched?: { exchange: string; symbolToken: string; message: string }[];
    };
    message?: string;
  };

  if (!json.status || !json.data?.fetched?.length) {
    const unfetchedMsg = json.data?.unfetched?.[0]?.message;
    throw new Error(unfetchedMsg || json.message || "Failed to fetch market quote");
  }

  return json.data.fetched[0] ?? null;
}

// --- Candle Data (Historical) ---
export interface AngelOneCandleRow {
  0: string; // timestamp
  1: number; // open
  2: number; // high
  3: number; // low
  4: number; // close
  5: number; // volume
}

/**
 * Get historical candle data for PDH/PDL/PDC and ATR.
 * Docs: https://smartapi.angelbroking.com/docs/MarketData
 */
export async function angelOneGetCandleData(
  jwtToken: string,
  apiKey: string,
  exchange: string,
  symbolToken: string,
  interval: "ONE_MINUTE" | "FIVE_MINUTE" | "FIFTEEN_MINUTE" | "ONE_DAY" = "ONE_DAY",
  fromDate: string,
  toDate: string
): Promise<AngelOneCandleRow[]> {
  const res = await fetch(
    `${BASE_URL}/rest/secure/angelbroking/historical/v1/getCandleData`,
    {
      method: "POST",
      headers: getAngelHeaders(jwtToken, apiKey),
      body: JSON.stringify({
        exchange,
        symboltoken: symbolToken,
        interval,
        fromdate: fromDate,
        todate: toDate,
      }),
    }
  );

  const json = (await res.json()) as {
    status: boolean;
    data?: AngelOneCandleRow[];
    message?: string;
  };
  if (!json.status) {
    throw new Error(json.message || "Failed to fetch candle data");
  }
  return json.data ?? [];
}

// --- Option Greeks ---
export interface AngelOneOptionGreekRow {
  name: string;
  expiry: string;
  strikePrice: string | number;
  optionType: "CE" | "PE";
  delta: string | number;
  gamma?: string | number;
  theta?: string | number;
  vega?: string | number;
  impliedVolatility?: string | number;
  tradeVolume?: string | number;
}

/**
 * Get Option Greeks (Delta, IV, etc.) for an underlying.
 * Docs: https://smartapi.angelbroking.com/docs/OptionGreeks
 * Expiry format: DDMMMYYYY (e.g. "06MAR2025")
 */
export async function angelOneGetOptionGreeks(
  jwtToken: string,
  apiKey: string,
  name: string,
  expirydate: string
): Promise<AngelOneOptionGreekRow[]> {
  const res = await fetch(
    `${BASE_URL}/rest/secure/angelbroking/marketData/v1/optionGreek`,
    {
      method: "POST",
      headers: getAngelHeaders(jwtToken, apiKey),
      body: JSON.stringify({ name, expirydate }),
    }
  );

  const json = (await res.json()) as {
    status: boolean;
    data?: AngelOneOptionGreekRow[];
    message?: string;
  };
  if (!json.status) {
    throw new Error(json.message || "Failed to fetch option greeks");
  }
  return json.data ?? [];
}
