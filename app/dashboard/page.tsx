"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { SEGMENTS, type SegmentId } from "@/lib/segments";
import { isMarketOpen, getMarketStatusMessage } from "@/lib/utils";
import { AppHeader, SegmentSelector } from "@/components/app-header";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp,
  TrendingDown,
  BarChart3,
  Activity,
  Target,
  Shield,
  Gauge,
  Zap,
  ArrowRight,
  RefreshCw,
  Clock,
  Wifi,
  WifiOff,
  ChevronRight,
  Menu,
  Bell,
  BellOff,
  Sparkles,
  AlertTriangle,
  Brain,
} from "lucide-react";
import Link from "next/link";

// ────────────────────── Types ──────────────────────

interface TargetsStops { entry: number; stopLoss: number; t1: number; t2: number; t3: number; trailingStop: number; slPoints: number; rr1: number; rr2: number; rr3: number; }
interface OptionTargets { premiumEntry: number; premiumSL: number; premiumT1: number; premiumT2: number; premiumT3: number; premiumTrailSL: number; }
interface OptionsAdvisor { strike: number; side: string; premium: number; delta: number; mode: string; daysToExpiry: number; iv: number; theta: number; moneyness: string; recommendation: string; optionTargets?: OptionTargets; }
interface SRLevels { pdh: number; pdl: number; pdc: number; pivot: number; cprTC: number; cprBC: number; r1: number; r2: number; s1: number; s2: number; camH3: number; camL3: number; }
interface SentimentComp { name: string; score: number; weight: number }
interface Sentiment { score: number; side: string; optionsBias: string; momentum: string; components: SentimentComp[]; }
interface SignalStrength { score: number; max: number; label: string; components: { name: string; ok: boolean }[]; }
interface VolatilityInfo { atr: number; atrSma: number; ratio: number; regime: string; dynamicStopMult: number; dynamicTargetMult: number; }
interface PartialExitPlan { t1Pct: number; t2Pct: number; t3Pct: number; t1Lots: number; t2Lots: number; t3Lots: number; totalLots: number; }
interface AdvancedFiltersUI { rangeFilter: { filt: number; upward: boolean; downward: boolean }; rqk: { value: number; prevValue: number; uptrend: boolean; downtrend: boolean }; choppiness: number; isChoppy: boolean; rfConfirmsBull: boolean; rfConfirmsBear: boolean; rqkConfirmsBull: boolean; rqkConfirmsBear: boolean; }
interface Signal { bias: string; biasStrength?: string; entry?: number; stopLoss?: number; target?: number; t1?: number; t2?: number; t3?: number; trailingStop?: number; confidence: number; pcr: { value: number; bias: string; callOI: number; putOI: number }; maxPain: number; summary: string; targets?: TargetsStops; bullishTargets?: TargetsStops; bearishTargets?: TargetsStops; optionsAdvisor?: OptionsAdvisor; srLevels?: SRLevels; sentiment?: Sentiment; signalStrength?: SignalStrength; volatility?: VolatilityInfo; partialExits?: PartialExitPlan; tradeDirection?: string; advancedFilters?: AdvancedFiltersUI; signalExpired?: boolean; alternateBlocked?: boolean; alternateReason?: string; }
interface OITableRow { strike: number; ceOI: number; peOI: number; ceIV?: number; peIV?: number; ceDelta?: number; peDelta?: number; }
interface OIBuildupItem { symbol: string; oiChange: number; priceChange: number; }
interface MarketData { todayOpen: number; todayHigh: number; todayLow: number; prevClose: number; tradeVolume: number; buyQty: number; sellQty: number; }
interface TechIndicatorsUI { emaFast: number; emaSlow: number; emaTrend: string; rsiValue: number; rsiSignal: string; macdLine: number; macdSignal: number; macdHist: number; macdBias: string; vwap: number; vwapBias: string; adxProxy: number; trendStrength: string; }
interface SignalsResponse { source?: "angel_one" | "nse" | "demo"; symbol: string; underlyingValue: number; signal: Signal; rawPCR?: number; pcrSymbol?: string; expiry?: string; optionSymbol?: string; maxPain: { strike: number; totalPayout: number }[]; oiTable?: OITableRow[]; oiBuildupLong?: OIBuildupItem[]; oiBuildupShort?: OIBuildupItem[]; marketData?: MarketData; technicalIndicators?: TechIndicatorsUI; timestamp: string; }

