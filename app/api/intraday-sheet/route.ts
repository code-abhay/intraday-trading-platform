import { NextRequest, NextResponse } from "next/server";
import {
  angelOneGetInstrumentMaster,
  angelOneGetMarketQuotes,
  type AngelOneInstrumentMasterRow,
} from "@/lib/angel-one";
import {
  computeIntradaySheetGlobals,
  computeIntradaySheetRow,
  computeIntradaySheetTotals,
  type IntradayQuote,
  type IntradaySheetGlobals,
  type IntradaySheetRow,
} from "@/lib/intraday-sheet-calcs";
import {
  INTRADAY_API_CACHE_TTL_MS,
  INTRADAY_SHEET_SYMBOLS,
  type IntradayExchange,
} from "@/lib/intraday-sheet-config";

const JWT_COOKIE = "angel_jwt";
const ANGEL_JWT_HEADER = "x-angel-jwt";
const UPSTREAM_TIMEOUT_MS = 12_000;
const INSTRUMENT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const BULK_QUOTE_MAX_SYMBOLS = 50;
const QUOTE_REQUEST_INTERVAL_MS = 1100;

interface IntradaySheetResponse {
  source: "angel_one";
  generatedAt: string;
  authEnabled: boolean;
  globals: IntradaySheetGlobals;
  totals: ReturnType<typeof computeIntradaySheetTotals> & {
    resolvedCount: number;
  };
  rows: IntradaySheetRow[];
  warnings: string[];
}

interface InstrumentResolution {
  symbol: string;
  exchange: IntradayExchange;
  token: string;
  tradingSymbol: string;
}

interface InstrumentCache {
  fetchedAt: number;
  rows: AngelOneInstrumentMasterRow[];
  lookup: Map<string, AngelOneInstrumentMasterRow[]>;
}

interface QuoteBatchRequest {
  exchangeTokens: Record<string, string[]>;
  tokenToSymbol: Map<string, string>;
}

const responseCache = new Map<string, { timestamp: number; data: IntradaySheetResponse }>();
const inFlightResponses = new Map<string, Promise<IntradaySheetResponse>>();
let instrumentCache: InstrumentCache | null = null;

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

function normalizeKey(value: string): string {
  return value.trim().toUpperCase();
}

function compactKey(value: string): string {
  return normalizeKey(value).replace(/[^A-Z0-9]/g, "");
}

function pushLookup(
  lookup: Map<string, AngelOneInstrumentMasterRow[]>,
  key: string,
  row: AngelOneInstrumentMasterRow
) {
  if (!key) return;
  const normalized = normalizeKey(key);
  const current = lookup.get(normalized);
  if (current) {
    current.push(row);
    return;
  }
  lookup.set(normalized, [row]);
}

function buildInstrumentLookup(rows: AngelOneInstrumentMasterRow[]) {
  const lookup = new Map<string, AngelOneInstrumentMasterRow[]>();

  for (const row of rows) {
    const exchange = normalizeKey(row.exch_seg);
    if (exchange !== "NSE" && exchange !== "BSE") continue;

    const symbol = normalizeKey(row.symbol);
    const symbolNoEq = symbol.replace(/-EQ$/, "");
    const name = normalizeKey(row.name);
    const compactSymbol = compactKey(symbolNoEq);
    const compactName = compactKey(name);

    pushLookup(lookup, symbol, row);
    pushLookup(lookup, symbolNoEq, row);
    pushLookup(lookup, name, row);
    pushLookup(lookup, compactSymbol, row);
    pushLookup(lookup, compactName, row);
  }

  return lookup;
}

async function getInstrumentCache(): Promise<InstrumentCache> {
  const now = Date.now();
  if (instrumentCache && now - instrumentCache.fetchedAt <= INSTRUMENT_CACHE_TTL_MS) {
    return instrumentCache;
  }

  const rows = await withTimeout(
    angelOneGetInstrumentMaster(),
    UPSTREAM_TIMEOUT_MS,
    "Angel instrument master"
  );

  instrumentCache = {
    fetchedAt: now,
    rows,
    lookup: buildInstrumentLookup(rows),
  };
  return instrumentCache;
}

function getCandidates(symbol: string, aliases: string[]): string[] {
  const keys = new Set<string>();
  const add = (value: string) => {
    if (!value) return;
    const upper = normalizeKey(value);
    keys.add(upper);
    keys.add(compactKey(upper));
    keys.add(upper.replace(/-EQ$/, ""));
  };

  add(symbol);
  add(`${symbol}-EQ`);
  for (const alias of aliases) add(alias);
  return Array.from(keys);
}

