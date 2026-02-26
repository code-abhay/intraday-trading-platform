import { NextRequest, NextResponse } from "next/server";
import {
  computePCR,
  computeMaxPain,
  computeOIBuildup,
  generateSignal,
  generateSignalFromPCR,
  computeMultiFactorBias,
  pickBestITMStrike,
  computeAdvancedFilters,
  computeCprContext,
  computeSRLevels,
  computeTechnicalIndicators,
  type StrategySignal,
  type GreekStrikeData,
  type OrbContext,
  type CandleData,
  type AdvancedFilters,
  type TechnicalIndicators,
} from "@/lib/strategy";
import type { OptionChainRow } from "@/app/api/option-chain/route";
import {
  angelOneGetPCR,
  angelOneGetMarketQuote,
  angelOneGetCandleData,
  angelOneGetOptionGreeks,
  angelOneGetOIBuildup,
  angelOneSearchScrip,
  type AngelOneOptionGreekRow,
  type AngelOneCandleRow,
} from "@/lib/angel-one";
import { getExpiryCandidates, buildOptionSymbol } from "@/lib/expiry-utils";
import { getSegment, SEGMENTS, type SegmentId } from "@/lib/segments";
import { isMarketOpen } from "@/lib/utils";
import { fetchYahooIndexPrice } from "@/lib/yahoo-indices";

const JWT_COOKIE = "angel_jwt";

// --- NSE ---
const NSE_BASE = "https://www.nseindia.com";
const NSE_OPTION_CHAIN_BASE =
  "https://www.nseindia.com/api/option-chain-indices?symbol=";

const NSE_HEADERS = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Referer: "https://www.nseindia.com/",
};

interface NseRecords {
  data: OptionChainRow[];
  underlyingValue: number;
  expiryDates: string[];
}

const UPSTREAM_TIMEOUT_MS = 12_000;
const SIGNALS_CACHE_TTL_MS = 12_000;
const signalCache = new Map<string, { data: unknown; timestamp: number }>();
const inFlightSignals = new Map<string, Promise<unknown>>();

function getAuthScope(jwtToken?: string): string {
  if (!jwtToken) return "public";
  let hash = 0;
  for (let i = 0; i < jwtToken.length; i++) {
    hash = (hash << 5) - hash + jwtToken.charCodeAt(i);
    hash |= 0;
  }
  return `auth_${Math.abs(hash).toString(36)}`;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function getIstDateKeyAndMinutes(timestamp: string): {
  dateKey: string;
  minutes: number;
} | null {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return null;
  const istMs = parsed.getTime() + 330 * 60 * 1000;
  const ist = new Date(istMs);
  const yyyy = ist.getUTCFullYear();
  const mm = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(ist.getUTCDate()).padStart(2, "0");
  const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return { dateKey: `${yyyy}-${mm}-${dd}`, minutes };
}

function computeOrbContextFromIntraday(
  intradayCandles: AngelOneCandleRow[],
  underlyingValue: number,
  breakoutBufferPct: number
): OrbContext | null {
  if (intradayCandles.length < 3) return null;

  let latestDateKey = "";
  const keyed = intradayCandles
    .map((row) => {
      const meta = getIstDateKeyAndMinutes(row[0]);
      if (!meta) return null;
      if (!latestDateKey || meta.dateKey > latestDateKey) latestDateKey = meta.dateKey;
      return { row, ...meta };
    })
    .filter(
      (x): x is { row: AngelOneCandleRow; dateKey: string; minutes: number } =>
        x !== null
    );

  if (!latestDateKey || keyed.length === 0) return null;

  // First 15 minutes: 09:15 to 09:29 (3 bars in 5-min timeframe)
  const orbRows = keyed
    .filter((x) => x.dateKey === latestDateKey && x.minutes >= 555 && x.minutes < 570)
    .map((x) => x.row);

  if (orbRows.length < 2) return null;

  const high = Math.max(...orbRows.map((r) => r[2]));
  const low = Math.min(...orbRows.map((r) => r[3]));
  const buffer = Math.max(1, underlyingValue * Math.max(0, breakoutBufferPct));

  let breakout: OrbContext["breakout"] = "INSIDE_ORB";
  if (underlyingValue > high + buffer) breakout = "ABOVE_ORB";
  else if (underlyingValue < low - buffer) breakout = "BELOW_ORB";

  return {
    high: parseFloat(high.toFixed(2)),
    low: parseFloat(low.toFixed(2)),
    breakout,
    isBreakout: breakout !== "INSIDE_ORB",
  };
}

async function getNseCookies(): Promise<string> {
  const res = await fetch(NSE_BASE, {
    headers: NSE_HEADERS,
    redirect: "manual",
  });
  const cookies = res.headers.get("set-cookie");
  if (!cookies) throw new Error("Failed to get NSE session cookies");
  return cookies;
}

async function fetchNseOptionChain(
  cookies: string,
  symbol: string
): Promise<NseRecords> {
  const res = await fetch(
    `${NSE_OPTION_CHAIN_BASE}${encodeURIComponent(symbol)}`,
    {
      headers: {
        ...NSE_HEADERS,
        Cookie: cookies,
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
      },
    }
  );
  if (!res.ok) throw new Error(`NSE API error: ${res.status}`);
  const text = await res.text();
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("Invalid NSE response (blocked or HTML)");
  }
  let json: { records?: NseRecords };
  try {
    json = JSON.parse(text) as { records?: NseRecords };
  } catch {
    throw new Error("Invalid NSE response (not JSON)");
  }
  const records = json?.records;
  if (!records?.data || !Array.isArray(records.data) || records.data.length === 0) {
    throw new Error("Invalid NSE response (no option chain data)");
  }
  return records;
}

