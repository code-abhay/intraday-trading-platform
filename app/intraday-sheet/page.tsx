"use client";

import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Activity,
  AlertTriangle,
  Clock,
  RefreshCw,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { INTRADAY_POLL_INTERVAL_MS } from "@/lib/intraday-sheet-config";

interface IntradaySheetGlobals {
  capital: number;
  targetAmount: number;
  feeAmount: number;
  gainAmount: number;
  gainRatio: number;
  monthlyProjection: number;
}

interface IntradaySheetRow {
  symbol: string;
  quoteStatus: "ok" | "unavailable";
  unavailableReason: string | null;
  price: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  prevClose: number | null;
  changePct: number | null;
  watchBreakout: boolean | null;
  breakout: boolean | null;
  breakdown: boolean | null;
  tradeLabel: string | null;
  buySignal: number | null;
  sellSignal: number | null;
  buy: number | null;
  sell: number | null;
  targetPerShare: number | null;
  shares: number | null;
  profit: number | null;
  cmp: number | null;
  value: number | null;
  slDelta: number | null;
}

interface IntradaySheetResponse {
  source: "angel_one";
  generatedAt: string;
  authEnabled: boolean;
  globals: IntradaySheetGlobals;
  totals: {
    symbolCount: number;
    quotedCount: number;
    unavailableCount: number;
    breakoutCount: number;
    breakdownCount: number;
    watchBreakoutCount: number;
    resolvedCount: number;
  };
  rows: IntradaySheetRow[];
  warnings: string[];
}

