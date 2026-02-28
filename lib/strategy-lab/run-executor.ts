import { SEGMENTS } from "@/lib/segments";
import { evaluateStrategyLab } from "@/lib/strategy-lab/service";
import {
  getStrategyLabRun,
  markStrategyLabRunCompleted,
  markStrategyLabRunFailed,
  markStrategyLabRunRunning,
  replaceStrategyLabRunSummaries,
} from "@/lib/strategy-lab/store";
import type { StrategyLabRunRecord } from "@/lib/strategy-lab/types";

function resolveSegments(run: StrategyLabRunRecord) {
  if (run.params.segment === "ALL") {
    return SEGMENTS.map((segment) => segment.id);
  }
  return run.params.segment;
}

export async function executeStrategyLabRun(runId: string): Promise<StrategyLabRunRecord | null> {
  const existing = await getStrategyLabRun(runId);
  if (!existing) return null;
  if (existing.status === "COMPLETED" || existing.status === "FAILED") return existing;

  if (existing.status === "PENDING") {
    await markStrategyLabRunRunning(runId);
  }

  const running = await getStrategyLabRun(runId);
  if (!running) return null;
  if (running.status === "COMPLETED" || running.status === "FAILED") return running;

  try {
    const result = await evaluateStrategyLab({
      days: running.params.days,
      segments: resolveSegments(running),
      strategyIds: running.params.strategyIds,
      profile: running.params.profile,
      fromIso: running.params.from,
      toIso: running.params.to,
    });
    result.mode = "async";
    result.runId = runId;
    result.status = "COMPLETED";
    await replaceStrategyLabRunSummaries(runId, result);
    await markStrategyLabRunCompleted(runId, result);
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Unexpected failure during strategy lab run";
    await markStrategyLabRunFailed(runId, reason);
  }

  return getStrategyLabRun(runId);
}
