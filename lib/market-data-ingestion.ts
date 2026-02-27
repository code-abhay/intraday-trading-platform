import {
  angelOneGetBseIntradayScrips,
  angelOneGetCandleData,
  angelOneGetCautionaryScrips,
  angelOneGetGainersLosers,
  angelOneGetInstrumentMaster,
  angelOneGetMarketQuote,
  angelOneGetNseIntradayScrips,
  angelOneGetOIBuildup,
  angelOneGetOptionGreeks,
  angelOneGetPCR,
  type AngelOneOIBuildupItem,
  type AngelOneOptionGreekRow,
} from "@/lib/angel-one";
import { getExpiryCandidates } from "@/lib/expiry-utils";
import { SEGMENTS, type SegmentId } from "@/lib/segments";
import {
  isMarketDataStoreEnabled,
  replaceOIBuildupRows,
  replaceOptionGreeksRows,
  replaceUniverseRowsForDate,
  upsertCandles,
  upsertIngestionRun,
  upsertMarketSnapshot,
  type OIBuildupInputRow,
  type UniverseInputRow,
} from "@/lib/market-data-store";

export type IngestionMode = "intraday" | "daily";

export interface SegmentIngestionResult {
  segment: SegmentId;
  status: "SUCCESS" | "PARTIAL" | "SKIPPED" | "FAILED";
  snapshotAt: string | null;
  snapshotSaved: boolean;
  candleRows: number;
  greekRows: number;
  oiRows: number;
  warnings: string[];
  errors: string[];
}

export interface MarketDataIngestionResult {
  runId: string;
  mode: IngestionMode;
  startedAt: string;
  completedAt: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  storeEnabled: boolean;
  authEnabled: boolean;
  universeRowsSaved: number;
  segmentResults: SegmentIngestionResult[];
  warnings: string[];
  errors: string[];
}

interface RunMarketDataIngestionOptions {
  mode: IngestionMode;
  apiKey?: string;
  jwtToken?: string;
  segmentId?: SegmentId;
}

