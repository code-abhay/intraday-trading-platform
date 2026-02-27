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

export default function AlphaSheetPage() {
  const [data, setData] = useState<AlphaSheetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const fetchSheet = useCallback(async (force = false) => {
    try {
      setError(null);
      const suffix = force ? "?force=1" : "";
      const response = await fetch(`/api/alpha-sheet${suffix}`);
      const payload = (await response.json()) as AlphaSheetResponse;

      if (!response.ok) {
        throw new Error(payload.warnings?.[0] ?? "Failed to fetch alpha sheet");
      }

      setData(payload);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : "Failed to fetch alpha sheet";
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
      <AppHeader onMobileMenuOpen={() => setMobileOpen(!mobileOpen)}>
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-emerald-400" />
          <span className="text-sm font-semibold text-zinc-200">Nifty 50 Alpha Sheet</span>
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
            <StatCard
              label="M56 / N56"
              value={`${data.summary.breakoutCount} / ${data.summary.breakdownCount}`}
              subValue="breakout / breakdown"
              trend={
                data.summary.breakoutCount >= data.summary.breakdownCount ? "up" : "down"
              }
            />
            <StatCard
              label="K58 / K57"
              value={`${data.summary.buyingCount} / ${data.summary.sellingCount}`}
              subValue="buying / selling"
            />
            <StatCard
              label="J59 Bias"
              value={data.summary.bias}
              subValue={`K59 net: ${data.summary.netAdvance}`}
              trend={data.summary.bias === "Bullish" ? "up" : "down"}
            />
            <StatCard
              label="Gold ETF P&L"
              value={formatCurrency(data.portfolio.pnl)}
              subValue={`${data.portfolio.goldSymbol}: ${formatNumber(data.portfolio.goldPrice)}`}
              trend={data.portfolio.pnl >= 0 ? "up" : "down"}
              icon={Wallet}
            />
            <StatCard
              label="V11 / V12"
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
              <span>Alpha Rows (A:Q)</span>
              {data && <Badge variant="secondary">{data.totals.symbolCount} symbols</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-zinc-800 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Row</TableHead>
                    <TableHead>Symbol (A)</TableHead>
                    <TableHead className="text-right">LTP (F)</TableHead>
                    <TableHead className="text-right">Open (G)</TableHead>
                    <TableHead className="text-right">High (H)</TableHead>
                    <TableHead className="text-right">Low (I)</TableHead>
                    <TableHead className="text-right">Prev Close (J)</TableHead>
                    <TableHead className="text-right">Change (K)</TableHead>
                    <TableHead className="text-right">%C (L)</TableHead>
                    <TableHead>UP (M)</TableHead>
                    <TableHead>Down (N)</TableHead>
                    <TableHead className="text-right">Buy (O)</TableHead>
                    <TableHead className="text-right">Qty (P)</TableHead>
                    <TableHead className="text-right">Target (Q)</TableHead>
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
                          <TableCell>{row.sheetRow}</TableCell>
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
                          <TableCell className="text-right tabular-nums">{formatNumber(row.ltp)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(row.open)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(row.high)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(row.low)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(row.prevClose)}</TableCell>
                          <TableCell className="text-right tabular-nums">
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
                          <TableCell>
                            <Badge variant={row.upSignal === "breakout" ? "default" : "secondary"}>
                              {row.upSignal === "breakout" ? "breakout" : "—"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={row.downSignal === "breakdown" ? "destructive" : "secondary"}
                            >
                              {row.downSignal === "breakdown" ? "breakdown" : "—"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatNumber(row.buy)}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.quantity == null ? "N/A" : row.quantity.toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatNumber(row.targetPerShare)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center text-zinc-500 py-8">
                        {loading ? "Loading alpha rows..." : "No rows available."}
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
              <CardTitle className="text-base">Portfolio Block (S:V)</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 text-sm">
              <div className="rounded-md border border-zinc-800 p-3">
                <p className="text-zinc-400">Q1 x P1</p>
                <p className="tabular-nums">
                  {data.portfolio.q1Qty} x {formatNumber(data.portfolio.p1Price)}
                </p>
              </div>
              <div className="rounded-md border border-zinc-800 p-3">
                <p className="text-zinc-400">Q2 x P2</p>
                <p className="tabular-nums">
                  {data.portfolio.q2Qty} x {formatNumber(data.portfolio.p2Price)}
                </p>
              </div>
              <div className="rounded-md border border-zinc-800 p-3">
                <p className="text-zinc-400">Final (V5) / Qty (V6)</p>
                <p className="tabular-nums">
                  {formatNumber(data.portfolio.weightedAverage)} / {data.portfolio.totalQuantity}
                </p>
              </div>
              <div className="rounded-md border border-zinc-800 p-3">
                <p className="text-zinc-400">Gold Price (V9)</p>
                <p className="tabular-nums">
                  {data.portfolio.goldSymbol}: {formatNumber(data.portfolio.goldPrice)}
                </p>
              </div>
              <div className="rounded-md border border-zinc-800 p-3">
                <p className="text-zinc-400">P&L (V10)</p>
                <p className="tabular-nums">{formatCurrency(data.portfolio.pnl)}</p>
              </div>
              <div className="rounded-md border border-zinc-800 p-3">
                <p className="text-zinc-400">Total / Risk (V11 / V12)</p>
                <p className="tabular-nums">
                  {formatCurrency(data.portfolio.totalInvested)} / {formatCurrency(data.portfolio.riskAmount)}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {data && (
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <TrendingUp className="size-3 text-emerald-400" />
            <span>{data.summary.buyingCount} buying rows (K &gt; 0)</span>
            <TrendingDown className="size-3 text-red-400 ml-2" />
            <span>{data.summary.sellingCount} selling rows (K &lt; 0)</span>
          </div>
        )}
      </main>
    </>
  );
}
