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
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import type { ExecutionProfile, StrategyEvaluation, StrategyLabApiResponse } from "@/lib/strategy-lab/types";

type SegmentPicker = SegmentId | "ALL";

interface StrategyLabRunStatusResponse {
  runId: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  error?: string | null;
  result?: StrategyLabApiResponse | null;
}

const SEGMENT_OPTIONS = [
  { id: "ALL", label: "All Segments" },
  ...SEGMENTS.map((segment) => ({ id: segment.id, label: segment.label })),
];
const DAY_PRESETS = [7, 45, 90, 180, 365];

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

function topRejectionReason(reasons: Record<string, number>): string {
  const entries = Object.entries(reasons);
  if (!entries.length) return "n/a";
  const best = entries.sort((a, b) => b[1] - a[1])[0];
  return `${best[0]} (${best[1]})`;
}

export default function StrategyLabPage() {
  const [segment, setSegment] = useState<SegmentPicker>("ALL");
  const [days, setDays] = useState(45);
  const [profile, setProfile] = useState<ExecutionProfile>("balanced");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StrategyLabApiResponse | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeRunStatus, setActiveRunStatus] = useState<StrategyLabRunStatusResponse["status"] | null>(null);
  const [runIdInput, setRunIdInput] = useState("");

  const fetchRunStatus = useCallback(async (runId: string) => {
    const response = await fetch(`/api/strategy-lab/run/${runId}`);
    const payload = (await response.json()) as StrategyLabRunStatusResponse & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error || "Failed to fetch async run status");
    }
    setActiveRunId(runId);
    setActiveRunStatus(payload.status);
    if (payload.status === "COMPLETED" && payload.result) {
      setData(payload.result);
      setError(null);
    } else if (payload.status === "FAILED") {
      setError(payload.error || "Async run failed");
    }
  }, []);

  const fetchLab = useCallback(
    async (force = false) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          segment,
          days: String(Math.min(365, Math.max(7, days))),
          profile,
        });
        if (force) params.set("force", "1");
        const response = await fetch(`/api/strategy-lab?${params.toString()}`);
        const payload = (await response.json()) as StrategyLabApiResponse & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error || "Failed to load strategy lab report");
        }
        if (payload.mode === "async" && payload.runId) {
          setData(null);
          setActiveRunId(payload.runId);
          setActiveRunStatus(payload.status ?? "PENDING");
          setRunIdInput(payload.runId);
          void fetchRunStatus(payload.runId).catch((runError) => {
            setError(runError instanceof Error ? runError.message : "Failed to fetch async run status");
          });
        } else {
          setData(payload);
          setActiveRunId(null);
          setActiveRunStatus(null);
        }
      } catch (fetchError) {
        setData(null);
        setError(
          fetchError instanceof Error ? fetchError.message : "Failed to load strategy lab report"
        );
      } finally {
        setLoading(false);
      }
    },
    [days, fetchRunStatus, profile, segment]
  );

  useEffect(() => {
    void fetchLab(false);
    // Initial load only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!activeRunId || !activeRunStatus) return;
    if (activeRunStatus === "COMPLETED" || activeRunStatus === "FAILED") return;
    const interval = window.setInterval(() => {
      void fetchRunStatus(activeRunId).catch((pollError) => {
        setError(pollError instanceof Error ? pollError.message : "Failed to poll run status");
      });
    }, 4000);
    return () => window.clearInterval(interval);
  }, [activeRunId, activeRunStatus, fetchRunStatus]);

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
  const lowTradeDiagnostics = useMemo(() => {
    const list = data?.overallRanking ?? [];
    const activeDays = data?.days ?? days;
    return list
      .filter((item) => item.kpis.trades <= Math.max(4, Math.round(activeDays * 0.75)))
      .slice(0, 12);
  }, [data, days]);
  const duplicatePairs = useMemo(
    () => (data?.duplicateDiagnostics?.pairs ?? []).slice(0, 12),
    [data]
  );
  const duplicateSummaries = useMemo(
    () => (data?.duplicateDiagnostics?.summaries ?? []).slice(0, 12),
    [data]
  );
  const duplicateThreshold = data?.duplicateDiagnostics?.threshold ?? 72;
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
                {data.mode === "async" ? "Cached Async Run" : "Direct Evaluation"}
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
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {DAY_PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant={days === preset ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDays(preset)}
                  >
                    {preset}d
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={profile === "balanced" ? "default" : "outline"}
                  onClick={() => setProfile("balanced")}
                >
                  Balanced (default)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={profile === "strict" ? "default" : "outline"}
                  onClick={() => setProfile("strict")}
                >
                  Strict
                </Button>
              </div>
            </div>
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
                <p className="text-xs text-zinc-400 uppercase tracking-wider">Lookback Days (7-365)</p>
                <Input
                  type="number"
                  min={7}
                  max={365}
                  value={days}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);
                    if (Number.isNaN(parsed)) return;
                    setDays(Math.min(365, Math.max(7, parsed)));
                  }}
                />
              </div>
              <div className="space-y-2 w-full lg:w-80">
                <p className="text-xs text-zinc-400 uppercase tracking-wider">Open Cached Run</p>
                <div className="flex items-center gap-2">
                  <Input
                    value={runIdInput}
                    placeholder="Paste run id"
                    onChange={(event) => setRunIdInput(event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (!runIdInput.trim()) return;
                      void fetchRunStatus(runIdInput.trim()).catch((runError) => {
                        setError(runError instanceof Error ? runError.message : "Failed to load run");
                      });
                    }}
                  >
                    Open
                  </Button>
                </div>
              </div>
              <Button onClick={() => void fetchLab(true)} disabled={loading}>
                {loading ? "Running..." : "Run Test"}
              </Button>
            </div>
            {data && (
              <p className="text-xs text-zinc-500">
                Window: {formatDateRange(data.from, data.to)} ({data.days} days)
                {` • Profile: ${data.profile}`}
                {typeof data.pageSize === "number" ? ` • Page size: ${data.pageSize}` : ""}
              </p>
            )}
            {activeRunId && activeRunStatus && activeRunStatus !== "COMPLETED" && (
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-200 flex items-center gap-2">
                <LoaderCircle className="size-3 animate-spin" />
                Async run {activeRunId} is {activeRunStatus}. Polling for completion...
              </div>
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
              subValue={
                topOverall
                  ? `${topOverall.segment} | Final ${topOverall.score} | Base ${topOverall.baseScore}`
                  : "No ranking yet"
              }
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
              value="Reliability + Uniqueness"
              subValue="Base + consistency + frequency reliability - duplicate penalty"
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
                    <TableHead className="text-right">Final</TableHead>
                    <TableHead className="text-right">Base</TableHead>
                    <TableHead className="text-right">Consistency</TableHead>
                    <TableHead className="text-right">Reliability</TableHead>
                    <TableHead className="text-right">Dup Risk</TableHead>
                    <TableHead className="text-right">Dup Penalty</TableHead>
                    <TableHead className="text-right">Net R</TableHead>
                    <TableHead className="text-right">Win Rate</TableHead>
                    <TableHead className="text-right">Profit Factor</TableHead>
                    <TableHead className="text-right">Max DD (R)</TableHead>
                    <TableHead className="text-right">Trades</TableHead>
                    <TableHead className="text-right">Trades/Day</TableHead>
                    <TableHead className="text-right">Positive Weeks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!data?.overallRanking?.length ? (
                    <TableRow>
                      <TableCell colSpan={17} className="text-center text-zinc-500 py-8">
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
                        <TableCell className="text-right">{formatNumber(item.baseScore, 2)}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.consistencyScore, 2)}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.reliabilityScore, 2)}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.duplicateRisk, 1)}%</TableCell>
                        <TableCell className="text-right text-amber-300">
                          -{formatNumber(item.duplicatePenalty, 2)}
                        </TableCell>
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
                        <TableCell className="text-right">{formatNumber(item.kpis.trades / Math.max(1, data.days), 2)}</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(item.consistency.positiveWindowRate, 1)}%
                        </TableCell>
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
                          <span>Base: {formatNumber(best.baseScore, 2)}</span>
                          <span>•</span>
                          <span>Consistency: {formatNumber(best.consistencyScore, 2)}</span>
                          <span>•</span>
                          <span>Reliability: {formatNumber(best.reliabilityScore, 2)}</span>
                          <span>•</span>
                          <span>Dup Penalty: -{formatNumber(best.duplicatePenalty, 2)}</span>
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
                        <div className="mt-2 text-[11px] text-zinc-500 space-y-1">
                          <p>
                            Entries: {best.activity.entriesTaken} / Candidates: {best.activity.signalCandidates}
                            {" • "}
                            Blocked (spacing/risk/day): {best.activity.blockedBySpacing}/
                            {best.activity.blockedByRiskFilter}/{best.activity.blockedByDailyRisk}
                          </p>
                          <p>Top rejection: {topRejectionReason(best.activity.rejectionReasons)}</p>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Why Low Trades Diagnostics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-zinc-800 overflow-auto">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Strategy</TableHead>
                    <TableHead>Segment</TableHead>
                    <TableHead className="text-right">Trades</TableHead>
                    <TableHead className="text-right">Candidates</TableHead>
                    <TableHead className="text-right">Blocked Spacing</TableHead>
                    <TableHead className="text-right">Blocked Daily Risk</TableHead>
                    <TableHead className="text-right">Blocked Risk Filter</TableHead>
                    <TableHead>Top Rejection</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!lowTradeDiagnostics.length ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-zinc-500 py-6">
                        No low-trade rows in the current result set.
                      </TableCell>
                    </TableRow>
                  ) : (
                    lowTradeDiagnostics.map((item) => (
                      <TableRow key={`${item.segment}_${item.strategyId}_diag`}>
                        <TableCell>{item.strategyName}</TableCell>
                        <TableCell>{item.segment}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.kpis.trades, 0)}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.activity.signalCandidates, 0)}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.activity.blockedBySpacing, 0)}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.activity.blockedByDailyRisk, 0)}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.activity.blockedByRiskFilter, 0)}</TableCell>
                        <TableCell>{topRejectionReason(item.activity.rejectionReasons)}</TableCell>
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
            <CardTitle className="text-base">
              Duplicate Strategy Diagnostics (threshold {formatNumber(duplicateThreshold, 0)})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-zinc-800 overflow-auto">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Segment</TableHead>
                    <TableHead>Strategy Pair</TableHead>
                    <TableHead className="text-right">Similarity</TableHead>
                    <TableHead className="text-right">Entry Overlap</TableHead>
                    <TableHead className="text-right">Direction Agree</TableHead>
                    <TableHead className="text-right">Trade Count Match</TableHead>
                    <TableHead className="text-right">Daily NetR Corr</TableHead>
                    <TableHead>Reason Tags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!duplicatePairs.length ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-zinc-500 py-6">
                        No high-overlap strategy pairs in the current run.
                      </TableCell>
                    </TableRow>
                  ) : (
                    duplicatePairs.map((pair) => (
                      <TableRow key={`${pair.segment}_${pair.strategyAId}_${pair.strategyBId}`}>
                        <TableCell>{pair.segment}</TableCell>
                        <TableCell>
                          {pair.strategyAName} <span className="text-zinc-500">vs</span> {pair.strategyBName}
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(pair.similarity, 1)}%</TableCell>
                        <TableCell className="text-right">{formatNumber(pair.entryOverlapPct, 1)}%</TableCell>
                        <TableCell className="text-right">{formatNumber(pair.directionAgreementPct, 1)}%</TableCell>
                        <TableCell className="text-right">
                          {formatNumber(pair.tradeCountSimilarityPct, 1)}%
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(pair.netRCorrelationPct, 1)}%</TableCell>
                        <TableCell className="text-xs text-zinc-400">{pair.reasons.join(", ")}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="rounded-lg border border-zinc-800 overflow-auto">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Segment</TableHead>
                    <TableHead>Strategy</TableHead>
                    <TableHead className="text-right">Max Similarity</TableHead>
                    <TableHead className="text-right">Avg Similarity</TableHead>
                    <TableHead className="text-right">Near Duplicates</TableHead>
                    <TableHead className="text-right">Penalty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!duplicateSummaries.length ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-zinc-500 py-6">
                        No strategy-level duplicate summary available.
                      </TableCell>
                    </TableRow>
                  ) : (
                    duplicateSummaries.map((row) => (
                      <TableRow key={`${row.segment}_${row.strategyId}_dup`}>
                        <TableCell>{row.segment}</TableCell>
                        <TableCell>{row.strategyName}</TableCell>
                        <TableCell className="text-right">{formatNumber(row.maxSimilarity, 1)}%</TableCell>
                        <TableCell className="text-right">{formatNumber(row.averageSimilarity, 1)}%</TableCell>
                        <TableCell className="text-right">{formatNumber(row.nearDuplicateCount, 0)}</TableCell>
                        <TableCell className="text-right text-amber-300">
                          -{formatNumber(row.duplicatePenalty, 2)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
