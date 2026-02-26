import { NextRequest, NextResponse } from "next/server";
import {
  computePCR,
  computeMaxPain,
  computeOIBuildup,
  generateSignal,
  generateSignalFromPCR,
  type StrategySignal,
} from "@/lib/strategy";
import type { OptionChainRow } from "@/app/api/option-chain/route";
import { angelOneGetPCR, angelOneGetLTP } from "@/lib/angel-one";
import { getSegment, SEGMENTS, type SegmentId } from "@/lib/segments";
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
  const cookies = await getNseCookies();
  const records = await fetchNseOptionChain(cookies, nseSymbol);
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
    { strikeStep }
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
    timestamp: new Date().toISOString(),
  };
}

async function getSignalsFromAngelOne(
  jwtToken: string,
  apiKey: string,
  symbol: string
) {
  const segment = getSegment(symbol as SegmentId);
  const pcrList = await angelOneGetPCR(jwtToken, apiKey);
  const pcrItem = pcrList.find((p) =>
    segment.angelPCRFilter(p.tradingSymbol ?? "")
  );

  if (!pcrItem) {
    const symbols = pcrList.slice(0, 8).map((p) => p.tradingSymbol).join(", ");
    throw new Error(`${segment.label} not found in PCR. Available: ${symbols || "none"}`);
  }

  let underlyingValue = 0;
  try {
    underlyingValue = await angelOneGetLTP(
      jwtToken,
      apiKey,
      segment.exchange,
      segment.angelToken,
      segment.angelSymbol
    );
  } catch {
    underlyingValue = segment.fallbackLTP;
  }

  const signal = generateSignalFromPCR(
    pcrItem.pcr,
    underlyingValue,
    undefined,
    { strikeStep: segment.strikeStep }
  );

  return {
    source: "angel_one" as const,
    symbol,
    underlyingValue,
    signal,
    maxPain: [
      {
        strike: Math.round(underlyingValue / segment.strikeStep) * segment.strikeStep,
        totalPayout: 0,
      },
    ],
    oiTable: undefined,
    timestamp: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const symbolParam = request.nextUrl.searchParams.get("symbol") || "NIFTY";
  const segment = SEGMENTS.find((s) => s.id === symbolParam) ?? SEGMENTS[0];
  const symbol = segment.id;

  const apiKey = process.env.ANGEL_API_KEY;
  const jwtToken = request.cookies.get(JWT_COOKIE)?.value;

  // Try Angel One first if configured and logged in
  if (apiKey && jwtToken) {
    try {
      const data = await getSignalsFromAngelOne(jwtToken, apiKey, symbol);
      return NextResponse.json(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[signals] Angel One error:", message);
      // Fall through to NSE
    }
  }

  // Fallback to NSE (only if segment has NSE option chain)
  if (segment.nseSymbol) {
    try {
      const data = await getSignalsFromNSE(segment.nseSymbol);
      return NextResponse.json({ ...data, symbol });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[signals] NSE error:", message);
    }
  }

  // Demo data when both fail (or SENSEX which has no NSE option chain)
  // Try Yahoo Finance for live price; fallback to static value
  const yahooPrice = await fetchYahooIndexPrice(symbol);
  const uv = yahooPrice ?? segment.fallbackLTP;
  const step = segment.strikeStep;
  const demoSignal = generateSignalFromPCR(1.0, uv, uv, {
    strikeStep: step,
  });
  const demoData = {
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
    timestamp: new Date().toISOString(),
  };
  return NextResponse.json(demoData);
}
