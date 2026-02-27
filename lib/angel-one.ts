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

export type MarketQuoteMode = "FULL" | "OHLC" | "LTP";

export interface MarketQuoteUnfetched {
  exchange: string;
  symbolToken: string;
  message: string;
}

export interface MarketQuoteBatchResult {
  fetched: MarketQuoteFull[];
  unfetched: MarketQuoteUnfetched[];
  message?: string;
}

/**
 * Bulk quote fetch. The API supports up to 50 tokens per request.
 */
export async function angelOneGetMarketQuotes(
  jwtToken: string,
  apiKey: string,
  exchangeTokens: Record<string, string[]>,
  mode: MarketQuoteMode = "FULL"
): Promise<MarketQuoteBatchResult> {
  const cleanedExchangeTokens: Record<string, string[]> = {};
  for (const [exchange, tokens] of Object.entries(exchangeTokens)) {
    const validTokens = Array.from(new Set(tokens.filter((token) => token?.trim())));
    if (!validTokens.length) continue;
    cleanedExchangeTokens[exchange] = validTokens;
  }

  if (!Object.keys(cleanedExchangeTokens).length) {
    return { fetched: [], unfetched: [] };
  }

  const res = await fetch(
    `${BASE_URL}/rest/secure/angelbroking/market/v1/quote/`,
    {
      method: "POST",
      headers: getAngelHeaders(jwtToken, apiKey),
      body: JSON.stringify({
        mode,
        exchangeTokens: cleanedExchangeTokens,
      }),
    }
  );

  const json = (await res.json()) as {
    status: boolean;
    data?: {
      fetched?: MarketQuoteFull[];
      unfetched?: MarketQuoteUnfetched[];
    };
    message?: string;
  };

  if (!json.status) {
    throw new Error(json.message || "Failed to fetch market quotes");
  }

  return {
    fetched: json.data?.fetched ?? [],
    unfetched: json.data?.unfetched ?? [],
    message: json.message,
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
  mode: MarketQuoteMode = "FULL"
): Promise<MarketQuoteFull | null> {
  const result = await angelOneGetMarketQuotes(
    jwtToken,
    apiKey,
    { [exchange]: [symbolToken] },
    mode
  );

  if (!result.fetched.length) {
    const unfetchedMsg = result.unfetched[0]?.message;
    throw new Error(unfetchedMsg || result.message || "Failed to fetch market quote");
  }

  return result.fetched[0] ?? null;
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

// --- Search Scrip (find option symbol token) ---
export interface SearchScripResult {
  exchange: string;
  tradingsymbol: string;
  symboltoken: string;
}

export async function angelOneSearchScrip(
  jwtToken: string,
  apiKey: string,
  exchange: string,
  searchscrip: string
): Promise<SearchScripResult[]> {
  const res = await fetch(
    `${BASE_URL}/rest/secure/angelbroking/order/v1/searchScrip`,
    {
      method: "POST",
      headers: getAngelHeaders(jwtToken, apiKey),
      body: JSON.stringify({ exchange, searchscrip }),
    }
  );

  const json = (await res.json()) as {
    status: boolean;
    data?: SearchScripResult[];
    message?: string;
  };
  if (!json.status || !json.data) {
    return [];
  }
  return json.data;
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

export interface AngelOneHistoricalOIRow {
  time: string;
  oi: number;
}

export async function angelOneGetOIData(
  jwtToken: string,
  apiKey: string,
  exchange: "NFO" | "BFO" | "MCX",
  symbolToken: string,
  interval:
    | "ONE_MINUTE"
    | "THREE_MINUTE"
    | "FIVE_MINUTE"
    | "TEN_MINUTE"
    | "FIFTEEN_MINUTE"
    | "THIRTY_MINUTE"
    | "ONE_HOUR"
    | "ONE_DAY",
  fromDate: string,
  toDate: string
): Promise<AngelOneHistoricalOIRow[]> {
  const res = await fetch(
    `${BASE_URL}/rest/secure/angelbroking/historical/v1/getOIData`,
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
    data?: AngelOneHistoricalOIRow[];
    message?: string;
  };
  if (!json.status) {
    throw new Error(json.message || "Failed to fetch OI data");
  }
  return json.data ?? [];
}

export interface AngelOneTopMoverItem {
  tradingSymbol: string;
  percentChange: number;
  symbolToken: number;
  opnInterest: number;
  netChangeOpnInterest: number;
}

export type AngelOneTopMoverDataType =
  | "PercOIGainers"
  | "PercOILosers"
  | "PercPriceGainers"
  | "PercPriceLosers";

export async function angelOneGetGainersLosers(
  jwtToken: string,
  apiKey: string,
  dataType: AngelOneTopMoverDataType,
  expiryType: "NEAR" | "NEXT" | "FAR" = "NEAR"
): Promise<AngelOneTopMoverItem[]> {
  const res = await fetch(
    `${BASE_URL}/rest/secure/angelbroking/marketData/v1/gainersLosers`,
    {
      method: "POST",
      headers: getAngelHeaders(jwtToken, apiKey),
      body: JSON.stringify({
        datatype: dataType,
        expirytype: expiryType,
      }),
    }
  );

  const json = (await res.json()) as {
    status: boolean;
    data?: AngelOneTopMoverItem[];
    message?: string;
  };
  if (!json.status) {
    throw new Error(json.message || "Failed to fetch gainers/losers data");
  }
  return json.data ?? [];
}

export interface AngelOneIntradayScrip {
  Exchange: string;
  SymbolName: string;
  Multiplier: string;
}

export async function angelOneGetNseIntradayScrips(
  jwtToken: string,
  apiKey: string
): Promise<AngelOneIntradayScrip[]> {
  const res = await fetch(
    `${BASE_URL}/rest/secure/angelbroking/marketData/v1/nseIntraday`,
    {
      method: "GET",
      headers: getAngelHeaders(jwtToken, apiKey),
    }
  );

  const json = (await res.json()) as {
    status: boolean;
    data?: AngelOneIntradayScrip[];
    message?: string;
  };
  if (!json.status) {
    throw new Error(json.message || "Failed to fetch NSE intraday universe");
  }
  return json.data ?? [];
}

export async function angelOneGetBseIntradayScrips(
  jwtToken: string,
  apiKey: string
): Promise<AngelOneIntradayScrip[]> {
  const res = await fetch(
    `${BASE_URL}/rest/secure/angelbroking/marketData/v1/bseIntraday`,
    {
      method: "GET",
      headers: getAngelHeaders(jwtToken, apiKey),
    }
  );

  const json = (await res.json()) as {
    status: boolean;
    data?: AngelOneIntradayScrip[];
    message?: string;
  };
  if (!json.status) {
    throw new Error(json.message || "Failed to fetch BSE intraday universe");
  }
  return json.data ?? [];
}

export interface AngelOneCautionaryScrip {
  token: string;
  symbol: string;
  message: string;
}

export async function angelOneGetCautionaryScrips(
  jwtToken: string,
  apiKey: string
): Promise<AngelOneCautionaryScrip[]> {
  const res = await fetch(
    `${BASE_URL}/rest/secure/angelbroking/securities/v1/cautionaryScrips`,
    {
      method: "GET",
      headers: getAngelHeaders(jwtToken, apiKey),
    }
  );

  const json = (await res.json()) as {
    status: boolean;
    data?: AngelOneCautionaryScrip[];
    message?: string;
  };
  if (!json.status) {
    throw new Error(json.message || "Failed to fetch cautionary scrips");
  }
  return json.data ?? [];
}

const INSTRUMENT_MASTER_URL =
  "https://margincalculator.angelone.in/OpenAPI_File/files/OpenAPIScripMaster.json";

export interface AngelOneInstrumentMasterRow {
  token: string;
  symbol: string;
  name: string;
  expiry: string;
  strike: string;
  lotsize: string;
  instrumenttype: string;
  exch_seg: string;
  tick_size: string;
}

export async function angelOneGetInstrumentMaster(): Promise<
  AngelOneInstrumentMasterRow[]
> {
  const res = await fetch(INSTRUMENT_MASTER_URL, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch instrument master: ${res.status} ${res.statusText}`
    );
  }

  const json = (await res.json()) as AngelOneInstrumentMasterRow[];
  if (!Array.isArray(json)) {
    throw new Error("Invalid instrument master response format");
  }
  return json;
}