async function getSignalsFromNSE(nseSymbol: string) {
  const cookies = await withTimeout(
    getNseCookies(),
    UPSTREAM_TIMEOUT_MS,
    "NSE cookies"
  );
  const records = await withTimeout(
    fetchNseOptionChain(cookies, nseSymbol),
    UPSTREAM_TIMEOUT_MS,
    "NSE option chain"
  );
  const { data, underlyingValue } = records;

  const segment = SEGMENTS.find((s) => s.nseSymbol === nseSymbol);
  const strikeStep = segment?.strikeStep ?? 50;

  const pcr = computePCR(data);
  const maxPainResults = computeMaxPain(data, underlyingValue);
  const maxPainStrike = maxPainResults[0]?.strike ?? underlyingValue;

  const signal: StrategySignal = generateSignal(
    pcr,
    maxPainStrike,
    underlyingValue,
    {
      strikeStep,
      strategyProfile: segment?.strategy,
    }
  );

  const oiBuildup = computeOIBuildup(data, underlyingValue);
  const oiTable = oiBuildup.map((r) => ({
    strike: r.strikePrice,
    ceOI: r.callOI,
    peOI: r.putOI,
  }));

  return {
    source: "nse" as const,
    symbol: nseSymbol,
    underlyingValue,
    signal,
    maxPain: maxPainResults.slice(0, 5),
    oiTable,
    oiBuildupLong: undefined,
    oiBuildupShort: undefined,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build OI table from Option Greeks data (strike-wise CE/PE with volume as proxy)
 */
function buildOITableFromGreeks(
  greeks: AngelOneOptionGreekRow[],
  underlyingValue: number,
  strikeStep: number
): { strike: number; ceOI: number; peOI: number; ceIV: number; peIV: number; ceDelta: number; peDelta: number }[] {
  const strikeMap = new Map<number, { ceVol: number; peVol: number; ceIV: number; peIV: number; ceDelta: number; peDelta: number }>();

  for (const g of greeks) {
    const strike = parseFloat(String(g.strikePrice));
    if (isNaN(strike)) continue;
    const roundedStrike = Math.round(strike / strikeStep) * strikeStep;

    if (!strikeMap.has(roundedStrike)) {
      strikeMap.set(roundedStrike, { ceVol: 0, peVol: 0, ceIV: 0, peIV: 0, ceDelta: 0, peDelta: 0 });
    }
    const entry = strikeMap.get(roundedStrike)!;
    const vol = parseFloat(String(g.tradeVolume ?? 0)) || 0;
    const iv = parseFloat(String(g.impliedVolatility ?? 0)) || 0;
    const delta = parseFloat(String(g.delta ?? 0)) || 0;

    if (g.optionType === "CE") {
      entry.ceVol = vol;
      entry.ceIV = iv;
      entry.ceDelta = delta;
    } else {
      entry.peVol = vol;
      entry.peIV = iv;
      entry.peDelta = delta;
    }
  }

  // Filter to ±10 strikes around ATM
  const atmStrike = Math.round(underlyingValue / strikeStep) * strikeStep;
  const range = strikeStep * 10;

  return Array.from(strikeMap.entries())
    .filter(([s]) => s >= atmStrike - range && s <= atmStrike + range)
    .sort(([a], [b]) => a - b)
    .map(([strike, d]) => ({
      strike,
      ceOI: Math.round(d.ceVol),
      peOI: Math.round(d.peVol),
      ceIV: parseFloat(d.ceIV.toFixed(2)),
      peIV: parseFloat(d.peIV.toFixed(2)),
      ceDelta: parseFloat(d.ceDelta.toFixed(4)),
      peDelta: parseFloat(d.peDelta.toFixed(4)),
    }));
}

/**
 * Compute Max Pain approximation from Option Greeks trade volume
 */
function computeMaxPainFromGreeks(
  greeks: AngelOneOptionGreekRow[],
  underlyingValue: number,
  strikeStep: number
): { strike: number; totalPayout: number }[] {
  const strikeMap = new Map<number, { ceVol: number; peVol: number }>();

  for (const g of greeks) {
    const strike = Math.round(parseFloat(String(g.strikePrice)) / strikeStep) * strikeStep;
    if (isNaN(strike)) continue;
    if (!strikeMap.has(strike)) strikeMap.set(strike, { ceVol: 0, peVol: 0 });
    const entry = strikeMap.get(strike)!;
    const vol = parseFloat(String(g.tradeVolume ?? 0)) || 0;
    if (g.optionType === "CE") entry.ceVol = vol;
    else entry.peVol = vol;
  }

  const strikes = Array.from(strikeMap.keys()).sort((a, b) => a - b);

  const payouts = strikes.map((testStrike) => {
    let totalPayout = 0;
    for (const [strike, d] of strikeMap) {
      totalPayout +=
        Math.max(0, testStrike - strike) * d.ceVol +
        Math.max(0, strike - testStrike) * d.peVol;
    }
    return { strike: testStrike, totalPayout };
  });

  return payouts.sort((a, b) => a.totalPayout - b.totalPayout).slice(0, 5);
}

async function getSignalsFromAngelOne(
  jwtToken: string,
  apiKey: string,
  symbol: string
) {
  const segment = getSegment(symbol as SegmentId);
  const step = segment.strikeStep;

  const fmtDate = (d: Date) =>
    `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d
      .getDate()
      .toString()
      .padStart(2, "0")}`;

  const now = new Date();
  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - 25);
  const fromStr = `${fmtDate(fromDate)} 09:15`;
  const toStr = `${fmtDate(now)} 15:30`;

  const [pcrResult, quoteResult, candleResult, oiBuildupResult] =
    await Promise.allSettled([
      withTimeout(angelOneGetPCR(jwtToken, apiKey), UPSTREAM_TIMEOUT_MS, "Angel PCR"),
      withTimeout(
        angelOneGetMarketQuote(
          jwtToken,
          apiKey,
          segment.exchange,
          segment.angelToken,
          "FULL"
        ),
        UPSTREAM_TIMEOUT_MS,
        "Angel market quote"
      ),
      withTimeout(
        angelOneGetCandleData(
          jwtToken,
          apiKey,
          segment.exchange,
          segment.angelToken,
          "ONE_DAY",
          fromStr,
          toStr
        ),
        UPSTREAM_TIMEOUT_MS,
        "Angel daily candles"
      ),
      withTimeout(
        Promise.all([
          angelOneGetOIBuildup(jwtToken, apiKey, "Long Built Up", "NEAR"),
          angelOneGetOIBuildup(jwtToken, apiKey, "Short Built Up", "NEAR"),
        ]),
        UPSTREAM_TIMEOUT_MS,
        "Angel OI buildup"
      ),
    ]);

  if (pcrResult.status !== "fulfilled") {
    throw pcrResult.reason instanceof Error
      ? pcrResult.reason
      : new Error("Failed to fetch PCR");
  }

  const pcrList = pcrResult.value;
  const pcrItem = pcrList.find((p) =>
    segment.angelPCRFilter(p.tradingSymbol ?? "")
  );
  if (!pcrItem) {
    const symbols = pcrList.slice(0, 8).map((p) => p.tradingSymbol).join(", ");
    throw new Error(
      `${segment.label} not found in PCR. Available: ${symbols || "none"}`
    );
  }

  // 2. Live Market Data (FULL mode)
  let underlyingValue = segment.fallbackLTP;
  let todayOpen = 0;
  let todayHigh = 0;
  let todayLow = 0;
  let prevClose = 0;
  let tradeVolume = 0;
  let totBuyQuan = 0;
  let totSellQuan = 0;

  if (quoteResult.status === "fulfilled") {
    const quote = quoteResult.value;
    if (quote) {
      underlyingValue = quote.ltp;
      todayOpen = quote.open;
      todayHigh = quote.high;
      todayLow = quote.low;
      prevClose = quote.close;
      tradeVolume = quote.tradeVolume;
      totBuyQuan = quote.totBuyQuan;
      totSellQuan = quote.totSellQuan;
    }
  } else {
    console.warn("[signals] Market Quote (FULL) failed:", quoteResult.reason);
  }
  if (!underlyingValue) underlyingValue = segment.fallbackLTP;

  // 3. Historical candle data for PDH/PDL/PDC and ATR + ATR SMA for vol regime
  let pdh: number | undefined;
  let pdl: number | undefined;
  let pdc: number | undefined;
  let atr: number | undefined;
  let atrSma: number | undefined;

  if (candleResult.status === "fulfilled") {
    const candles = candleResult.value;
    if (candles.length >= 2) {
      const prior = candles[candles.length - 2];
      pdh = prior[2];
      pdl = prior[3];
      pdc = prior[4];

      // ATR from last 5 days
      const recentRanges = candles.slice(-5).map((c) => c[2] - c[3]);
      atr = recentRanges.reduce((s, r) => s + r, 0) / recentRanges.length;

      // ATR SMA from last 20 days for volatility regime
      const allRanges = candles.slice(-20).map((c) => c[2] - c[3]);
      atrSma = allRanges.reduce((s, r) => s + r, 0) / allRanges.length;
    }
  } else {
    console.warn("[signals] Candle data failed:", candleResult.reason);
  }

  if (!pdh && prevClose > 0) {
    pdh = todayHigh || underlyingValue;
    pdl = todayLow || underlyingValue;
    pdc = prevClose;
    atr = Math.abs(todayHigh - todayLow) || underlyingValue * 0.008;
    atrSma = atr;
  }

  // 4. Option Greeks — full chain for OI table, delta, IV, and Max Pain
  let greekDelta: number | undefined;
  let greeksData: AngelOneOptionGreekRow[] = [];
  let oiTable: { strike: number; ceOI: number; peOI: number; ceIV?: number; peIV?: number; ceDelta?: number; peDelta?: number }[] = [];
  let greeksMaxPain: { strike: number; totalPayout: number }[] = [];
  let matchedExpiry = "";

  if (segment.exchange === "NSE" || segment.exchange === "BSE") {
    // Use segment-specific expiry day (NIFTY=Tue, BANKNIFTY=Wed, SENSEX=Fri, MIDCPNIFTY=Mon)
    const expiries = getExpiryCandidates(segment.expiryDay);
    console.log(`[signals] Expiry candidates for ${symbol} (day=${segment.expiryDay}):`, expiries);

    for (const expiry of expiries) {
      try {
        greeksData = await withTimeout(
          angelOneGetOptionGreeks(
            jwtToken,
            apiKey,
            segment.angelSymbol,
            expiry
          ),
          UPSTREAM_TIMEOUT_MS,
          `Angel option greeks (${expiry})`
        );
        if (greeksData.length > 0) {
          // Use the actual expiry from the response data if available
          const firstRow = greeksData[0];
          if (firstRow?.expiry) {
            matchedExpiry = firstRow.expiry;
          } else {
            matchedExpiry = expiry;
          }
          console.log(`[signals] Option Greeks success for expiry ${expiry} (actual: ${matchedExpiry}): ${greeksData.length} rows`);
          break;
        }
      } catch (e) {
        console.warn(`[signals] Option Greeks failed for expiry ${expiry}:`, e);
      }
    }

    if (greeksData.length > 0) {
      // ATM CE delta
      const atmStrike = Math.round(underlyingValue / step) * step;
      const ceRow = greeksData.find(
        (g) =>
          g.optionType === "CE" &&
          Math.abs(parseFloat(String(g.strikePrice)) - atmStrike) < step
      );
      if (ceRow) {
        greekDelta = parseFloat(String(ceRow.delta));
      }

      // Build OI table from Greeks
      oiTable = buildOITableFromGreeks(greeksData, underlyingValue, step);

      // Compute Max Pain from Greeks
      greeksMaxPain = computeMaxPainFromGreeks(greeksData, underlyingValue, step);
    }
  }

  // 5. OI Buildup
  let oiBuildupLong: { symbol: string; oiChange: number; priceChange: number }[] = [];
  let oiBuildupShort: { symbol: string; oiChange: number; priceChange: number }[] = [];
  const filterRelevant = (
    list: Awaited<ReturnType<typeof angelOneGetOIBuildup>>
  ) =>
    list
      .filter((r) => {
        const sym = (r.tradingSymbol ?? "").toUpperCase();
        return (
          (symbol === "NIFTY" &&
            sym.startsWith("NIFTY") &&
            !sym.includes("BANK") &&
            !sym.includes("MIDCP")) ||
          (symbol === "BANKNIFTY" && sym.includes("BANKNIFTY")) ||
          (symbol === "MIDCPNIFTY" && sym.includes("MIDCP")) ||
          (symbol === "SENSEX" && sym.includes("SENSEX"))
        );
      })
      .slice(0, 5)
      .map((r) => ({
        symbol: r.tradingSymbol ?? "",
        oiChange:
          typeof r.netChangeOpnInterest === "string"
            ? parseFloat(r.netChangeOpnInterest) || 0
            : (r.netChangeOpnInterest ?? 0),
        priceChange:
          typeof r.percentChange === "string"
            ? parseFloat(r.percentChange) || 0
            : typeof r.percentChange === "number"
              ? r.percentChange
              : 0,
      }));
  if (oiBuildupResult.status === "fulfilled") {
    const [longUp, shortUp] = oiBuildupResult.value;
    oiBuildupLong = filterRelevant(longUp);
    oiBuildupShort = filterRelevant(shortUp);
  } else {
    console.warn("[signals] OI Buildup failed:", oiBuildupResult.reason);
  }

  // Price action data for multi-factor bias
  const priceAction = (prevClose > 0 && todayOpen > 0)
    ? { ltp: underlyingValue, open: todayOpen, prevClose, high: todayHigh, low: todayLow }
    : undefined;

  const oiData = (oiBuildupLong.length + oiBuildupShort.length > 0)
    ? { longCount: oiBuildupLong.length, shortCount: oiBuildupShort.length }
    : undefined;

  const maxPainStrike = greeksMaxPain.length > 0
    ? greeksMaxPain[0].strike
    : Math.round(underlyingValue / step) * step;
  const cprContext =
    pdh && pdl && pdc
      ? computeCprContext(
          computeSRLevels(pdh, pdl, pdc),
          underlyingValue,
          segment.strategy
        )
      : null;

  // 5b. Fetch intraday candles (5-min) for real technical indicators + advanced filters
  let advancedFilters: AdvancedFilters | null = null;
  let technicalIndicators: TechnicalIndicators | null = null;
  let orbContext: OrbContext | null = null;
  try {
    const now = new Date();
    const fmtDT = (d: Date) =>
      `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;

    // Fetch 3 days of 5-min candles for enough EMA/MACD history
    const from3d = new Date(now);
    from3d.setDate(from3d.getDate() - 3);
    const todayFrom = `${fmtDT(from3d)} 09:15`;
    const todayTo = `${fmtDT(now)} 15:30`;

    const intradayCandles = await withTimeout(
      angelOneGetCandleData(
        jwtToken,
        apiKey,
        segment.exchange,
        segment.angelToken,
        "FIVE_MINUTE",
        todayFrom,
        todayTo
      ),
      UPSTREAM_TIMEOUT_MS,
      "Angel intraday candles"
    );

    if (intradayCandles.length >= 10) {
      const candleData: CandleData[] = intradayCandles.map((c) => ({
        open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5],
      }));
      orbContext = computeOrbContextFromIntraday(
        intradayCandles,
        underlyingValue,
        segment.strategy.orbBreakoutBufferPct
      );
      if (orbContext) {
        console.log(
          `[signals] ORB context: ${orbContext.breakout} (H:${orbContext.high} L:${orbContext.low})`
        );
      }

      // Real EMA, RSI, MACD, VWAP computed from candles
      technicalIndicators = computeTechnicalIndicators(
        candleData,
        segment.strategy.rsiBullishThreshold,
        segment.strategy.rsiBearishThreshold
      );
      if (technicalIndicators) {
        console.log(`[signals] Technical Indicators (${candleData.length} candles):`,
          `EMA:${technicalIndicators.emaTrend}(${technicalIndicators.emaFast.toFixed(1)}/${technicalIndicators.emaSlow.toFixed(1)})`,
          `RSI:${technicalIndicators.rsiValue}(${technicalIndicators.rsiSignal})`,
          `MACD:${technicalIndicators.macdHist.toFixed(2)}(${technicalIndicators.macdBias})`,
          `VWAP:${technicalIndicators.vwapBias}`);
      }

      advancedFilters = computeAdvancedFilters(
        candleData,
        segment.strategy.choppinessThreshold
      );
      console.log(`[signals] Advanced filters:`,
        `RF:${advancedFilters.rfConfirmsBull ? "Bull" : advancedFilters.rfConfirmsBear ? "Bear" : "Flat"}`,
        `RQK:${advancedFilters.rqkConfirmsBull ? "Bull" : advancedFilters.rqkConfirmsBear ? "Bear" : "Flat"}`,
        `CHOP:${advancedFilters.choppiness}${advancedFilters.isChoppy ? "(choppy)" : "(trending)"}`);
    } else {
      console.warn(`[signals] Only ${intradayCandles.length} intraday candles — skipping indicators`);
    }
  } catch (e) {
    console.warn("[signals] Intraday candle fetch failed:", e);
  }

  // ATM CE IV from greeks for options advisor
  let greekIV: number | undefined;
  let bestGreekStrike: GreekStrikeData | null = null;

  if (greeksData.length > 0) {
    const atmStrike2 = Math.round(underlyingValue / step) * step;
    const ceIVRow = greeksData.find(
      (g) => g.optionType === "CE" && Math.abs(parseFloat(String(g.strikePrice)) - atmStrike2) < step
    );
    if (ceIVRow?.impliedVolatility) {
      greekIV = parseFloat(String(ceIVRow.impliedVolatility));
    }

    // Build strike data from Greeks for ITM strike selection
    const greekStrikes: GreekStrikeData[] = greeksData.map((g) => ({
      strike: parseFloat(String(g.strikePrice)),
      optionType: g.optionType,
      delta: parseFloat(String(g.delta)) || 0,
      iv: parseFloat(String(g.impliedVolatility ?? 0)) || 0,
      tradeVolume: parseFloat(String(g.tradeVolume ?? 0)) || 0,
    })).filter((g) => !isNaN(g.strike));

    const preBias = computeMultiFactorBias(
      pcrItem.pcr,
      priceAction,
      technicalIndicators,
      advancedFilters,
      segment.strategy,
      orbContext,
      cprContext
    );
    const isCallSide = preBias.bias === "BULLISH" || preBias.bias === "NEUTRAL";

    bestGreekStrike = pickBestITMStrike(greekStrikes, underlyingValue, isCallSide, step);
    if (bestGreekStrike) {
      console.log(`[signals] Best ITM strike from Greeks: ${bestGreekStrike.strike} ${bestGreekStrike.optionType} delta=${bestGreekStrike.delta.toFixed(3)} iv=${bestGreekStrike.iv.toFixed(1)}`);
    }
  }

  const signal = generateSignalFromPCR(
    pcrItem.pcr,
    underlyingValue,
    maxPainStrike,
    {
      strikeStep: step,
      pdh,
      pdl,
      pdc,
      atr,
      atrSma,
      greekDelta,
      greekIV,
      priceAction,
      oiData,
      expiryDay: segment.expiryDay,
      bestGreekStrike,
      advancedFilters,
      technicalIndicators,
      strategyProfile: segment.strategy,
      orbContext,
      cprContext,
      symbol,
    }
  );

  // 6. Fetch REAL option premium via SearchScrip + Market Quote
  let realOptionPremium: number | undefined;
  let optionSymbolName = "";

  if (signal.optionsAdvisor && matchedExpiry && signal.bias !== "NEUTRAL") {
    const advisor = signal.optionsAdvisor;
    const optType = advisor.side === "CALL" ? "CE" : "PE";
    const optExchange = segment.exchange === "BSE" ? "BFO" : "NFO";
    const tradingSymbol = buildOptionSymbol(segment.angelSymbol, matchedExpiry, advisor.strike, optType);

    console.log(`[signals] Searching for option: ${optExchange}:${tradingSymbol}`);

    try {
      const scripResults = await withTimeout(
        angelOneSearchScrip(jwtToken, apiKey, optExchange, tradingSymbol),
        UPSTREAM_TIMEOUT_MS,
        "Angel option search"
      );

      if (scripResults.length > 0) {
        const scrip = scripResults[0];
        optionSymbolName = scrip.tradingsymbol;
        console.log(`[signals] Found option scrip: ${scrip.tradingsymbol} token=${scrip.symboltoken}`);

        // Get real LTP for this option
        const optQuote = await withTimeout(
          angelOneGetMarketQuote(
            jwtToken,
            apiKey,
            optExchange,
            scrip.symboltoken,
            "LTP"
          ),
          UPSTREAM_TIMEOUT_MS,
          "Angel option quote"
        );
        if (optQuote && optQuote.ltp > 0) {
          realOptionPremium = optQuote.ltp;
          console.log(`[signals] Real option LTP: ₹${realOptionPremium}`);

          // Override the estimated premium with real premium
          signal.optionsAdvisor!.premium = realOptionPremium;
          signal.optionsAdvisor!.recommendation =
            `BUY ${advisor.strike} ${advisor.side} @ ₹${realOptionPremium}`;

          if (signal.optionsAdvisor!.optionTargets) {
            signal.optionsAdvisor!.optionTargets = {
              premiumEntry: realOptionPremium,
              premiumSL: Math.round(realOptionPremium * 0.80),
              premiumT1: Math.round(realOptionPremium * 1.25),
              premiumT2: Math.round(realOptionPremium * 1.50),
              premiumT3: Math.round(realOptionPremium * 1.80),
              premiumTrailSL: Math.round(realOptionPremium * 1.10),
            };
          }
        }
      } else {
        console.warn(`[signals] No scrip found for ${tradingSymbol}, trying partial search...`);
        // Try partial search with just symbol + expiry
        const partialSymbol = `${segment.angelSymbol}${matchedExpiry.slice(0, 2)}${matchedExpiry.slice(2, 5)}${matchedExpiry.slice(7, 9)}`;
        const partialResults = await withTimeout(
          angelOneSearchScrip(
            jwtToken,
            apiKey,
            optExchange,
            `${partialSymbol}${advisor.strike}${optType}`
          ),
          UPSTREAM_TIMEOUT_MS,
          "Angel option partial search"
        );
        if (partialResults.length > 0) {
          const scrip = partialResults[0];
          optionSymbolName = scrip.tradingsymbol;

          const optQuote = await withTimeout(
            angelOneGetMarketQuote(
              jwtToken,
              apiKey,
              optExchange,
              scrip.symboltoken,
              "LTP"
            ),
            UPSTREAM_TIMEOUT_MS,
            "Angel option quote (partial)"
          );
          if (optQuote && optQuote.ltp > 0) {
            realOptionPremium = optQuote.ltp;
            signal.optionsAdvisor!.premium = realOptionPremium;
            signal.optionsAdvisor!.recommendation = `BUY ${advisor.strike} ${advisor.side} @ ₹${realOptionPremium}`;
            if (signal.optionsAdvisor!.optionTargets) {
              signal.optionsAdvisor!.optionTargets = {
                premiumEntry: realOptionPremium,
                premiumSL: Math.round(realOptionPremium * 0.80),
                premiumT1: Math.round(realOptionPremium * 1.25),
                premiumT2: Math.round(realOptionPremium * 1.50),
                premiumT3: Math.round(realOptionPremium * 1.80),
                premiumTrailSL: Math.round(realOptionPremium * 1.10),
              };
            }
          }
        }
      }
    } catch (e) {
      console.warn("[signals] Option LTP fetch failed:", e);
    }
  }

  console.log("[signals] Angel One result:", {
    symbol,
    pcr: pcrItem.pcr,
    pcrSymbol: pcrItem.tradingSymbol,
    bias: signal.bias,
    biasStrength: signal.biasStrength,
    confidence: signal.confidence,
    underlyingValue,
    maxPainStrike,
    matchedExpiry,
    optionSymbol: optionSymbolName || "none",
    realPremium: realOptionPremium ?? "estimated",
    greeksCount: greeksData.length,
    oiTableCount: oiTable.length,
  });

  return {
    source: "angel_one" as const,
    symbol,
    underlyingValue,
    signal,
    rawPCR: pcrItem.pcr,
    pcrSymbol: pcrItem.tradingSymbol,
    expiry: matchedExpiry || getExpiryCandidates(segment.expiryDay)[0] || "",
    optionSymbol: optionSymbolName || "",
    maxPain: greeksMaxPain.length > 0 ? greeksMaxPain : [{ strike: maxPainStrike, totalPayout: 0 }],
    oiTable: oiTable.length > 0 ? oiTable : undefined,
    oiBuildupLong,
    oiBuildupShort,
    marketData: {
      todayOpen,
      todayHigh,
      todayLow,
      prevClose,
      tradeVolume,
      buyQty: totBuyQuan,
      sellQty: totSellQuan,
    },
    technicalIndicators: technicalIndicators ?? undefined,
    timestamp: new Date().toISOString(),
  };
}

async function resolveSignalsData(
  segment: (typeof SEGMENTS)[number],
  symbol: SegmentId,
  apiKey?: string,
  jwtToken?: string
) {
  if (!isMarketOpen()) {
    return {
      source: "demo" as const,
      symbol,
      underlyingValue: segment.fallbackLTP,
      signal: {
        bias: "NEUTRAL",
        confidence: 0,
        pcr: { value: 0, bias: "N/A", callOI: 0, putOI: 0 },
        maxPain: 0,
        summary:
          "Market is closed. Trading hours: 9:15 AM – 3:30 PM IST (Mon–Fri).",
      },
      maxPain: [],
      oiTable: undefined,
      oiBuildupLong: undefined,
      oiBuildupShort: undefined,
      marketClosed: true,
      timestamp: new Date().toISOString(),
    };
  }

  if (apiKey && jwtToken) {
    try {
      return await getSignalsFromAngelOne(jwtToken, apiKey, symbol);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[signals] Angel One error:", message);
    }
  }

  if (segment.nseSymbol) {
    try {
      const data = await getSignalsFromNSE(segment.nseSymbol);
      return { ...data, symbol };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[signals] NSE error:", message);
    }
  }

  let yahooPrice: number | null = null;
  try {
    yahooPrice = await withTimeout(
      fetchYahooIndexPrice(symbol),
      UPSTREAM_TIMEOUT_MS,
      "Yahoo index price"
    );
  } catch {
    yahooPrice = null;
  }
  const uv = yahooPrice ?? segment.fallbackLTP;
  const step = segment.strikeStep;
  const demoSignal = generateSignalFromPCR(1.25, uv, uv, {
    strikeStep: step,
    strategyProfile: segment.strategy,
  });
  demoSignal.summary =
    "Demo: Sample BULLISH signal (PCR 1.25). Live data: login at /login during market hours.";
  return {
    source: "demo" as const,
    symbol,
    underlyingValue: uv,
    signal: demoSignal,
    maxPain: [
      { strike: Math.round((uv - step * 2) / step) * step, totalPayout: 0 },
      { strike: Math.round((uv - step) / step) * step, totalPayout: 0 },
      { strike: Math.round(uv / step) * step, totalPayout: 0 },
      { strike: Math.round((uv + step) / step) * step, totalPayout: 0 },
      { strike: Math.round((uv + step * 2) / step) * step, totalPayout: 0 },
    ],
    oiTable: undefined as { strike: number; ceOI: number; peOI: number }[] | undefined,
    oiBuildupLong: undefined,
    oiBuildupShort: undefined,
    timestamp: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const symbolParam = request.nextUrl.searchParams.get("symbol") || "NIFTY";
  const segment = SEGMENTS.find((s) => s.id === symbolParam) ?? SEGMENTS[0];
  const symbol = segment.id;
  const apiKey = process.env.ANGEL_API_KEY;
  const jwtToken = request.cookies.get(JWT_COOKIE)?.value;

  const cacheAuthScope = apiKey && jwtToken ? getAuthScope(jwtToken) : "public";
  const cacheKey = `${symbol}:${cacheAuthScope}`;
  const cached = signalCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SIGNALS_CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  const inflight = inFlightSignals.get(cacheKey);
  if (inflight) {
    try {
      const sharedData = await inflight;
      return NextResponse.json(sharedData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json(
        { error: "Failed to fetch signals", details: message },
        { status: 500 }
      );
    }
  }

  const requestPromise = resolveSignalsData(segment, symbol, apiKey, jwtToken);
  inFlightSignals.set(cacheKey, requestPromise);

  try {
    const data = await requestPromise;
    signalCache.set(cacheKey, { data, timestamp: Date.now() });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch signals", details: message },
      { status: 500 }
    );
  } finally {
    inFlightSignals.delete(cacheKey);
  }
}