function scoreInstrument(
  row: AngelOneInstrumentMasterRow,
  symbol: string,
  preferredExchange: IntradayExchange
): number {
  let score = 0;
  const exchange = normalizeKey(row.exch_seg);
  const normalizedSymbol = normalizeKey(symbol);
  const rowSymbol = normalizeKey(row.symbol);
  const rowName = normalizeKey(row.name);
  const rowNoEq = rowSymbol.replace(/-EQ$/, "");
  const instrumentType = normalizeKey(row.instrumenttype);

  if (exchange === preferredExchange) score += 100;
  if (rowSymbol === `${normalizedSymbol}-EQ`) score += 50;
  if (rowName === normalizedSymbol) score += 45;
  if (rowNoEq === normalizedSymbol) score += 40;
  if (instrumentType.includes("EQ") || rowSymbol.endsWith("-EQ")) score += 20;
  if (exchange === "NSE") score += 5;

  return score;
}

function resolveInstrument(
  symbol: string,
  preferredExchange: IntradayExchange,
  aliases: string[],
  lookup: Map<string, AngelOneInstrumentMasterRow[]>
): InstrumentResolution | null {
  const candidates = getCandidates(symbol, aliases);
  const options = new Set<AngelOneInstrumentMasterRow>();

  for (const key of candidates) {
    const rows = lookup.get(normalizeKey(key));
    if (!rows?.length) continue;
    for (const row of rows) options.add(row);
  }

  if (!options.size) return null;

  let best: AngelOneInstrumentMasterRow | null = null;
  let bestScore = -1;
  for (const row of options) {
    const score = scoreInstrument(row, symbol, preferredExchange);
    if (score <= bestScore) continue;
    best = row;
    bestScore = score;
  }

  if (!best) return null;

  const exchange = normalizeKey(best.exch_seg) === "BSE" ? "BSE" : "NSE";
  return {
    symbol,
    exchange,
    token: best.token,
    tradingSymbol: best.symbol,
  };
}

