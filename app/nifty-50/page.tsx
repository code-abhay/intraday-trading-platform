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
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { ALPHA_POLL_INTERVAL_MS } from "@/lib/alpha-sheet-config";

interface AlphaSheetRow {
  sheetRow: number;
  symbol: string;
  quoteStatus: "ok" | "unavailable";
  unavailableReason: string | null;
  ltp: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  prevClose: number | null;
  change: number | null;
  changePct: number | null;
  breakout: boolean | null;
  breakdown: boolean | null;
  upSignal: "breakout" | " ";
  downSignal: "breakdown" | " ";
  buy: number | null;
  quantity: number | null;
  targetPerShare: number | null;
}

interface AlphaSheetResponse {
  source: "angel_one";
  generatedAt: string;
  authEnabled: boolean;
  totals: {
    symbolCount: number;
    quotedCount: number;
    unavailableCount: number;
    breakoutCount: number;
    breakdownCount: number;
    resolvedCount: number;
  };
  summary: {
    timestampIso: string;
    breakoutCount: number;
    breakdownCount: number;
    sellingCount: number;
    buyingCount: number;
    bias: "Bullish" | "Bearish";
    netAdvance: number;
  };
  portfolio: {
    q1Qty: number;
    q2Qty: number;
    p1Price: number;
    p2Price: number;
    weightedAverage: number;
    totalQuantity: number;
    goldSymbol: string;
    goldPrice: number;
    pnl: number;
    totalInvested: number;
    riskRate: number;
    riskAmount: number;
  };
  rows: AlphaSheetRow[];
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

export default function Nifty50Page() {
  const [data, setData] = useState<AlphaSheetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSheet = useCallback(async (force = false) => {
    try {
      setError(null);
      const suffix = force ? "?force=1" : "";
      const response = await fetch(`/api/alpha-sheet${suffix}`);
      const payload = (await response.json()) as AlphaSheetResponse;

      if (!response.ok) {
        throw new Error(payload.warnings?.[0] ?? "Failed to fetch Nifty 50 data");
      }

      setData(payload);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : "Failed to fetch Nifty 50 data";
      setData(null);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSheet();
    const interval = setInterval(() => {
      void fetchSheet();
    }, ALPHA_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchSheet]);

  const lastUpdated = data ? new Date(data.generatedAt).toLocaleTimeString() : null;

  return (
    <>
      <AppHeader>
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-emerald-400" />
          <span className="text-sm font-semibold text-zinc-200">Nifty 50</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          {data && (
            <>
              <Badge
                variant={data.authEnabled ? "default" : "secondary"}
                className="hidden sm:inline-flex"
              >
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
              {data.warnings.slice(0, 5).map((warning) => (
                <p key={warning} className="text-xs text-amber-200">
                  {warning}
                </p>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {data && (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-6">
            <StatCard
              label="Resolved / Quoted"
              value={`${data.totals.resolvedCount} / ${data.totals.quotedCount}`}
              subValue={`${data.totals.unavailableCount} unavailable`}
              trend={data.totals.unavailableCount ? "down" : "neutral"}
            />
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 backdrop-blur-sm">
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Signals</p>
              <p className="mt-2 text-xl font-bold tabular-nums">
                <span className="text-emerald-400">{data.summary.breakoutCount}</span>
                <span className="text-zinc-500"> / </span>
                <span className="text-red-400">{data.summary.breakdownCount}</span>
              </p>
              <p className="mt-1 text-xs text-zinc-500">breakout / breakdown</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 backdrop-blur-sm">
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Trend Breadth</p>
              <p className="mt-2 text-xl font-bold tabular-nums">
                <span className="text-emerald-400">{data.summary.buyingCount}</span>
                <span className="text-zinc-500"> / </span>
                <span className="text-red-400">{data.summary.sellingCount}</span>
              </p>
              <p className="mt-1 text-xs text-zinc-500">buying / selling</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 backdrop-blur-sm">
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Market Bias</p>
              <p
                className={`mt-2 text-xl font-bold tabular-nums ${
                  data.summary.bias === "Bullish" ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {data.summary.bias}
              </p>
              <p
                className={`mt-1 text-xs font-medium ${
                  data.summary.netAdvance >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                Net: {data.summary.netAdvance}
              </p>
            </div>
            <StatCard
              label="Gold ETF P&L"
              value={formatCurrency(data.portfolio.pnl)}
              subValue={`${data.portfolio.goldSymbol}: ${formatNumber(data.portfolio.goldPrice)}`}
              trend={data.portfolio.pnl >= 0 ? "up" : "down"}
              icon={Wallet}
            />
            <StatCard
              label="Total Invested"
              value={formatCurrency(data.portfolio.totalInvested)}
              subValue={`Risk (${formatPercent(data.portfolio.riskRate * 100)}): ${formatCurrency(
                data.portfolio.riskAmount
              )}`}
            />
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span>Nifty 50 Table</span>
              {data && <Badge variant="secondary">{data.totals.symbolCount} symbols</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-zinc-800 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="min-w-14 whitespace-nowrap">Row</TableHead>
                    <TableHead className="min-w-40 whitespace-nowrap">Symbol</TableHead>
                    <TableHead className="text-right min-w-24 whitespace-nowrap">LTP</TableHead>
                    <TableHead className="text-right min-w-24 whitespace-nowrap">Open</TableHead>
                    <TableHead className="text-right min-w-24 whitespace-nowrap">High</TableHead>
                    <TableHead className="text-right min-w-24 whitespace-nowrap">Low</TableHead>
                    <TableHead className="text-right min-w-24 whitespace-nowrap">Prev Close</TableHead>
                    <TableHead className="text-right min-w-24 whitespace-nowrap">Change</TableHead>
                    <TableHead className="text-right min-w-24 whitespace-nowrap">Change %</TableHead>
                    <TableHead className="min-w-24 whitespace-nowrap">Breakout</TableHead>
                    <TableHead className="min-w-24 whitespace-nowrap">Breakdown</TableHead>
                    <TableHead className="text-right min-w-24 whitespace-nowrap">Buy</TableHead>
                    <TableHead className="text-right min-w-20 whitespace-nowrap">Qty</TableHead>
                    <TableHead className="text-right min-w-24 whitespace-nowrap">Target</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.rows?.length ? (
                    data.rows.map((row, index) => {
                      const rowClass =
                        row.breakout === true
                          ? "bg-emerald-500/5"
                          : row.breakdown === true
                            ? "bg-red-500/5"
                            : "";

                      return (
                        <TableRow key={row.symbol} className={rowClass}>
                          <TableCell className="tabular-nums">{index + 1}</TableCell>
                          <TableCell className="font-medium whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span>{row.symbol}</span>
                              {row.quoteStatus === "unavailable" ? (
                                <Badge variant="secondary" className="text-[10px]">
                                  N/A
                                </Badge>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums whitespace-nowrap">{formatNumber(row.ltp)}</TableCell>
                          <TableCell className="text-right tabular-nums whitespace-nowrap">{formatNumber(row.open)}</TableCell>
                          <TableCell className="text-right tabular-nums whitespace-nowrap">{formatNumber(row.high)}</TableCell>
                          <TableCell className="text-right tabular-nums whitespace-nowrap">{formatNumber(row.low)}</TableCell>
                          <TableCell className="text-right tabular-nums whitespace-nowrap">{formatNumber(row.prevClose)}</TableCell>
                          <TableCell className="text-right tabular-nums whitespace-nowrap">
                            <span
                              className={
                                row.change == null
                                  ? "text-zinc-500"
                                  : row.change >= 0
                                    ? "text-emerald-400"
                                    : "text-red-400"
                              }
                            >
                              {formatNumber(row.change)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums whitespace-nowrap">
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
                          <TableCell>
                            <Badge variant={row.breakout ? "default" : "secondary"}>
                              {row.breakout ? "breakout" : "—"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={row.breakdown ? "destructive" : "secondary"}>
                              {row.breakdown ? "breakdown" : "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums whitespace-nowrap">{formatNumber(row.buy)}</TableCell>
                          <TableCell className="text-right tabular-nums whitespace-nowrap">
                            {row.quantity == null ? "N/A" : row.quantity.toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="text-right tabular-nums whitespace-nowrap">
                            {formatNumber(row.targetPerShare)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center text-zinc-500 py-8">
                        {loading ? "Loading Nifty 50 rows..." : "No rows available."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {data && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Portfolio Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 text-sm">
              <div className="rounded-md border border-zinc-800 p-3 flex flex-col items-center justify-center text-center gap-1">
                <p className="text-zinc-400">Lot 1 x Price 1</p>
                <p className="tabular-nums">
                  {data.portfolio.q1Qty} x {formatNumber(data.portfolio.p1Price)}
                </p>
              </div>
              <div className="rounded-md border border-zinc-800 p-3 flex flex-col items-center justify-center text-center gap-1">
                <p className="text-zinc-400">Lot 2 x Price 2</p>
                <p className="tabular-nums">
                  {data.portfolio.q2Qty} x {formatNumber(data.portfolio.p2Price)}
                </p>
              </div>
              <div className="rounded-md border border-zinc-800 p-3 flex flex-col items-center justify-center text-center gap-1">
                <p className="text-zinc-400">Weighted Price / Total Qty</p>
                <p className="tabular-nums">
                  {formatNumber(data.portfolio.weightedAverage)} / {data.portfolio.totalQuantity}
                </p>
              </div>
              <div className="rounded-md border border-zinc-800 p-3 flex flex-col items-center justify-center text-center gap-1">
                <p className="text-zinc-400">Gold Price</p>
                <p className="tabular-nums">
                  {data.portfolio.goldSymbol}: {formatNumber(data.portfolio.goldPrice)}
                </p>
              </div>
              <div className="rounded-md border border-zinc-800 p-3 flex flex-col items-center justify-center text-center gap-1">
                <p className="text-zinc-400">P&L</p>
                <p className={`tabular-nums ${data.portfolio.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {formatCurrency(data.portfolio.pnl)}
                </p>
              </div>
              <div className="rounded-md border border-zinc-800 p-3 flex flex-col items-center justify-center text-center gap-1">
                <p className="text-zinc-400">Total / Risk</p>
                <p className="tabular-nums">
                  {formatCurrency(data.portfolio.totalInvested)} / {formatCurrency(data.portfolio.riskAmount)}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {data && (
          <div className="flex items-center gap-3 text-xs">
            <TrendingUp className="size-3 text-emerald-400" />
            <span className="text-emerald-400">{data.summary.buyingCount} buying rows</span>
            <TrendingDown className="size-3 text-red-400 ml-2" />
            <span className="text-red-400">{data.summary.sellingCount} selling rows</span>
          </div>
        )}
      </main>
    </>
  );
}
