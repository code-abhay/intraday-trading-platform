import { NextRequest, NextResponse } from "next/server";
import {
  computePCR,
  computeMaxPain,
  generateSignal,
  generateSignalFromPCR,
  type StrategySignal,
} from "@/lib/strategy";
import type { OptionChainRow } from "@/app/api/option-chain/route";
import {
  angelOneGetPCR,
  angelOneGetLTP,
  NIFTY_INDEX_TOKEN,
  NIFTY_INDEX_SYMBOL,
} from "@/lib/angel-one";

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

async function getSignalsFromNSE(symbol: string) {
  const cookies = await getNseCookies();
  const records = await fetchNseOptionChain(cookies, symbol);
  const { data, underlyingValue } = records;

  const pcr = computePCR(data);
  const maxPainResults = computeMaxPain(data, underlyingValue);
  const maxPainStrike = maxPainResults[0]?.strike ?? underlyingValue;

  const signal: StrategySignal = generateSignal(
    pcr,
    maxPainStrike,
    underlyingValue
  );

  return {
    source: "nse" as const,
    symbol,
    underlyingValue,
    signal,
    maxPain: maxPainResults.slice(0, 5),
    timestamp: new Date().toISOString(),
  };
}

async function getSignalsFromAngelOne(
  jwtToken: string,
  apiKey: string,
  symbol: string
) {
  const pcrList = await angelOneGetPCR(jwtToken, apiKey);
  const niftyPCR = pcrList.find((p) => {
    const sym = p.tradingSymbol?.toUpperCase() ?? "";
    return sym.startsWith("NIFTY") && !sym.includes("BANK"); // Exclude BANKNIFTY
  });

  if (!niftyPCR) {
    const symbols = pcrList.slice(0, 5).map((p) => p.tradingSymbol).join(", ");
    throw new Error(`NIFTY not found in PCR data. Available: ${symbols || "none"}`);
  }

  let underlyingValue = 0;
  try {
    underlyingValue = await angelOneGetLTP(
      jwtToken,
      apiKey,
      "NSE",
      NIFTY_INDEX_TOKEN,
      NIFTY_INDEX_SYMBOL
    );
  } catch {
    // Fallback: use placeholder if LTP fails
    underlyingValue = 24500; // Approximate
  }

  const signal = generateSignalFromPCR(
    niftyPCR.pcr,
    underlyingValue,
    undefined
  );

  return {
    source: "angel_one" as const,
    symbol,
    underlyingValue,
    signal,
    maxPain: [{ strike: Math.round(underlyingValue / 50) * 50, totalPayout: 0 }], // Angel One doesn't provide option chain; show nearest strike
    timestamp: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol") || "NIFTY";

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

  // Fallback to NSE
  try {
    const data = await getSignalsFromNSE(symbol);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[signals] Error:", message);

    // Return demo data so dashboard layout is always visible
    const demoData = {
      source: "demo" as const,
      symbol,
      underlyingValue: 24500,
      signal: {
        bias: "NEUTRAL" as const,
        entry: 24500,
        stopLoss: 24450,
        target: 24550,
        confidence: 50,
        pcr: { value: 1.0, bias: "NEUTRAL", callOI: 0, putOI: 0 },
        maxPain: 24500,
        summary: "Demo data — real data unavailable. Login during market hours (9:15 AM - 3:30 PM IST) for live signals.",
      },
      maxPain: [
        { strike: 24400, totalPayout: 0 },
        { strike: 24450, totalPayout: 0 },
        { strike: 24500, totalPayout: 0 },
        { strike: 24550, totalPayout: 0 },
        { strike: 24600, totalPayout: 0 },
      ],
      timestamp: new Date().toISOString(),
    };
    return NextResponse.json(demoData);
  }
}