function quoteTokenKey(exchange: string, token: string): string {
  return `${normalizeKey(exchange)}:${token.trim()}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildQuoteBatches(
  resolved: Array<{ entry: { symbol: string }; match: InstrumentResolution | null }>
): QuoteBatchRequest[] {
  if (!resolved.length) return [];
  const batches: QuoteBatchRequest[] = [];
  const matches = resolved.flatMap(({ entry, match }) =>
    match ? [{ entry, match }] : []
  );

  for (let i = 0; i < matches.length; i += BULK_QUOTE_MAX_SYMBOLS) {
    const slice = matches.slice(i, i + BULK_QUOTE_MAX_SYMBOLS);
    const exchangeTokens: Record<string, string[]> = {};
    const tokenToSymbol = new Map<string, string>();

    for (const { entry, match } of slice) {
      const list = exchangeTokens[match.exchange] ?? [];
      list.push(match.token);
      exchangeTokens[match.exchange] = list;
      tokenToSymbol.set(quoteTokenKey(match.exchange, match.token), entry.symbol);
    }

    batches.push({
      exchangeTokens,
      tokenToSymbol,
    });
  }

  return batches;
}

async function fetchQuotesInBatches(
  jwtToken: string,
  apiKey: string,
  batches: QuoteBatchRequest[],
  warnings: string[]
): Promise<{ quotesBySymbol: Map<string, IntradayQuote>; unavailableBySymbol: Map<string, string> }> {
  const quotesBySymbol = new Map<string, IntradayQuote>();
  const unavailableBySymbol = new Map<string, string>();

  for (let index = 0; index < batches.length; index++) {
    if (index > 0) {
      await sleep(QUOTE_REQUEST_INTERVAL_MS);
    }

    const batch = batches[index];
    try {
      const result = await withTimeout(
        angelOneGetMarketQuotes(jwtToken, apiKey, batch.exchangeTokens, "FULL"),
        UPSTREAM_TIMEOUT_MS,
        `Market quote batch ${index + 1}`
      );

      for (const fetched of result.fetched) {
        const symbol = batch.tokenToSymbol.get(
          quoteTokenKey(fetched.exchange, fetched.symbolToken)
        );
        if (!symbol) continue;
        quotesBySymbol.set(symbol, toQuote(fetched));
      }

      for (const unfetched of result.unfetched) {
        const symbol = batch.tokenToSymbol.get(
          quoteTokenKey(unfetched.exchange, unfetched.symbolToken)
        );
        if (!symbol || quotesBySymbol.has(symbol)) continue;
        unavailableBySymbol.set(symbol, unfetched.message || "Quote unavailable");
      }

      if (result.unfetched.length) {
        warnings.push(
          `Batch ${index + 1} returned ${result.unfetched.length} unfetched symbols.`
        );
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Quote batch failed";
      warnings.push(`Quote batch ${index + 1} failed: ${reason}`);
      for (const symbol of batch.tokenToSymbol.values()) {
        if (!quotesBySymbol.has(symbol)) {
          unavailableBySymbol.set(symbol, reason);
        }
      }
    }
  }

  return {
    quotesBySymbol,
    unavailableBySymbol,
  };
}

function toQuote(raw: {
  ltp?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  percentChange?: number;
}): IntradayQuote {
  const asFinite = (value: number | undefined) =>
    value != null && Number.isFinite(value) ? value : null;

  return {
    price: asFinite(raw.ltp),
    open: asFinite(raw.open),
    high: asFinite(raw.high),
    low: asFinite(raw.low),
    prevClose: asFinite(raw.close),
    changePct: asFinite(raw.percentChange),
  };
}

function unavailablePayload(reason: string): IntradaySheetResponse {
  const globals = computeIntradaySheetGlobals();
  const rows = INTRADAY_SHEET_SYMBOLS.map((entry) =>
    computeIntradaySheetRow(
      {
        symbol: entry.symbol,
        quote: null,
        unavailableReason: reason,
      },
      globals
    )
  );
  const totals = computeIntradaySheetTotals(rows);

  return {
    source: "angel_one",
    generatedAt: new Date().toISOString(),
    authEnabled: false,
    globals,
    totals: {
      ...totals,
      resolvedCount: 0,
    },
    rows,
    warnings: [reason],
  };
}

async function buildResponse(jwtToken: string, apiKey: string): Promise<IntradaySheetResponse> {
  const warnings: string[] = [];
  const globals = computeIntradaySheetGlobals();

  const { lookup } = await getInstrumentCache();

  const resolved = INTRADAY_SHEET_SYMBOLS.map((entry) => {
    const match = resolveInstrument(
      entry.symbol,
      entry.preferredExchange,
      entry.aliases,
      lookup
    );

    if (!match) {
      warnings.push(`Instrument token not found for ${entry.symbol}`);
    }
    return { entry, match };
  });

  const batches = buildQuoteBatches(resolved);
  const { quotesBySymbol, unavailableBySymbol } = await fetchQuotesInBatches(
    jwtToken,
    apiKey,
    batches,
    warnings
  );

  const rows = resolved.map(({ entry, match }) => {
    if (!match) {
      return computeIntradaySheetRow(
        {
          symbol: entry.symbol,
          quote: null,
          unavailableReason: "Instrument token not found",
        },
        globals
      );
    }

    const quote = quotesBySymbol.get(entry.symbol);
    if (quote) {
      return computeIntradaySheetRow(
        {
          symbol: entry.symbol,
          quote,
        },
        globals
      );
    }

    return computeIntradaySheetRow(
      {
        symbol: entry.symbol,
        quote: null,
        unavailableReason: unavailableBySymbol.get(entry.symbol) ?? "Quote unavailable",
      },
      globals
    );
  });

  const totals = computeIntradaySheetTotals(rows);
  const resolvedCount = resolved.filter((item) => item.match != null).length;

  return {
    source: "angel_one",
    generatedAt: new Date().toISOString(),
    authEnabled: true,
    globals,
    totals: {
      ...totals,
      resolvedCount,
    },
    rows,
    warnings,
  };
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.ANGEL_API_KEY?.trim();
  const jwtToken =
    request.headers.get(ANGEL_JWT_HEADER)?.trim() ||
    request.cookies.get(JWT_COOKIE)?.value?.trim() ||
    process.env.ANGEL_JWT_TOKEN?.trim() ||
    undefined;

  if (!apiKey || !jwtToken) {
    return NextResponse.json(
      unavailablePayload("Angel One auth missing. Login at /login to load live quotes.")
    );
  }

  const forceRefresh = request.nextUrl.searchParams.get("force") === "1";
  const authScope = getAuthScope(jwtToken);
  const cacheKey = `intraday_sheet:${authScope}`;
  const now = Date.now();

  if (!forceRefresh) {
    const cached = responseCache.get(cacheKey);
    if (cached && now - cached.timestamp <= INTRADAY_API_CACHE_TTL_MS) {
      return NextResponse.json(cached.data);
    }
  }

  const existing = inFlightResponses.get(cacheKey);
  if (existing) {
    const data = await existing;
    return NextResponse.json(data);
  }

  const promise = buildResponse(jwtToken, apiKey)
    .then((data) => {
      responseCache.set(cacheKey, { timestamp: Date.now(), data });
      return data;
    })
    .finally(() => {
      inFlightResponses.delete(cacheKey);
    });

  inFlightResponses.set(cacheKey, promise);

  try {
    const data = await promise;
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to build intraday sheet response";
    return NextResponse.json(
      unavailablePayload(`Intraday sheet request failed: ${message}`),
      { status: 500 }
    );
  }
}
