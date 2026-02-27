import { NextRequest, NextResponse } from "next/server";
import {
  angelOneGetPCR,
  angelOneGetMarketQuote,
  angelOneGetCandleData,
  angelOneGetOptionGreeks,
  angelOneGetOIBuildup,
} from "@/lib/angel-one";
import { getExpiryCandidates } from "@/lib/expiry-utils";
import { SEGMENTS } from "@/lib/segments";

const JWT_COOKIE = "angel_jwt";

/**
 * Debug endpoint: calls each Angel One API individually and returns raw results.
 * GET /api/angel-one/debug?symbol=NIFTY
 */
export async function GET(request: NextRequest) {
  const symbolParam = request.nextUrl.searchParams.get("symbol") || "NIFTY";
  const segment = SEGMENTS.find((s) => s.id === symbolParam) ?? SEGMENTS[0];

  const apiKey = process.env.ANGEL_API_KEY;
  const jwtToken = request.cookies.get(JWT_COOKIE)?.value;

  const results: Record<string, unknown> = {
    segment: {
      id: segment.id,
      label: segment.label,
      angelToken: segment.angelToken,
      angelSymbol: segment.angelSymbol,
      exchange: segment.exchange,
      strikeStep: segment.strikeStep,
      expiryDay: segment.expiryDay,
    },
    auth: {
      apiKeySet: !!apiKey,
      jwtTokenSet: !!jwtToken,
    },
  };

  if (!apiKey || !jwtToken) {
    results.error = "Not logged in. apiKey or jwtToken missing.";
    return NextResponse.json(results);
  }

  // 1. PCR
  try {
    const pcrList = await angelOneGetPCR(jwtToken, apiKey);
    const matched = pcrList.find((p) =>
      segment.angelPCRFilter(p.tradingSymbol ?? "")
    );
    results.pcr = {
      success: true,
      totalItems: pcrList.length,
      first5: pcrList.slice(0, 5),
      matchedForSegment: matched ?? null,
    };
  } catch (e) {
    results.pcr = { success: false, error: String(e) };
  }

  // 2. Market Quote (FULL mode) — real-time LTP + OHLC + prev close + volume + depth
  try {
    const quote = await angelOneGetMarketQuote(
      jwtToken,
      apiKey,
      segment.exchange,
      segment.angelToken,
      "FULL"
    );
    results.marketQuote = { success: true, data: quote };
  } catch (e) {
    results.marketQuote = { success: false, error: String(e) };
  }

  // 3. Candle Data (last 10 days)
  try {
    const now = new Date();
    const fromDate = new Date(now);
    fromDate.setDate(fromDate.getDate() - 10);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
    const fromStr = `${fmt(fromDate)} 09:15`;
    const toStr = `${fmt(now)} 15:30`;

    const candles = await angelOneGetCandleData(
      jwtToken,
      apiKey,
      segment.exchange,
      segment.angelToken,
      "ONE_DAY",
      fromStr,
      toStr
    );
    results.candleData = {
      success: true,
      request: { exchange: segment.exchange, symboltoken: segment.angelToken, interval: "ONE_DAY", fromdate: fromStr, todate: toStr },
      count: candles.length,
      candles: candles.slice(-5),
    };
  } catch (e) {
    results.candleData = { success: false, error: String(e) };
  }

  // 4. Option Greeks
  try {
    const expiryCandidates = getExpiryCandidates(segment.expiryDay);
    let matchedExpiry: string | null = null;
    let greeks: Awaited<ReturnType<typeof angelOneGetOptionGreeks>> = [];
    const errors: string[] = [];

    for (const expiry of expiryCandidates) {
      try {
        const rows = await angelOneGetOptionGreeks(
          jwtToken,
          apiKey,
          segment.angelSymbol,
          expiry
        );
        if (rows.length > 0) {
          greeks = rows;
          matchedExpiry = rows[0]?.expiry ?? expiry;
          break;
        }
      } catch (e) {
        errors.push(String(e));
      }
    }

    results.optionGreeks = {
      success: greeks.length > 0,
      request: {
        name: segment.angelSymbol,
        expiryCandidates,
        matchedExpiry,
      },
      count: greeks.length,
      first5: greeks.slice(0, 5),
      errors: errors.slice(0, 3),
    };
  } catch (e) {
    results.optionGreeks = { success: false, error: String(e) };
  }

  // 5. OI Buildup
  try {
    const longUp = await angelOneGetOIBuildup(jwtToken, apiKey, "Long Built Up", "NEAR");
    results.oiBuildup = {
      success: true,
      count: longUp.length,
      first5: longUp.slice(0, 5),
    };
  } catch (e) {
    results.oiBuildup = { success: false, error: String(e) };
  }

  return NextResponse.json(results, { status: 200 });
}