function formatNum(n: number): string {
  if (n >= 1_00_00_000) return `${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (n >= 1_00_000) return `${(n / 1_00_000).toFixed(2)} L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ────────────────────── Page ──────────────────────

export default function Home() {
  const [segment, setSegment] = useState<SegmentId>("NIFTY");
  const [data, setData] = useState<SignalsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [marketOpen, setMarketOpen] = useState(() => isMarketOpen());
  const lastBiasRef = useRef<string>("");
  const [notifyEnabled, setNotifyEnabled] = useState<boolean | null>(null);
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<{
    aiScore: number; aiConfidence: number; riskLevel: string;
    reasoning: string; keyFactors: string[]; caution: string | null;
    adjustedSL: number | null; adjustedT1: number | null;
  } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetch("/api/notify").then(r => r.json()).then(d => setNotifyEnabled(d.enabled)).catch(() => {});
    fetch("/api/ai-analyze").then(r => r.json()).then(d => setAiEnabled(d.enabled)).catch(() => {});
  }, []);

  const fetchAiAnalysis = useCallback(async (resp: SignalsResponse) => {
    if (!aiEnabled) return;
    const sig = resp.signal;
    if (!sig || sig.bias === "NEUTRAL") { setAiAnalysis(null); return; }
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          segment: resp.symbol,
          ltp: resp.underlyingValue,
          bias: sig.bias,
          biasStrength: sig.biasStrength,
          confidence: sig.confidence,
          pcr: sig.pcr,
          maxPain: sig.maxPain,
          technicals: resp.technicalIndicators ? {
            emaFast: resp.technicalIndicators.emaFast,
            emaSlow: resp.technicalIndicators.emaSlow,
            emaTrend: resp.technicalIndicators.emaTrend,
            rsiValue: resp.technicalIndicators.rsiValue,
            rsiSignal: resp.technicalIndicators.rsiSignal,
            macdHist: resp.technicalIndicators.macdHist,
            macdBias: resp.technicalIndicators.macdBias,
            vwap: resp.technicalIndicators.vwap,
            vwapBias: resp.technicalIndicators.vwapBias,
            adxProxy: resp.technicalIndicators.adxProxy,
            trendStrength: resp.technicalIndicators.trendStrength,
          } : null,
          srLevels: sig.srLevels ? {
            pdh: sig.srLevels.pdh, pdl: sig.srLevels.pdl,
            pivot: sig.srLevels.pivot, r1: sig.srLevels.r1,
            r2: sig.srLevels.r2, s1: sig.srLevels.s1, s2: sig.srLevels.s2,
          } : null,
          volatility: sig.volatility ? {
            atr: sig.volatility.atr, ratio: sig.volatility.ratio,
            regime: sig.volatility.regime,
          } : null,
          advancedFilters: sig.advancedFilters ? {
            rfConfirmsBull: sig.advancedFilters.rfConfirmsBull,
            rfConfirmsBear: sig.advancedFilters.rfConfirmsBear,
            rqkConfirmsBull: sig.advancedFilters.rqkConfirmsBull,
            rqkConfirmsBear: sig.advancedFilters.rqkConfirmsBear,
            choppiness: sig.advancedFilters.choppiness,
            isChoppy: sig.advancedFilters.isChoppy,
          } : null,
          optionsAdvisor: sig.optionsAdvisor ? {
            strike: sig.optionsAdvisor.strike, side: sig.optionsAdvisor.side,
            premium: sig.optionsAdvisor.premium, delta: sig.optionsAdvisor.delta,
            iv: sig.optionsAdvisor.iv, moneyness: sig.optionsAdvisor.moneyness,
          } : null,
          targets: sig.targets ? {
            entry: sig.targets.entry, stopLoss: sig.targets.stopLoss,
            t1: sig.targets.t1, t2: sig.targets.t2, t3: sig.targets.t3,
          } : null,
          sentiment: sig.sentiment ? {
            score: sig.sentiment.score, side: sig.sentiment.side,
            momentum: sig.sentiment.momentum,
          } : null,
        }),
      });
      const json = await res.json();
      if (json.analysis) setAiAnalysis(json.analysis);
    } catch {}
    finally { setAiLoading(false); }
  }, [aiEnabled]);

  const sendNotification = useCallback(async (resp: SignalsResponse) => {
    if (!notifyEnabled) return;
    const sig = resp.signal;
    const biasKey = `${resp.symbol}_${sig.bias}`;
    if (biasKey === lastBiasRef.current) return;
    if (sig.bias === "NEUTRAL" && !lastBiasRef.current) { lastBiasRef.current = biasKey; return; }
    lastBiasRef.current = biasKey;

    fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        segment: resp.symbol,
        bias: sig.bias,
        confidence: sig.confidence,
        strike: sig.optionsAdvisor?.strike,
        side: sig.optionsAdvisor?.side,
        premium: sig.optionsAdvisor?.premium,
        entry: sig.targets?.entry,
        stopLoss: sig.targets?.stopLoss,
        t1: sig.targets?.t1,
        t2: sig.targets?.t2,
        t3: sig.targets?.t3,
        ltp: resp.underlyingValue,
        pcr: sig.pcr.value,
        summary: sig.summary,
      }),
    }).catch(() => {});
  }, [notifyEnabled]);

  useEffect(() => {
    const check = () => setMarketOpen(isMarketOpen());
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);

  const fetchSignals = useCallback(async () => {
    if (!isMarketOpen()) {
      setMarketOpen(false);
      setLoading(false);
      return;
    }
    setMarketOpen(true);
    try {
      setError(null);
      const res = await fetch(`/api/signals?symbol=${segment}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.details || err.error || `HTTP ${res.status}`);
      }
      const resp: SignalsResponse = await res.json();
      setData(resp);
      sendNotification(resp);
      fetchAiAnalysis(resp);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [segment, sendNotification, fetchAiAnalysis]);

  useEffect(() => {
    if (!marketOpen) {
      setLoading(false);
      return;
    }
    fetchSignals();
    const interval = setInterval(fetchSignals, 30000);
    return () => clearInterval(interval);
  }, [fetchSignals, marketOpen]);

  const sig = data?.signal;
  const isIndex = data?.source === "angel_one" && data?.marketData?.tradeVolume === 0;
  const changePercent = data?.marketData ? (((data.underlyingValue - data.marketData.prevClose) / data.marketData.prevClose) * 100) : null;

  return (
    <>
      {/* Header */}
      <AppHeader onMobileMenuOpen={() => setMobileOpen(!mobileOpen)}>
        <SegmentSelector
          segments={SEGMENTS.map((s) => ({ id: s.id, label: s.label }))}
          active={segment}
          onChange={(id) => setSegment(id as SegmentId)}
        />
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          {aiEnabled && (
            <Badge variant="secondary" className="gap-1 hidden sm:inline-flex text-purple-400 border-purple-500/20">
              <Brain className="size-3" />
              AI
            </Badge>
          )}
          {notifyEnabled !== null && (
            <Badge variant={notifyEnabled ? "default" : "secondary"} className="gap-1 hidden sm:inline-flex" title={notifyEnabled ? "Telegram alerts active" : "Telegram not configured"}>
              {notifyEnabled ? <Bell className="size-3" /> : <BellOff className="size-3" />}
              {notifyEnabled ? "Alerts On" : "No Alerts"}
            </Badge>
          )}
          {data?.source && (
            <Badge variant="secondary" className="gap-1.5 hidden sm:inline-flex">
              {data.source === "angel_one" ? <Wifi className="size-3 text-emerald-400" /> : <WifiOff className="size-3" />}
              {data.source === "angel_one" ? "Angel One" : data.source === "nse" ? "NSE" : "Demo"}
            </Badge>
          )}
          {data && (
            <span className="text-xs text-zinc-500 hidden sm:block">
              <Clock className="size-3 inline mr-1" />
              {new Date(data.timestamp).toLocaleTimeString()}
            </span>
          )}
          <Button variant="ghost" size="icon" onClick={() => { setLoading(true); fetchSignals(); }} title="Refresh" disabled={!marketOpen}>
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </AppHeader>

      <main className="p-4 lg:p-6 space-y-5">
        {/* Error */}
        {error && !data && (
          <Card className="border-red-500/20 bg-red-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="size-2 rounded-full bg-red-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-red-300 font-medium">{error}</p>
                <p className="text-xs text-zinc-500 mt-0.5">Login at /login during market hours (9:15 AM - 3:30 PM IST)</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchSignals(); }}>Retry</Button>
            </CardContent>
          </Card>
        )}

        {/* Market Closed */}
        {!marketOpen && (
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="size-5 text-amber-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-amber-300 font-medium">Market Closed</p>
                <p className="text-xs text-zinc-500 mt-0.5">{getMarketStatusMessage()}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPI Strip */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          <StatCard
            label="LTP"
            value={data ? `₹${data.underlyingValue.toFixed(2)}` : loading ? "..." : "—"}
            subValue={changePercent != null ? `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%` : undefined}
            trend={changePercent != null ? (changePercent >= 0 ? "up" : "down") : undefined}
            icon={Activity}
          />
          <StatCard
            label="PCR"
            value={data ? (data.rawPCR ?? data.signal.pcr.value).toFixed(2) : loading ? "..." : "—"}
            subValue={data?.pcrSymbol || data?.signal.pcr.bias}
            icon={BarChart3}
          />
          <StatCard
            label="Max Pain"
            value={data ? String(data.signal.maxPain) : loading ? "..." : "—"}
            icon={Target}
          />
          <StatCard
            label="Confidence"
            value={sig ? `${
              aiAnalysis
                ? Math.round(sig.confidence * 0.6 + aiAnalysis.aiConfidence * 0.4)
                : sig.confidence
            }%` : "—"}
            subValue={aiAnalysis ? `AI: ${aiAnalysis.aiConfidence}%` : sig?.signalStrength?.label}
            trend={(() => {
              const c = aiAnalysis ? Math.round(sig!.confidence * 0.6 + aiAnalysis.aiConfidence * 0.4) : sig?.confidence;
              return c && c >= 60 ? "up" as const : c && c < 40 ? "down" as const : "neutral" as const;
            })()}
            icon={Gauge}
          />
          <div className="col-span-2 lg:col-span-1 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 backdrop-blur-sm flex flex-col justify-between">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Signal</p>
            <div className="mt-2 flex items-center gap-2">
              {sig ? <StatusBadge bias={sig.bias} size="md" /> : <span className="text-zinc-500">—</span>}
            </div>
            {sig?.tradeDirection && (
              <p className="text-xs text-zinc-500 mt-1">
                {sig.tradeDirection.includes("Long") ? "Buy CE" : sig.tradeDirection.includes("Short") ? "Buy PE" : "Wait"}
              </p>
            )}
          </div>
        </div>

        {/* Hero Signal + Options Advisor row */}
        {sig && (
          <div className="grid gap-4 lg:grid-cols-5">
            {/* Signal Card — hero */}
            <Card className="lg:col-span-3 glow-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">Signal Overview</CardTitle>
                    {data?.expiry && (
                      <Badge variant="outline" className="text-xs">{data.expiry}</Badge>
                    )}
                  </div>
                  <StatusBadge bias={sig.bias} size="lg" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-300 leading-relaxed">{data ? data.signal.summary : "Loading..."}</p>

                {sig.bias !== "NEUTRAL" && sig.optionsAdvisor && (
                  <div className="mt-4 rounded-lg bg-zinc-800/50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Recommended Trade</span>
                      <Badge variant={sig.optionsAdvisor.side === "CALL" ? "default" : sig.optionsAdvisor.side === "PUT" ? "destructive" : "secondary"}>
                        {sig.optionsAdvisor.side}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <p className="text-xs text-zinc-500">Strike</p>
                        <p className="text-xl font-bold text-zinc-100">{sig.optionsAdvisor.strike}</p>
                        <p className="text-xs text-zinc-500">{sig.optionsAdvisor.moneyness}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">Premium {data?.optionSymbol ? "(Live)" : "(est.)"}</p>
                        <p className="text-xl font-bold text-zinc-100">₹{sig.optionsAdvisor.premium}</p>
                        <p className="text-xs text-zinc-500">Delta: {sig.optionsAdvisor.delta.toFixed(3)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">IV / Theta</p>
                        <p className="text-xl font-bold text-zinc-100">{sig.optionsAdvisor.iv}%</p>
                        <p className="text-xs text-zinc-500">Theta: {sig.optionsAdvisor.theta}/day</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">Expiry</p>
                        <p className="text-xl font-bold text-zinc-100">{data?.expiry || `${sig.optionsAdvisor.daysToExpiry}d`}</p>
                        <p className={`text-xs ${sig.optionsAdvisor.daysToExpiry >= 3 ? "text-emerald-400" : sig.optionsAdvisor.daysToExpiry >= 1 ? "text-amber-400" : "text-red-400"}`}>
                          {sig.optionsAdvisor.daysToExpiry} days left
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Premium Targets */}
                {sig.optionsAdvisor?.optionTargets && sig.bias !== "NEUTRAL" && (
                  <div className="mt-3 grid grid-cols-6 gap-2">
                    {[
                      { label: "Entry", value: sig.optionsAdvisor.optionTargets.premiumEntry, color: "text-zinc-100" },
                      { label: "SL", value: sig.optionsAdvisor.optionTargets.premiumSL, color: "text-red-400" },
                      { label: "T1", value: sig.optionsAdvisor.optionTargets.premiumT1, color: "text-emerald-400" },
                      { label: "T2", value: sig.optionsAdvisor.optionTargets.premiumT2, color: "text-emerald-400" },
                      { label: "T3", value: sig.optionsAdvisor.optionTargets.premiumT3, color: "text-emerald-400" },
                      { label: "Trail", value: sig.optionsAdvisor.optionTargets.premiumTrailSL, color: "text-amber-400" },
                    ].map((t) => (
                      <div key={t.label} className="text-center rounded-lg bg-zinc-800/30 py-2">
                        <p className="text-[10px] text-zinc-500 uppercase">{t.label}</p>
                        <p className={`text-sm font-bold ${t.color}`}>₹{t.value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {sig.bias !== "NEUTRAL" && marketOpen && (
                  <div className="mt-4">
                    <Button asChild className="w-full sm:w-auto">
                      <Link href="/paper-trade">
                        Take Paper Trade
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right column: Signal Strength + Volatility */}
            <div className="lg:col-span-2 space-y-4">
              {/* Signal Strength */}
              {sig.signalStrength && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Zap className="size-4 text-emerald-400" /> Signal Strength
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end gap-3 mb-3">
                      <span className={`text-3xl font-bold tabular-nums ${
                        sig.signalStrength.score >= 6 ? "text-emerald-400" :
                        sig.signalStrength.score >= 4 ? "text-amber-400" : "text-red-400"
                      }`}>
                        {sig.signalStrength.score}
                      </span>
                      <span className="text-zinc-500 text-sm mb-1">/ {sig.signalStrength.max}</span>
                      <Badge variant={sig.signalStrength.label === "STRONG" ? "default" : sig.signalStrength.label === "MODERATE" ? "warning" : "destructive"} className="mb-1">
                        {sig.signalStrength.label}
                      </Badge>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-2 mb-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          sig.signalStrength.score >= 6 ? "bg-emerald-500" :
                          sig.signalStrength.score >= 4 ? "bg-amber-500" : "bg-red-500"
                        }`}
                        style={{ width: `${(sig.signalStrength.score / sig.signalStrength.max) * 100}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {sig.signalStrength.components.map((c) => (
                        <div key={c.name} className="flex items-center gap-1.5 text-xs">
                          <div className={`size-1.5 rounded-full ${c.ok ? "bg-emerald-400" : "bg-zinc-600"}`} />
                          <span className={c.ok ? "text-zinc-300" : "text-zinc-600"}>{c.name}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Volatility */}
              {sig.volatility && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Gauge className="size-4 text-amber-400" /> Volatility
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant={sig.volatility.regime === "HIGH" ? "destructive" : sig.volatility.regime === "LOW" ? "secondary" : "warning"}>
                        {sig.volatility.regime}
                      </Badge>
                      <span className="text-xs text-zinc-500">ATR ratio: {sig.volatility.ratio}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "ATR (5d)", value: sig.volatility.atr.toFixed(1) },
                        { label: "ATR SMA", value: sig.volatility.atrSma.toFixed(1) },
                        { label: "Stop ×", value: `${sig.volatility.dynamicStopMult.toFixed(2)}x` },
                        { label: "Target ×", value: `${sig.volatility.dynamicTargetMult.toFixed(2)}x` },
                      ].map((v) => (
                        <div key={v.label} className="rounded-lg bg-zinc-800/50 px-3 py-2">
                          <p className="text-[10px] text-zinc-500 uppercase">{v.label}</p>
                          <p className="text-sm font-semibold text-zinc-200">{v.value}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* AI Advisor */}
        {aiEnabled && sig && sig.bias !== "NEUTRAL" && (
          <Card className="border-purple-500/20 bg-purple-500/[0.03]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Brain className="size-4 text-purple-400" />
                  AI Trade Advisor
                </CardTitle>
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  <Sparkles className="size-2.5" />
                  Powered by AI
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {aiLoading && !aiAnalysis ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-8 w-24 bg-zinc-800 rounded-lg" />
                  <div className="h-4 w-full bg-zinc-800 rounded" />
                  <div className="h-4 w-3/4 bg-zinc-800 rounded" />
                </div>
              ) : aiAnalysis ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-end gap-1.5">
                      <span className={`text-4xl font-bold tabular-nums ${
                        aiAnalysis.aiScore >= 8 ? "text-emerald-400" :
                        aiAnalysis.aiScore >= 5 ? "text-amber-400" : "text-red-400"
                      }`}>
                        {aiAnalysis.aiScore}
                      </span>
                      <span className="text-zinc-500 text-sm mb-1.5">/ 10</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={
                          aiAnalysis.riskLevel === "LOW" ? "default" :
                          aiAnalysis.riskLevel === "MEDIUM" ? "warning" : "destructive"
                        }>
                          {aiAnalysis.riskLevel} Risk
                        </Badge>
                        <span className="text-xs text-zinc-500">
                          AI Confidence: {aiAnalysis.aiConfidence}%
                        </span>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            aiAnalysis.aiScore >= 8 ? "bg-emerald-500" :
                            aiAnalysis.aiScore >= 5 ? "bg-amber-500" : "bg-red-500"
                          }`}
                          style={{ width: `${aiAnalysis.aiScore * 10}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-zinc-300 leading-relaxed">{aiAnalysis.reasoning}</p>

                  {aiAnalysis.keyFactors.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {aiAnalysis.keyFactors.map((f, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {f}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {aiAnalysis.caution && (
                    <div className="flex items-start gap-2 rounded-lg bg-amber-500/5 border border-amber-500/20 p-3">
                      <AlertTriangle className="size-4 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-300/90">{aiAnalysis.caution}</p>
                    </div>
                  )}

                  {(aiAnalysis.adjustedSL || aiAnalysis.adjustedT1) && (
                    <div className="flex gap-3 text-xs">
                      {aiAnalysis.adjustedSL && (
                        <span className="text-zinc-400">
                          AI suggests SL: <span className="text-red-400 font-medium">₹{aiAnalysis.adjustedSL}</span>
                        </span>
                      )}
                      {aiAnalysis.adjustedT1 && (
                        <span className="text-zinc-400">
                          AI suggests T1: <span className="text-emerald-400 font-medium">₹{aiAnalysis.adjustedT1}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-zinc-500 py-2">AI analysis unavailable. Will retry on next signal refresh.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Market Analysis tabs */}
        <Card>
          <CardContent className="p-5">
            <Tabs defaultValue="technical">
              <TabsList>
                <TabsTrigger value="technical">Technical</TabsTrigger>
                <TabsTrigger value="filters">Adv. Filters</TabsTrigger>
                <TabsTrigger value="sr">S/R Levels</TabsTrigger>
                <TabsTrigger value="sentiment">Sentiment</TabsTrigger>
              </TabsList>

              {/* Technical Indicators */}
              <TabsContent value="technical">
                {data?.technicalIndicators ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {[
                      { label: "EMA 21/50", value: `${data.technicalIndicators.emaFast.toFixed(1)} / ${data.technicalIndicators.emaSlow.toFixed(1)}`, status: data.technicalIndicators.emaTrend },
                      { label: "RSI (14)", value: String(data.technicalIndicators.rsiValue), status: data.technicalIndicators.rsiSignal },
                      { label: "MACD Hist", value: data.technicalIndicators.macdHist.toFixed(2), status: data.technicalIndicators.macdBias },
                      { label: "VWAP", value: data.technicalIndicators.vwap.toFixed(2), status: data.technicalIndicators.vwapBias },
                      { label: "ADX Strength", value: data.technicalIndicators.adxProxy.toFixed(1), status: data.technicalIndicators.trendStrength === "STRONG" ? "BULL" : data.technicalIndicators.trendStrength === "WEAK" ? "BEAR" : "NEUTRAL" },
                    ].map((ind) => (
                      <div key={ind.label} className="rounded-lg bg-zinc-800/40 p-3">
                        <p className="text-[10px] text-zinc-400 uppercase tracking-wider">{ind.label}</p>
                        <p className="text-lg font-bold mt-1 tabular-nums">{ind.value}</p>
                        <Badge variant={ind.status === "BULL" ? "default" : ind.status === "BEAR" ? "destructive" : "secondary"} className="mt-1">
                          {ind.status === "BULL" ? <TrendingUp className="size-3 mr-1" /> : ind.status === "BEAR" ? <TrendingDown className="size-3 mr-1" /> : null}
                          {ind.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-300 py-4">Technical indicators not available. Login during market hours.</p>
                )}
              </TabsContent>

              {/* Advanced Filters */}
              <TabsContent value="filters">
                {sig?.advancedFilters ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: "Range Filter", bull: sig.advancedFilters.rfConfirmsBull, bear: sig.advancedFilters.rfConfirmsBear, sub: `Filt: ${sig.advancedFilters.rangeFilter.filt.toFixed(1)}` },
                        { label: "RQK (Kernel)", bull: sig.advancedFilters.rqkConfirmsBull, bear: sig.advancedFilters.rqkConfirmsBear, sub: `Val: ${sig.advancedFilters.rqk.value.toFixed(1)}` },
                        { label: "Choppiness", bull: !sig.advancedFilters.isChoppy, bear: false, sub: sig.advancedFilters.isChoppy ? "Ranging" : "Trending" },
                      ].map((f) => (
                        <div key={f.label} className="rounded-lg bg-zinc-800/40 p-3">
                          <p className="text-[10px] text-zinc-400 uppercase tracking-wider">{f.label}</p>
                          <p className={`text-sm font-bold mt-1 ${f.bull ? "text-emerald-400" : f.bear ? "text-red-400" : "text-amber-400"}`}>
                            {f.bull ? "Bullish" : f.bear ? "Bearish" : "Neutral"}
                          </p>
                          <p className="text-xs text-zinc-400 mt-0.5">{f.sub}</p>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                        <span>Trending</span><span>61.8</span><span>Choppy</span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${sig.advancedFilters.choppiness > 61.8 ? "bg-amber-500/70" : "bg-emerald-500/70"}`}
                          style={{ width: `${Math.min(100, sig.advancedFilters.choppiness)}%` }}
                        />
                      </div>
                      <p className="text-xs text-zinc-300 mt-1 text-center">CI: {sig.advancedFilters.choppiness}</p>
                    </div>
                    {sig.signalExpired && <Badge variant="warning">Signal expired — not confirmed in 5 cycles</Badge>}
                    {sig.alternateBlocked && <Badge variant="warning">{sig.alternateReason}</Badge>}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-300 py-4">Advanced filters not available.</p>
                )}
              </TabsContent>

              {/* S/R Levels */}
              <TabsContent value="sr">
                {sig?.srLevels ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {[
                      { label: "R2", value: sig.srLevels.r2, variant: "emerald" as const },
                      { label: "R1", value: sig.srLevels.r1, variant: "emerald" as const },
                      { label: "Pivot", value: sig.srLevels.pivot, variant: "zinc" as const },
                      { label: "S1", value: sig.srLevels.s1, variant: "red" as const },
                      { label: "S2", value: sig.srLevels.s2, variant: "red" as const },
                      { label: "PDH", value: sig.srLevels.pdh, variant: "zinc" as const },
                      { label: "PDL", value: sig.srLevels.pdl, variant: "zinc" as const },
                      { label: "PDC", value: sig.srLevels.pdc, variant: "zinc" as const },
                      { label: "CPR TC", value: sig.srLevels.cprTC, variant: "zinc" as const },
                      { label: "CPR BC", value: sig.srLevels.cprBC, variant: "zinc" as const },
                      { label: "Cam H3", value: sig.srLevels.camH3, variant: "emerald" as const },
                      { label: "Cam L3", value: sig.srLevels.camL3, variant: "red" as const },
                    ].map((l) => (
                      <div key={l.label} className="rounded-lg bg-zinc-800/40 px-3 py-2 flex justify-between items-center">
                        <span className="text-xs text-zinc-400">{l.label}</span>
                        <span className={`font-semibold text-sm tabular-nums ${
                          l.variant === "emerald" ? "text-emerald-400" :
                          l.variant === "red" ? "text-red-400" : "text-zinc-200"
                        }`}>{l.value.toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-300 py-4">S/R levels not available.</p>
                )}
              </TabsContent>

              {/* Sentiment */}
              <TabsContent value="sentiment">
                {sig?.sentiment ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <span className={`text-3xl font-bold tabular-nums ${
                        sig.sentiment.score >= 20 ? "text-emerald-400" :
                        sig.sentiment.score <= -20 ? "text-red-400" : "text-zinc-400"
                      }`}>
                        {sig.sentiment.score > 0 ? "+" : ""}{sig.sentiment.score}
                      </span>
                      <div>
                        <Badge variant={sig.sentiment.side.includes("BUY") ? "default" : sig.sentiment.side.includes("SELL") ? "destructive" : "secondary"}>
                          {sig.sentiment.side}
                        </Badge>
                        <p className="text-xs text-zinc-400 mt-1">{sig.sentiment.optionsBias} · Momentum: {sig.sentiment.momentum}</p>
                      </div>
                    </div>
                    {sig.sentiment.components?.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {sig.sentiment.components.map((c) => (
                          <div key={c.name} className="flex items-center justify-between rounded-lg bg-zinc-800/40 px-3 py-2">
                            <span className="text-xs text-zinc-400">{c.name}</span>
                            <span className={`text-xs font-semibold ${c.score > 0 ? "text-emerald-400" : c.score < 0 ? "text-red-400" : "text-zinc-400"}`}>
                              {c.score > 0 ? "+" : ""}{c.score}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-300 py-4">Sentiment data not available.</p>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Targets & Stops */}
        {sig && sig.bias !== "NEUTRAL" && sig.targets && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="size-4 text-emerald-400" />
                Targets & Stops
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { label: "Entry", value: sig.targets.entry, color: "text-zinc-100" },
                  { label: "Stop Loss", value: sig.targets.stopLoss, color: "text-red-400" },
                  { label: "Trail SL", value: sig.targets.trailingStop, color: "text-amber-400" },
                  { label: `T1 (${sig.targets.rr1}R)`, value: sig.targets.t1, color: "text-emerald-400" },
                  { label: `T2 (${sig.targets.rr2}R)`, value: sig.targets.t2, color: "text-emerald-400" },
                  { label: `T3 (${sig.targets.rr3}R)`, value: sig.targets.t3, color: "text-emerald-400" },
                ].map((t) => (
                  <div key={t.label} className="rounded-lg bg-zinc-800/40 px-3 py-2 text-center">
                    <p className="text-[10px] text-zinc-500 uppercase">{t.label}</p>
                    <p className={`text-lg font-bold tabular-nums ${t.color}`}>{t.value.toFixed(0)}</p>
                  </div>
                ))}
              </div>
              {sig.partialExits && (
                <div className="mt-3 flex items-center justify-center gap-6 text-sm">
                  {[
                    { label: `T1: ${sig.partialExits.t1Pct}%`, lots: sig.partialExits.t1Lots },
                    { label: `T2: ${sig.partialExits.t2Pct}%`, lots: sig.partialExits.t2Lots },
                    { label: `T3: ${sig.partialExits.t3Pct}%`, lots: sig.partialExits.t3Lots },
                  ].map((p) => (
                    <span key={p.label} className="text-zinc-400">
                      <span className="text-emerald-400 font-medium">{p.label}</span>
                      <span className="text-zinc-600 ml-1">({p.lots}L)</span>
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Neutral targets */}
        {sig && sig.bias === "NEUTRAL" && (sig.bullishTargets || sig.bearishTargets) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="size-4 text-amber-400" />
                Both-Side Scenarios (Neutral)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {sig.bullishTargets && (
                <div>
                  <p className="text-xs font-semibold text-emerald-400 uppercase mb-2">If Bullish (Buy CE)</p>
                  <div className="grid gap-2 grid-cols-3 sm:grid-cols-6">
                    {[
                      { label: "Entry", value: sig.bullishTargets.entry, color: "" },
                      { label: "SL", value: sig.bullishTargets.stopLoss, color: "text-red-400" },
                      { label: "T1", value: sig.bullishTargets.t1, color: "text-emerald-400" },
                      { label: "T2", value: sig.bullishTargets.t2, color: "text-emerald-400" },
                      { label: "T3", value: sig.bullishTargets.t3, color: "text-emerald-400" },
                      { label: "Trail", value: sig.bullishTargets.trailingStop, color: "text-amber-400" },
                    ].map((t) => (
                      <div key={t.label} className="rounded-lg bg-zinc-800/40 px-2 py-1.5 text-center">
                        <p className="text-[10px] text-zinc-500">{t.label}</p>
                        <p className={`text-sm font-bold tabular-nums ${t.color}`}>{t.value.toFixed(0)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {sig.bearishTargets && (
                <div>
                  <p className="text-xs font-semibold text-red-400 uppercase mb-2">If Bearish (Buy PE)</p>
                  <div className="grid gap-2 grid-cols-3 sm:grid-cols-6">
                    {[
                      { label: "Entry", value: sig.bearishTargets.entry, color: "" },
                      { label: "SL", value: sig.bearishTargets.stopLoss, color: "text-red-400" },
                      { label: "T1", value: sig.bearishTargets.t1, color: "text-emerald-400" },
                      { label: "T2", value: sig.bearishTargets.t2, color: "text-emerald-400" },
                      { label: "T3", value: sig.bearishTargets.t3, color: "text-emerald-400" },
                      { label: "Trail", value: sig.bearishTargets.trailingStop, color: "text-amber-400" },
                    ].map((t) => (
                      <div key={t.label} className="rounded-lg bg-zinc-800/40 px-2 py-1.5 text-center">
                        <p className="text-[10px] text-zinc-500">{t.label}</p>
                        <p className={`text-sm font-bold tabular-nums ${t.color}`}>{t.value.toFixed(0)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Market Data */}
        {data?.marketData && (
          <div className="grid gap-3 grid-cols-3 lg:grid-cols-6">
            <StatCard label="Open" value={data.marketData.todayOpen.toFixed(2)} />
            <StatCard label="High" value={data.marketData.todayHigh.toFixed(2)} />
            <StatCard label="Low" value={data.marketData.todayLow.toFixed(2)} />
            <StatCard label="Prev Close" value={data.marketData.prevClose.toFixed(2)} />
            <StatCard label="Volume" value={isIndex ? "N/A" : formatNum(data.marketData.tradeVolume)} />
            <StatCard label="Buy/Sell" value={isIndex ? "N/A" : `${formatNum(data.marketData.buyQty)} / ${formatNum(data.marketData.sellQty)}`} />
          </div>
        )}

        {/* OI Buildup */}
        {(data?.oiBuildupLong?.length || data?.oiBuildupShort?.length) ? (
          <Card>
            <CardHeader>
              <CardTitle>OI Buildup</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {data?.oiBuildupLong?.length ? (
                  <div>
                    <p className="text-xs font-semibold text-emerald-400 uppercase mb-2 flex items-center gap-1.5">
                      <TrendingUp className="size-3" /> Long Buildup
                    </p>
                    <div className="space-y-1.5">
                      {data.oiBuildupLong.map((r) => (
                        <div key={r.symbol} className="flex justify-between items-center text-sm rounded-lg bg-zinc-800/30 px-3 py-1.5">
                          <span className="text-zinc-400 truncate max-w-[180px]">{r.symbol}</span>
                          <span className="text-emerald-400 font-medium text-xs">
                            OI {r.oiChange > 0 ? "+" : ""}{r.oiChange.toLocaleString()} ({r.priceChange > 0 ? "+" : ""}{r.priceChange.toFixed(2)}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {data?.oiBuildupShort?.length ? (
                  <div>
                    <p className="text-xs font-semibold text-red-400 uppercase mb-2 flex items-center gap-1.5">
                      <TrendingDown className="size-3" /> Short Buildup
                    </p>
                    <div className="space-y-1.5">
                      {data.oiBuildupShort.map((r) => (
                        <div key={r.symbol} className="flex justify-between items-center text-sm rounded-lg bg-zinc-800/30 px-3 py-1.5">
                          <span className="text-zinc-400 truncate max-w-[180px]">{r.symbol}</span>
                          <span className="text-red-400 font-medium text-xs">
                            OI {r.oiChange > 0 ? "+" : ""}{r.oiChange.toLocaleString()} ({r.priceChange > 0 ? "+" : ""}{r.priceChange.toFixed(2)}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Option Chain */}
        {data?.oiTable && data.oiTable.length > 0 ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Option Chain</CardTitle>
                <Badge variant="outline" className="text-xs">
                  {data.source === "angel_one" ? "Angel One" : "NSE"} · {data.oiTable.length} strikes
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-80 overflow-y-auto rounded-lg border border-zinc-800">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-emerald-400/80">CE Vol</TableHead>
                      <TableHead className="text-emerald-400/80">CE IV</TableHead>
                      <TableHead className="text-emerald-400/80">CE Delta</TableHead>
                      <TableHead className="text-center font-bold text-zinc-300">Strike</TableHead>
                      <TableHead className="text-red-400/80">PE Delta</TableHead>
                      <TableHead className="text-red-400/80">PE IV</TableHead>
                      <TableHead className="text-red-400/80">PE Vol</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.oiTable.map((r) => {
                      const isATM = Math.abs(r.strike - data.underlyingValue) < (SEGMENTS.find(s => s.id === data.symbol)?.strikeStep ?? 50);
                      return (
                        <TableRow key={r.strike} className={isATM ? "bg-emerald-500/5 font-medium" : ""}>
                          <TableCell className="text-emerald-400/80 tabular-nums">{r.ceOI > 0 ? r.ceOI.toLocaleString() : "—"}</TableCell>
                          <TableCell className="text-zinc-400 tabular-nums">{r.ceIV ? `${r.ceIV}%` : "—"}</TableCell>
                          <TableCell className="text-zinc-400 tabular-nums">{r.ceDelta ? r.ceDelta.toFixed(3) : "—"}</TableCell>
                          <TableCell className={`text-center font-bold tabular-nums ${isATM ? "text-emerald-400" : "text-zinc-200"}`}>{r.strike}</TableCell>
                          <TableCell className="text-zinc-400 tabular-nums">{r.peDelta ? r.peDelta.toFixed(3) : "—"}</TableCell>
                          <TableCell className="text-zinc-400 tabular-nums">{r.peIV ? `${r.peIV}%` : "—"}</TableCell>
                          <TableCell className="text-red-400/80 tabular-nums">{r.peOI > 0 ? r.peOI.toLocaleString() : "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Max Pain */}
        {data?.maxPain?.length ? (
          <Card>
            <CardHeader>
              <CardTitle>Max Pain</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {data.maxPain.map((mp) => (
                  <Badge key={mp.strike} variant="secondary" className="text-sm py-1 px-3">
                    {mp.strike}
                    {mp.totalPayout > 0 && <span className="text-zinc-500 ml-1">(₹{(mp.totalPayout / 1e6).toFixed(1)}M)</span>}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Footer */}
        {data && (
          <p className="text-xs text-zinc-600 text-center pb-4">
            Last updated: {new Date(data.timestamp).toLocaleString()}
          </p>
        )}
      </main>
    </>
  );
}