function formatNumber(value: number | null, digits = 2): string {
  if (value == null) return "N/A";
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatCurrency(value: number | null): string {
  if (value == null) return "N/A";
  return `Rs ${formatNumber(value, 2)}`;
}

function formatPercent(value: number | null): string {
  if (value == null) return "N/A";
  return `${formatNumber(value, 2)}%`;
}

function signalBadge(state: boolean | null, yesLabel: string, noLabel = "—") {
  if (state === null) {
    return (
      <Badge variant="secondary" className="text-xs">
        {noLabel}
      </Badge>
    );
  }

  if (state) {
    return (
      <Badge variant="default" className="text-xs">
        {yesLabel}
      </Badge>
    );
  }

  return (
    <Badge variant="secondary" className="text-xs">
      {noLabel}
    </Badge>
  );
}

export default function IntradaySheetPage() {
  const [data, setData] = useState<IntradaySheetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const fetchSheet = useCallback(async (force = false) => {
    try {
      setError(null);
      const suffix = force ? "?force=1" : "";
      const response = await fetch(`/api/intraday-sheet${suffix}`);
      const payload = (await response.json()) as IntradaySheetResponse;

      if (!response.ok) {
        throw new Error(payload.warnings?.[0] ?? "Failed to fetch intraday sheet");
      }

      setData(payload);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : "Failed to fetch intraday sheet";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSheet();
    const interval = setInterval(() => {
      void fetchSheet();
    }, INTRADAY_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchSheet]);

  const lastUpdated = data ? new Date(data.generatedAt).toLocaleTimeString() : null;

  return (
    <>
      <AppHeader onMobileMenuOpen={() => setMobileOpen(!mobileOpen)}>
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-emerald-400" />
          <span className="text-sm font-semibold text-zinc-200">
            SE2481 Intraday Sheet
          </span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          {data && (
            <>
              <Badge variant={data.authEnabled ? "default" : "secondary"} className="hidden sm:inline-flex">
                {data.authEnabled ? "Angel One Live" : "Auth Missing"}
              </Badge>
              <span className="hidden sm:inline-flex items-center text-xs text-zinc-500">
                <Clock className="size-3 mr-1" />
                {lastUpdated}
              </span>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setLoading(true);
              void fetchSheet(true);
            }}
            title="Refresh now"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </AppHeader>

      <main className="p-4 lg:p-6 space-y-5">
        {error && (
          <Card className="border-red-500/20 bg-red-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="size-4 text-red-300 shrink-0" />
              <p className="text-sm text-red-200">{error}</p>
            </CardContent>
          </Card>
        )}

        {data?.warnings?.length ? (
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardContent className="p-4 space-y-1">
              {data.warnings.slice(0, 4).map((warning) => (
                <p key={warning} className="text-xs text-amber-200">
                  {warning}
                </p>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {data && (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
            <StatCard label="Capital" value={formatCurrency(data.globals.capital)} icon={Wallet} />
            <StatCard label="Target (K56)" value={formatCurrency(data.globals.targetAmount)} icon={Target} />
            <StatCard label="Gain (K57)" value={formatCurrency(data.globals.gainAmount)} subValue={formatPercent(data.globals.gainRatio * 100)} trend="up" />
            <StatCard label="Monthly (K58)" value={formatCurrency(data.globals.monthlyProjection)} />
            <StatCard label="Resolved / Quoted" value={`${data.totals.resolvedCount} / ${data.totals.quotedCount}`} subValue={`${data.totals.unavailableCount} unavailable`} trend={data.totals.unavailableCount ? "down" : "neutral"} />
            <StatCard label="Signals" value={`${data.totals.breakoutCount} / ${data.totals.breakdownCount}`} subValue={`${data.totals.watchBreakoutCount} watch`} trend={data.totals.breakoutCount >= data.totals.breakdownCount ? "up" : "down"} />
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span>Intraday Table</span>
              {data && (
                <Badge variant="secondary">
                  {data.totals.symbolCount} symbols
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-zinc-800 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Symbol</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Open</TableHead>
                    <TableHead className="text-right">High</TableHead>
                    <TableHead className="text-right">Low</TableHead>
                    <TableHead className="text-right">Prev Close</TableHead>
                    <TableHead className="text-right">Change %</TableHead>
                    <TableHead>Watch</TableHead>
                    <TableHead>Breakout</TableHead>
                    <TableHead>Breakdown</TableHead>
                    <TableHead className="text-right">Buy Signal (L)</TableHead>
                    <TableHead className="text-right">Sell Signal (M)</TableHead>
                    <TableHead className="text-right">Buy (N)</TableHead>
                    <TableHead className="text-right">Sell (O)</TableHead>
                    <TableHead className="text-right">Target (P)</TableHead>
                    <TableHead className="text-right">Shares (Q)</TableHead>
                    <TableHead className="text-right">Profit (R)</TableHead>
                    <TableHead className="text-right">CMP (S)</TableHead>
                    <TableHead className="text-right">Value (T)</TableHead>
                    <TableHead className="text-right">SL Delta (U)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.rows?.length ? (
                    data.rows.map((row) => {
                      const rowClass =
                        row.breakout === true
                          ? "bg-emerald-500/5"
                          : row.breakdown === true
                            ? "bg-red-500/5"
                            : "";

                      return (
                        <TableRow key={row.symbol} className={rowClass}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <span>{row.symbol}</span>
                              {row.quoteStatus === "unavailable" ? (
                                <Badge variant="secondary" className="text-[10px]">
                                  N/A
                                </Badge>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(row.price)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(row.open)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(row.high)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(row.low)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(row.prevClose)}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            <span
                              className={
                                row.changePct == null
                                  ? "text-zinc-500"
                                  : row.changePct >= 0
                                    ? "text-emerald-400"
                                    : "text-red-400"
                              }
                            >
                              {formatPercent(row.changePct)}
                            </span>
                          </TableCell>
                          <TableCell>{signalBadge(row.watchBreakout, "Watch")}</TableCell>
                          <TableCell>{signalBadge(row.breakout, "Yes")}</TableCell>
                          <TableCell>{signalBadge(row.breakdown, "Yes")}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(row.buySignal)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(row.sellSignal)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(row.buy)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(row.sell)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(row.targetPerShare)}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.shares == null ? "N/A" : row.shares.toLocaleString("en-IN")}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(row.profit)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(row.cmp)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(row.value)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(row.slDelta)}</TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={20} className="text-center text-zinc-500 py-8">
                        {loading ? "Loading intraday rows..." : "No rows available."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {data && (
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <TrendingUp className="size-3 text-emerald-400" />
            <span>{data.totals.breakoutCount} breakout rows</span>
            <TrendingDown className="size-3 text-red-400 ml-2" />
            <span>{data.totals.breakdownCount} breakdown rows</span>
          </div>
        )}
      </main>
    </>
  );
}
