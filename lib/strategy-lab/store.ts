import { getSupabaseAdmin } from "@/lib/supabase";
import type {
  StrategyLabApiResponse,
  StrategyLabRunParams,
  StrategyLabRunRecord,
  StrategyLabRunStatus,
} from "@/lib/strategy-lab/types";

function toJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (value == null) return {};
  return { value };
}

function normalizeIso(value?: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function asStatus(value: unknown): StrategyLabRunStatus {
  const upper = String(value ?? "").toUpperCase();
  if (upper === "RUNNING") return "RUNNING";
  if (upper === "COMPLETED") return "COMPLETED";
  if (upper === "FAILED") return "FAILED";
  return "PENDING";
}

function asRunRecord(row: Record<string, unknown>): StrategyLabRunRecord {
  return {
    runId: String(row.run_id ?? ""),
    status: asStatus(row.status),
    params: (row.params ?? {}) as StrategyLabRunParams,
    result: (row.result ?? null) as StrategyLabApiResponse | null,
    error: row.error ? String(row.error) : null,
    createdAt: String(row.created_at ?? ""),
    startedAt: row.started_at ? String(row.started_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
  };
}

export function isStrategyLabStoreEnabled(): boolean {
  return !!getSupabaseAdmin();
}

export async function createStrategyLabRun(params: StrategyLabRunParams): Promise<StrategyLabRunRecord> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    throw new Error("Supabase is not configured for strategy lab run storage.");
  }
  const runId = crypto.randomUUID();
  const now = new Date().toISOString();
  const row = {
    run_id: runId,
    status: "PENDING",
    params: toJsonObject(params),
    result: null,
    error: null,
    created_at: now,
    started_at: null,
    completed_at: null,
  };
  const { error } = await sb.from("strategy_lab_runs").upsert(row, { onConflict: "run_id" });
  if (error) {
    throw new Error(`Failed to create strategy lab run: ${error.message}`);
  }
  return {
    runId,
    status: "PENDING",
    params,
    result: null,
    error: null,
    createdAt: now,
    startedAt: null,
    completedAt: null,
  };
}

export async function getStrategyLabRun(runId: string): Promise<StrategyLabRunRecord | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const { data, error } = await sb
    .from("strategy_lab_runs")
    .select("*")
    .eq("run_id", runId)
    .limit(1);
  if (error) {
    throw new Error(`Failed to fetch strategy lab run: ${error.message}`);
  }
  const row = (data?.[0] ?? null) as Record<string, unknown> | null;
  if (!row) return null;
  return asRunRecord(row);
}

export async function markStrategyLabRunRunning(runId: string): Promise<StrategyLabRunRecord | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  const now = new Date().toISOString();
  const { data, error } = await sb
    .from("strategy_lab_runs")
    .update({
      status: "RUNNING",
      started_at: now,
      error: null,
    })
    .eq("run_id", runId)
    .eq("status", "PENDING")
    .select("*")
    .limit(1);
  if (error) {
    throw new Error(`Failed to mark strategy lab run as RUNNING: ${error.message}`);
  }
  const row = (data?.[0] ?? null) as Record<string, unknown> | null;
  if (!row) return null;
  return asRunRecord(row);
}

export async function markStrategyLabRunCompleted(
  runId: string,
  result: StrategyLabApiResponse
): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const now = new Date().toISOString();
  const { error } = await sb
    .from("strategy_lab_runs")
    .update({
      status: "COMPLETED",
      result: toJsonObject(result),
      error: null,
      completed_at: now,
    })
    .eq("run_id", runId);
  if (error) {
    throw new Error(`Failed to mark strategy lab run as COMPLETED: ${error.message}`);
  }
}

export async function markStrategyLabRunFailed(runId: string, reason: string): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const now = new Date().toISOString();
  const { error } = await sb
    .from("strategy_lab_runs")
    .update({
      status: "FAILED",
      error: reason,
      completed_at: now,
    })
    .eq("run_id", runId);
  if (error) {
    throw new Error(`Failed to mark strategy lab run as FAILED: ${error.message}`);
  }
}

export async function replaceStrategyLabRunSummaries(
  runId: string,
  result: StrategyLabApiResponse
): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const { error: deleteSegmentsError } = await sb
    .from("strategy_lab_run_segments")
    .delete()
    .eq("run_id", runId);
  if (deleteSegmentsError) {
    throw new Error(`Failed to clear strategy_lab_run_segments: ${deleteSegmentsError.message}`);
  }

  const { error: deleteWindowsError } = await sb
    .from("strategy_lab_run_windows")
    .delete()
    .eq("run_id", runId);
  if (deleteWindowsError) {
    throw new Error(`Failed to clear strategy_lab_run_windows: ${deleteWindowsError.message}`);
  }

  const segmentRows = result.segments.flatMap((segmentSummary) =>
    segmentSummary.evaluations.map((evaluation) => ({
      run_id: runId,
      segment: segmentSummary.segment,
      strategy_id: evaluation.strategyId,
      final_score: evaluation.score,
      base_score: evaluation.baseScore,
      consistency_score: evaluation.consistencyScore,
      trades: evaluation.kpis.trades,
      win_rate: evaluation.kpis.winRate,
      net_r: evaluation.kpis.netR,
      consistency: toJsonObject(evaluation.consistency),
      activity: toJsonObject(evaluation.activity),
      created_at: new Date().toISOString(),
    }))
  );

  if (segmentRows.length > 0) {
    const { error } = await sb.from("strategy_lab_run_segments").upsert(segmentRows, {
      onConflict: "run_id,segment,strategy_id",
    });
    if (error) {
      throw new Error(`Failed to upsert strategy_lab_run_segments: ${error.message}`);
    }
  }

  const windowRows = result.segments.flatMap((segmentSummary) =>
    segmentSummary.evaluations.flatMap((evaluation) =>
      evaluation.rollingWindows.map((window) => ({
        run_id: runId,
        segment: segmentSummary.segment,
        strategy_id: evaluation.strategyId,
        window_from: normalizeIso(window.from),
        window_to: normalizeIso(window.to),
        score: window.score,
        trades: window.kpis.trades,
        net_r: window.kpis.netR,
        win_rate: window.kpis.winRate,
        created_at: new Date().toISOString(),
      }))
    )
  );

  if (windowRows.length > 0) {
    const { error } = await sb.from("strategy_lab_run_windows").upsert(windowRows, {
      onConflict: "run_id,segment,strategy_id,window_from,window_to",
    });
    if (error) {
      throw new Error(`Failed to upsert strategy_lab_run_windows: ${error.message}`);
    }
  }
}
