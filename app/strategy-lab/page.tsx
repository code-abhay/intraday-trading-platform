"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppHeader, SegmentSelector } from "@/components/app-header";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SEGMENTS, type SegmentId } from "@/lib/segments";
import {
  Activity,
  AlertTriangle,
  Clock,
  FlaskConical,
  RefreshCw,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import type { StrategyEvaluation } from "@/lib/strategy-lab/types";

type SegmentPicker = SegmentId | "ALL";

interface StrategyLabResponse {
  generatedAt: string;
  from: string;
  to: string;
  days: number;
  pageSize?: number;
  segments: {
    segment: SegmentId;
    evaluations: StrategyEvaluation[];
    bestStrategy: StrategyEvaluation | null;
    diagnostics: {
      candleRowsFetched: number;
      snapshotRowsFetched: number;
      oiRowsFetched: number;
      oiPointsMapped: number;
      oiPagesFetched: number;
    };
  }[];
  overallRanking: StrategyEvaluation[];
  warnings: string[];
}

const SEGMENT_OPTIONS = [
  { id: "ALL", label: "All Segments" },
  ...SEGMENTS.map((segment) => ({ id: segment.id, label: segment.label })),
];

function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatPct(value: number): string {
  return `${formatNumber(value, 1)}%`;
}

function formatDateRange(fromIso: string, toIso: string): string {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return "N/A";
  return `${from.toLocaleDateString("en-IN")} - ${to.toLocaleDateString("en-IN")}`;
}

function qualityBadgeClass(quality: string): string {
  if (quality === "A+") return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
  if (quality === "A") return "bg-cyan-500/10 text-cyan-300 border-cyan-500/30";
  return "bg-amber-500/10 text-amber-300 border-amber-500/30";
}

export default function StrategyLabPage() {
  const [segment, setSegment] = useState<SegmentPicker>("ALL");
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StrategyLabResponse | null>(null);

  const fetchLab = useCallback(
    async (force = false) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          segment,
          days: String(Math.min(14, Math.max(3, days))),
        });
        if (force) params.set("force", "1");
        const response = await fetch(`/api/strategy-lab?${params.toString()}`);
        const payload = (await response.json()) as StrategyLabResponse & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error || "Failed to load strategy lab report");
        }
        setData(payload);
      } catch (fetchError) {
        setData(null);
        setError(
          fetchError instanceof Error ? fetchError.message : "Failed to load strategy lab report"
        );
      } finally {
        setLoading(false);
      }
    },
    [days, segment]
  );

  useEffect(() => {
    void fetchLab();
  }, [fetchLab]);

  const topOverall = data?.overallRanking?.[0] ?? null;
  const totalTrades = useMemo(
    () =>
      (data?.overallRanking ?? []).reduce(
        (sum, evalItem) => sum + (evalItem.kpis?.trades ?? 0),
        0
      ),
    [data]
  );
  const averageWinRate = useMemo(() => {
    const ranking = data?.overallRanking ?? [];
    if (!ranking.length) return 0;
    return (
      ranking.reduce((sum, evalItem) => sum + (evalItem.kpis?.winRate ?? 0), 0) /
      ranking.length
    );
  }, [data]);
  const lastUpdated = data ? new Date(data.generatedAt).toLocaleTimeString() : null;

  return (
    <>
      <AppHeader>
        <div className="flex items-center gap-2">
          <FlaskConical className="size-4 text-emerald-400" />
          <span className="text-sm font-semibold text-zinc-200">Strategy Lab</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          {data && (
            <>
              <Badge variant="default" className="hidden sm:inline-flex">
                1-Week Forward Test
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
            title="Refresh now"
            onClick={() => {
              void fetchLab(true);
            }}
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </AppHeader>

      <main className="p-4 lg:p-6 space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Test Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <div className="space-y-2">
                <p className="text-xs text-zinc-400 uppercase tracking-wider">Segments</p>
                <SegmentSelector
                  segments={SEGMENT_OPTIONS}
                  active={segment}
                  onChange={(value) => setSegment(value as SegmentPicker)}
                />
              </div>
              <div className="space-y-2 w-full lg:w-48">
                <p className="text-xs text-zinc-400 uppercase tracking-wider">Lookback Days (3-14)</p>
                <Input
                  type="number"
                  min={3}
                  max={14}
                  value={days}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);
                    if (Number.isNaN(parsed)) return;
                    setDays(Math.min(14, Math.max(3, parsed)));
                  }}
                />
              </div>
              <Button onClick={() => void fetchLab(true)} disabled={loading}>
                {loading ? "Running..." : "Run Test"}
              </Button>
            </div>
            {data && (
              <p className="text-xs text-zinc-500">
                Window: {formatDateRange(data.from, data.to)} ({data.days} days)
                {typeof data.pageSize === "number" ? ` • Page size: ${data.pageSize}` : ""}
              </p>
            )}
          </CardContent>
        </Card>

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
              {data.warnings.slice(0, 8).map((warning) => (
                <p key={warning} className="text-xs text-amber-200">
                  {warning}
                </p>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {data && (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Top Strategy"
              value={topOverall ? topOverall.strategyName : "N/A"}
              subValue={topOverall ? `${topOverall.segment} | Score ${topOverall.score}` : "No ranking yet"}
              icon={Trophy}
              trend="up"
            />
            <StatCard
              label="Total Simulated Trades"
              value={formatNumber(totalTrades, 0)}
              subValue={`${data.overallRanking.length} strategy-segment tests`}
              icon={Activity}
            />
            <StatCard
              label="Average Win Rate"
              value={formatPct(averageWinRate)}
              subValue="Across all tested strategies"
              icon={ShieldCheck}
              trend={averageWinRate >= 50 ? "up" : "down"}
            />
            <StatCard
              label="Risk-Adjusted Focus"
              value="Net R / Drawdown"
              subValue="Composite ranking with drawdown penalty"
              icon={FlaskConical}
            />
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Overall Ranking</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-zinc-800 overflow-auto">
              <Table className="min-w-[1120px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>Strategy</TableHead>
                    <TableHead>Segment</TableHead>
                    <TableHead>Quality</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">Net R</TableHead>
                    <TableHead className="text-right">Win Rate</TableHead>
                    <TableHead className="text-right">Profit Factor</TableHead>
                    <TableHead className="text-right">Max DD (R)</TableHead>
                    <TableHead className="text-right">Trades</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!data?.overallRanking?.length ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-zinc-500 py-8">
                        {loading ? "Running strategy tests..." : "No ranking data available."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.overallRanking.map((item, idx) => (
                      <TableRow key={`${item.segment}_${item.strategyId}_${idx}`}>
                        <TableCell className="font-medium">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="font-medium text-zinc-100">{item.strategyName}</div>
                        </TableCell>
                        <TableCell>{item.segment}</TableCell>
                        <TableCell>
                          <Badge className={qualityBadgeClass(item.qualityRating)}>
                            {item.qualityRating}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">{formatNumber(item.score, 2)}</TableCell>
                        <TableCell
                          className={`text-right ${
                            item.kpis.netR >= 0 ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {formatNumber(item.kpis.netR, 2)}
                        </TableCell>
                        <TableCell className="text-right">{formatPct(item.kpis.winRate)}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.kpis.profitFactor, 2)}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.kpis.maxDrawdownR, 2)}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.kpis.trades, 0)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Best Strategy By Segment</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {!data?.segments?.length ? (
              <p className="text-sm text-zinc-500">No segment-level breakdown yet.</p>
            ) : (
              data.segments.map((segmentSummary) => {
                const best = segmentSummary.bestStrategy;
                return (
                  <div
                    key={segmentSummary.segment}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-zinc-100">{segmentSummary.segment}</p>
                      <Badge variant="secondary">
                        {segmentSummary.evaluations.length} tested
                      </Badge>
                    </div>
                    {!best ? (
                      <p className="text-xs text-zinc-500">Insufficient data to rank this segment.</p>
                    ) : (
                      <>
                        <p className="text-sm text-emerald-300 font-medium">{best.strategyName}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                          <span>Score: {formatNumber(best.score, 2)}</span>
                          <span>•</span>
                          <span>Win: {formatPct(best.kpis.winRate)}</span>
                          <span>•</span>
                          <span>Net R: {formatNumber(best.kpis.netR, 2)}</span>
                          <span>•</span>
                          <span>PF: {formatNumber(best.kpis.profitFactor, 2)}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                          <span>Candles: {formatNumber(segmentSummary.diagnostics.candleRowsFetched, 0)}</span>
                          <span>•</span>
                          <span>Snapshots: {formatNumber(segmentSummary.diagnostics.snapshotRowsFetched, 0)}</span>
                          <span>•</span>
                          <span>OI Rows: {formatNumber(segmentSummary.diagnostics.oiRowsFetched, 0)}</span>
                          <span>•</span>
                          <span>OI Points: {formatNumber(segmentSummary.diagnostics.oiPointsMapped, 0)}</span>
                          <span>•</span>
                          <span>OI Pages: {formatNumber(segmentSummary.diagnostics.oiPagesFetched, 0)}</span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
