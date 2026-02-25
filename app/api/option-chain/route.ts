import { NextRequest, NextResponse } from "next/server";

const NSE_BASE = "https://www.nseindia.com";
const NSE_OPTION_CHAIN_BASE =
  "https://www.nseindia.com/api/option-chain-indices?symbol=";

const DEFAULT_HEADERS = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  Referer: "https://www.nseindia.com/",
};

export interface OptionChainRow {
  strikePrice: number;
  expiryDate: string;
  CE?: {
    strikePrice: number;
    expiryDate: string;
    underlying: string;
    identifier: string;
    openInterest: number;
    changeinOpenInterest: number;
    totalTradedVolume: number;
    lastPrice: number;
    impliedVolatility: number;
  };
  PE?: {
    strikePrice: number;
    expiryDate: string;
    underlying: string;
    identifier: string;
    openInterest: number;
    changeinOpenInterest: number;
    totalTradedVolume: number;
    lastPrice: number;
    impliedVolatility: number;
  };
}

export interface OptionChainResponse {
  records: {
    data: OptionChainRow[];
    expiryDates: string[];
    underlyingValue: number;
  };
  filtered?: { data: OptionChainRow[] };
}

export interface StructuredOptionChain {
  symbol: string;
  underlyingValue: number;
  expiryDates: string[];
  data: OptionChainRow[];
  timestamp: string;
}

async function getNseCookies(): Promise<string> {
  const res = await fetch(NSE_BASE, {
    headers: DEFAULT_HEADERS,
    redirect: "manual",
  });

  const cookies = res.headers.get("set-cookie");
  if (!cookies) {
    throw new Error("Failed to get NSE session cookies");
  }
  return cookies;
}

async function fetchOptionChainWithCookies(
  cookies: string,
  symbol: string
): Promise<unknown> {
  const url = `${NSE_OPTION_CHAIN_BASE}${encodeURIComponent(symbol)}`;
  const res = await fetch(url, {
    headers: {
      ...DEFAULT_HEADERS,
      Cookie: cookies,
      Referer: "https://www.nseindia.com/option-chain",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
    },
  });

  if (!res.ok) {
    throw new Error(`NSE API error: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol") || "NIFTY";

  try {
    const cookies = await getNseCookies();
    const raw = await fetchOptionChainWithCookies(cookies, symbol);

    const data = raw as OptionChainResponse;
    const records = data?.records;

    if (!records?.data) {
      return NextResponse.json(
        { error: "Invalid response from NSE", raw: data },
        { status: 502 }
      );
    }

    const structured: StructuredOptionChain = {
      symbol,
      underlyingValue: records.underlyingValue ?? 0,
      expiryDates: records.expiryDates ?? [],
      data: records.data,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(structured);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[option-chain] Error:", message);
    return NextResponse.json(
      { error: "Failed to fetch option chain", details: message },
      { status: 500 }
    );
  }
}