function toNum(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function formatDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getIstDateKey(date: Date = new Date()): string {
  const istMs = date.getTime() + 330 * 60 * 1000;
  const ist = new Date(istMs);
  const yyyy = ist.getUTCFullYear();
  const mm = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(ist.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function matchesSegmentSymbol(segment: SegmentId, tradingSymbol: string): boolean {
  const symbol = tradingSymbol.toUpperCase();
  switch (segment) {
    case "NIFTY":
      return (
        (symbol.startsWith("NIFTY") || symbol.includes("NIFTY")) &&
        !symbol.includes("BANK") &&
        !symbol.includes("MIDCP")
      );
    case "BANKNIFTY":
      return symbol.includes("BANKNIFTY") || symbol.includes("NIFTYBANK");
    case "MIDCPNIFTY":
      return symbol.includes("MIDCP");
    case "SENSEX":
      return symbol.includes("SENSEX");
    default:
      return false;
  }
}

function mapBuildupRows(
  segment: SegmentId,
  rows: AngelOneOIBuildupItem[]
): OIBuildupInputRow[] {
  return rows
    .filter((row) => matchesSegmentSymbol(segment, row.tradingSymbol ?? ""))
    .slice(0, 12)
    .map((row) => ({
      symbol: row.tradingSymbol ?? "",
      oiChange: toNum(row.netChangeOpnInterest),
      priceChange: toNum(row.percentChange),
    }));
}

async function fetchGreeksWithFallback(
  jwtToken: string,
  apiKey: string,
  symbol: string,
  expiryDay: number
): Promise<{ rows: AngelOneOptionGreekRow[]; matchedExpiry: string | null }> {
  const expiries = getExpiryCandidates(expiryDay as 0 | 1 | 2 | 3 | 4 | 5 | 6);
  for (const expiry of expiries.slice(0, 4)) {
    try {
      const rows = await angelOneGetOptionGreeks(jwtToken, apiKey, symbol, expiry);
      if (rows.length > 0) {
        const matchedExpiry = rows[0]?.expiry || expiry;
        return { rows, matchedExpiry };
      }
    } catch {
      // Try the next expiry candidate.
    }
  }
  return { rows: [], matchedExpiry: null };
}

function getRunId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `run_${Date.now()}`;
}

export async function runMarketDataIngestion(
  options: RunMarketDataIngestionOptions
): Promise<MarketDataIngestionResult> {
  const startedAt = new Date().toISOString();
  const runId = getRunId();
  const storeEnabled = isMarketDataStoreEnabled();
  const authEnabled = Boolean(options.apiKey && options.jwtToken);
  const warnings: string[] = [];
  const errors: string[] = [];
  const segmentResults: SegmentIngestionResult[] = [];
  let universeRowsSaved = 0;

  if (!storeEnabled) {
    warnings.push(
      "Supabase is not configured. Data fetch runs, but snapshots are not persisted."
    );
  }
  if (!authEnabled) {
    warnings.push(
      "Angel One auth not available (api key or jwt missing). Secure ingestion steps were skipped."
    );
  }

  const targetSegments = options.segmentId
    ? SEGMENTS.filter((segment) => segment.id === options.segmentId)
    : SEGMENTS;

  let pcrList: Awaited<ReturnType<typeof angelOneGetPCR>> = [];
  let oiLongRaw: Awaited<ReturnType<typeof angelOneGetOIBuildup>> = [];
  let oiShortRaw: Awaited<ReturnType<typeof angelOneGetOIBuildup>> = [];

  if (authEnabled) {
    const [pcrRes, longRes, shortRes] = await Promise.allSettled([
      angelOneGetPCR(options.jwtToken!, options.apiKey!),
      angelOneGetOIBuildup(options.jwtToken!, options.apiKey!, "Long Built Up", "NEAR"),
      angelOneGetOIBuildup(options.jwtToken!, options.apiKey!, "Short Built Up", "NEAR"),
    ]);

    if (pcrRes.status === "fulfilled") {
      pcrList = pcrRes.value;
    } else {
      warnings.push(`PCR fetch failed: ${String(pcrRes.reason)}`);
    }
    if (longRes.status === "fulfilled") {
      oiLongRaw = longRes.value;
    } else {
      warnings.push(`Long buildup fetch failed: ${String(longRes.reason)}`);
    }
    if (shortRes.status === "fulfilled") {
      oiShortRaw = shortRes.value;
    } else {
      warnings.push(`Short buildup fetch failed: ${String(shortRes.reason)}`);
    }
  }

  if (options.mode === "daily") {
    try {
      const universeRows: UniverseInputRow[] = [];
      const map = new Map<string, UniverseInputRow>();
      const keyFor = (exchange: string, symbol: string, token?: string) =>
        `${exchange}:${symbol.toUpperCase()}:${token ?? ""}`;
      const upsertRow = (row: UniverseInputRow) => {
        map.set(keyFor(row.exchange, row.symbol, row.token), row);
      };

      const instrumentMaster = await angelOneGetInstrumentMaster();
      for (const segment of targetSegments) {
        const symbolUpper = segment.angelSymbol.toUpperCase();
        const masterRow = instrumentMaster.find(
          (row) =>
            row.symbol.toUpperCase() === symbolUpper &&
            row.exch_seg.toUpperCase().startsWith(segment.exchange)
        );
        if (masterRow) {
          upsertRow({
            exchange: segment.exchange,
            symbol: segment.angelSymbol,
            token: masterRow.token,
            isIntradayAllowed: false,
            intradayMultiplier: null,
            isCautionary: false,
            cautionMessage: null,
          });
        }
      }

      if (authEnabled) {
        const [nseRes, bseRes, cautionRes] = await Promise.allSettled([
          angelOneGetNseIntradayScrips(options.jwtToken!, options.apiKey!),
          angelOneGetBseIntradayScrips(options.jwtToken!, options.apiKey!),
          angelOneGetCautionaryScrips(options.jwtToken!, options.apiKey!),
        ]);

        if (nseRes.status === "fulfilled") {
          for (const row of nseRes.value) {
            upsertRow({
              exchange: "NSE",
              symbol: row.SymbolName,
              isIntradayAllowed: true,
              intradayMultiplier: toNum(row.Multiplier),
              isCautionary: false,
              cautionMessage: null,
            });
          }
        } else {
          warnings.push(`NSE intraday list failed: ${String(nseRes.reason)}`);
        }

        if (bseRes.status === "fulfilled") {
          for (const row of bseRes.value) {
            upsertRow({
              exchange: "BSE",
              symbol: row.SymbolName,
              isIntradayAllowed: true,
              intradayMultiplier: toNum(row.Multiplier),
              isCautionary: false,
              cautionMessage: null,
            });
          }
        } else {
          warnings.push(`BSE intraday list failed: ${String(bseRes.reason)}`);
        }

        if (cautionRes.status === "fulfilled") {
          for (const caution of cautionRes.value) {
            const matched = Array.from(map.values()).find(
              (item) => item.symbol.toUpperCase() === caution.symbol.toUpperCase()
            );
            if (matched) {
              matched.isCautionary = true;
              matched.cautionMessage = caution.message;
              if (!matched.token) matched.token = caution.token;
            } else {
              upsertRow({
                exchange: "UNKNOWN",
                symbol: caution.symbol,
                token: caution.token,
                isIntradayAllowed: false,
                intradayMultiplier: null,
                isCautionary: true,
                cautionMessage: caution.message,
              });
            }
          }
        } else {
          warnings.push(
            `Cautionary scrip list failed: ${String(cautionRes.reason)}`
          );
        }
      }

      universeRows.push(...map.values());
      if (storeEnabled) {
        await replaceUniverseRowsForDate(getIstDateKey(), universeRows);
      }
      universeRowsSaved = universeRows.length;
    } catch (err) {
      warnings.push(`Daily universe ingestion failed: ${String(err)}`);
    }
  }

  const now = new Date();
  const today = formatDate(now);
  const intradayFrom = `${today} 09:15`;
  const intradayTo = `${today} 15:30`;
  const dailyFromDate = new Date(now);
  dailyFromDate.setDate(dailyFromDate.getDate() - 180);
  const dailyFrom = `${formatDate(dailyFromDate)} 09:15`;
  const dailyTo = `${today} 15:30`;

  for (const segment of targetSegments) {
    const segResult: SegmentIngestionResult = {
      segment: segment.id,
      status: "SKIPPED",
      snapshotAt: null,
      snapshotSaved: false,
      candleRows: 0,
      greekRows: 0,
      oiRows: 0,
      warnings: [],
      errors: [],
    };

    if (!authEnabled) {
      segResult.warnings.push("Skipped secure ingestion because auth is missing.");
      segmentResults.push(segResult);
      continue;
    }

    try {
      const quote = await angelOneGetMarketQuote(
        options.jwtToken!,
        options.apiKey!,
        segment.exchange,
        segment.angelToken,
        "FULL"
      );
      if (!quote) {
        segResult.status = "FAILED";
        segResult.errors.push("Market quote response was empty.");
        segmentResults.push(segResult);
        continue;
      }

      const snapshotAt = new Date().toISOString();
      segResult.snapshotAt = snapshotAt;

      const pcrMatch = pcrList.find((item) =>
        segment.angelPCRFilter(item.tradingSymbol ?? "")
      );
      const oiLong = mapBuildupRows(segment.id, oiLongRaw);
      const oiShort = mapBuildupRows(segment.id, oiShortRaw);

      const { rows: greekRows, matchedExpiry } = await fetchGreeksWithFallback(
        options.jwtToken!,
        options.apiKey!,
        segment.angelSymbol,
        segment.expiryDay
      );
      if (!greekRows.length) {
        segResult.warnings.push("No option greeks rows available for current/next expiry.");
      }

      let candles: Awaited<ReturnType<typeof angelOneGetCandleData>> = [];
      if (options.mode === "intraday") {
        candles = await angelOneGetCandleData(
          options.jwtToken!,
          options.apiKey!,
          segment.exchange,
          segment.angelToken,
          "ONE_MINUTE",
          intradayFrom,
          intradayTo
        );
      } else {
        candles = await angelOneGetCandleData(
          options.jwtToken!,
          options.apiKey!,
          segment.exchange,
          segment.angelToken,
          "ONE_DAY",
          dailyFrom,
          dailyTo
        );
      }

      if (storeEnabled) {
        await upsertMarketSnapshot({
          segment: segment.id,
          source: "angel_one",
          snapshotAt,
          underlyingValue: quote.ltp,
          marketData: {
            open: quote.open,
            high: quote.high,
            low: quote.low,
            close: quote.close,
            tradeVolume: quote.tradeVolume,
            buyQty: quote.totBuyQuan,
            sellQty: quote.totSellQuan,
          },
          pcr: pcrMatch?.pcr ?? null,
          pcrSymbol: pcrMatch?.tradingSymbol ?? null,
          maxPain: null,
          signalBias: null,
          signalConfidence: null,
          signalSummary: matchedExpiry
            ? `Greeks matched expiry ${matchedExpiry}`
            : "Greeks not available",
          rawPayload: {
            mode: options.mode,
            quote,
            pcrMatch: pcrMatch ?? null,
          },
        });
        await replaceOIBuildupRows(snapshotAt, segment.id, oiLong, oiShort);
        await replaceOptionGreeksRows(snapshotAt, segment.id, greekRows);
        await upsertCandles(
          segment.id,
          options.mode === "intraday" ? "ONE_MINUTE" : "ONE_DAY",
          "angel_one",
          candles
        );
      }

      segResult.snapshotSaved = storeEnabled;
      segResult.candleRows = candles.length;
      segResult.greekRows = greekRows.length;
      segResult.oiRows = oiLong.length + oiShort.length;
      segResult.status = segResult.warnings.length > 0 ? "PARTIAL" : "SUCCESS";
    } catch (err) {
      segResult.status = "FAILED";
      segResult.errors.push(String(err));
    }

    segmentResults.push(segResult);
  }

  if (authEnabled) {
    // Optional: extra market breadth fetch. Kept outside per-segment loop.
    try {
      await angelOneGetGainersLosers(
        options.jwtToken!,
        options.apiKey!,
        "PercOIGainers",
        "NEAR"
      );
    } catch (err) {
      warnings.push(`Top movers fetch failed: ${String(err)}`);
    }
  }

  const completedAt = new Date().toISOString();
  const hasFailed = segmentResults.some((row) => row.status === "FAILED");
  const hasPartial = segmentResults.some((row) => row.status === "PARTIAL");
  const status: MarketDataIngestionResult["status"] = hasFailed
    ? "FAILED"
    : hasPartial || warnings.length > 0
      ? "PARTIAL"
      : "SUCCESS";

  const result: MarketDataIngestionResult = {
    runId,
    mode: options.mode,
    startedAt,
    completedAt,
    status,
    storeEnabled,
    authEnabled,
    universeRowsSaved,
    segmentResults,
    warnings,
    errors,
  };

  try {
    if (storeEnabled) {
      await upsertIngestionRun({
        runId,
        mode: options.mode,
        status,
        startedAt,
        completedAt,
        details: result,
      });
    }
  } catch (err) {
    result.warnings.push(`Failed to store ingestion run summary: ${String(err)}`);
  }

  return result;
}
