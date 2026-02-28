import type { SegmentId } from "@/lib/segments";

export type StrategyId =
  | "ema_macd_trend_acceleration"
  | "supertrend_adx_continuation"
  | "vwap_delta_reversion"
  | "gamma_expansion_breakout"
  | "pcr_oi_sentiment_reversal"
  | "rsi_divergence_stochastic_reversal"
  | "sar_vwap_opening_drive"
  | "stochastic_macd_range_crossover"
  | "fib_orderflow_continuation";

export type TradeDirection = "LONG" | "SHORT";
export type TradeOutcome = "WIN" | "LOSS" | "SCRATCH";
export type ExecutionProfile = "strict" | "balanced";
export type StrategyLabMode = "direct" | "async";
export type StrategyLabRunStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export interface LabCandle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LabSnapshot {
  time: string;
  pcr: number | null;
  buyQty: number | null;
  sellQty: number | null;
  tradeVolume: number | null;
  maxPain: number | null;
  ltp: number | null;
}

export interface LabOIBuildupPoint {
  time: string;
  longOiChange: number;
  shortOiChange: number;
}

export interface StrategyEngineConfig {
  executionIntervalMin: number;
  higherIntervalsMin: number[];
  atrPeriod: number;
  stopAtrMult: number;
  targetR: number;
  maxBarsInTrade: number;
  minBarsBetweenTrades: number;
  riskPerTradePct: number;
  dailyRiskCapPct: number;
  params: Record<string, number>;
}

export interface StrategyRuleSpec {
  id: StrategyId;
  name: string;
  qualityRating: "A+" | "A" | "B+";
  marketEnvironment: string;
  indicators: string[];
  multiTimeframeAlignment: string;
  longEntryRules: string[];
  shortEntryRules: string[];
  optionsSelection: string[];
  riskModel: string[];
  tradeManagement: string[];
  invalidationRules: string[];
  engine: StrategyEngineConfig;
}

export interface StrategySignalEvent {
  time: string;
  strategyId: StrategyId;
  direction: TradeDirection;
  confidence: number;
  reason: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
}

export interface SimulatedTrade {
  strategyId: StrategyId;
  segment: SegmentId;
  direction: TradeDirection;
  entryTime: string;
  exitTime: string;
  barsHeld: number;
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskPoints: number;
  pnlPoints: number;
  pnlR: number;
  outcome: TradeOutcome;
  reason: string;
}

export interface StrategyKpis {
  trades: number;
  wins: number;
  losses: number;
  scratches: number;
  winRate: number;
  netPoints: number;
  netR: number;
  avgR: number;
  expectancyR: number;
  profitFactor: number;
  maxDrawdownR: number;
  sharpeLike: number;
}

export interface StrategyActivityDiagnostics {
  barsEvaluated: number;
  signalCandidates: number;
  entriesTaken: number;
  blockedByDailyRisk: number;
  blockedBySpacing: number;
  blockedByRiskFilter: number;
  rejectionReasons: Record<string, number>;
}

export interface RollingWindowEvaluation {
  from: string;
  to: string;
  kpis: StrategyKpis;
  score: number;
}

export interface StrategyConsistencyMetrics {
  windows: number;
  positiveWindows: number;
  positiveWindowRate: number;
  medianNetR: number;
  netRStdDev: number;
  consistencyScore: number;
}

export interface StrategyEvaluation {
  strategyId: StrategyId;
  strategyName: string;
  segment: SegmentId;
  qualityRating: StrategyRuleSpec["qualityRating"];
  kpis: StrategyKpis;
  profile: ExecutionProfile;
  baseScore: number;
  consistencyScore: number;
  score: number;
  activity: StrategyActivityDiagnostics;
  rollingWindows: RollingWindowEvaluation[];
  consistency: StrategyConsistencyMetrics;
  trades: SimulatedTrade[];
}

export interface SegmentDataDiagnostics {
  candleRowsFetched: number;
  snapshotRowsFetched: number;
  oiRowsFetched: number;
  oiPointsMapped: number;
  oiPagesFetched: number;
}

export interface SegmentStrategySummary {
  segment: SegmentId;
  evaluations: StrategyEvaluation[];
  bestStrategy: StrategyEvaluation | null;
  diagnostics: SegmentDataDiagnostics;
}

export interface StrategyLabApiResponse {
  mode: StrategyLabMode;
  profile: ExecutionProfile;
  generatedAt: string;
  from: string;
  to: string;
  days: number;
  pageSize?: number;
  runId?: string;
  status?: StrategyLabRunStatus;
  segments: SegmentStrategySummary[];
  overallRanking: StrategyEvaluation[];
  warnings: string[];
}

export interface StrategyLabRunParams {
  segment: SegmentId[] | "ALL";
  strategyIds: StrategyId[];
  days: number;
  profile: ExecutionProfile;
  from: string;
  to: string;
}

export interface StrategyLabRunRecord {
  runId: string;
  status: StrategyLabRunStatus;
  params: StrategyLabRunParams;
  result: StrategyLabApiResponse | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
}
