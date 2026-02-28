import { NextRequest, NextResponse } from "next/server";
import { SEGMENTS, type SegmentId } from "@/lib/segments";
import type {
  RobustnessRunRequest,
  RobustnessRunResponse,
} from "@/lib/quant-lab/types";
import { runRobustnessSuite } from "@/lib/quant-lab/robustness-engine";
import {
  persistRobustnessReport,
  recordQuantExecutionEvent,
} from "@/lib/quant-lab/store";

function resolveSegment(value: string | undefined): SegmentId {
  const normalized = (value ?? "NIFTY").toUpperCase();
  const match = SEGMENTS.find((segment) => segment.id === normalized);
  return (match?.id ?? "NIFTY") as SegmentId;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as RobustnessRunRequest;
  const segment = resolveSegment(body.segment);
  const runId = `rob_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const checksQueued: RobustnessRunResponse["checksQueued"] = [
    "walk_forward",
    "monte_carlo",
    "slippage_stress",
    "brokerage_stress",
    "regime_stability",
  ];

  try {
    const { config, result } = await runRobustnessSuite({
      ...body,
      segment,
      mode: "paper",
    });

    if (body.persist ?? true) {
      await persistRobustnessReport({
        runId,
        segment,
        status: "COMPLETED",
        config,
        result,
      });
      await recordQuantExecutionEvent({
        segment,
        mode: "paper",
        status: "ROBUSTNESS_COMPLETED",
        requestPayload: body,
        responsePayload: {
          runId,
          grade: result.grade,
          score: result.scoreBreakdown.total,
        },
      });
    }

    const response: RobustnessRunResponse = {
      phase: "engine_v1",
      status: "completed",
      runId,
      segment,
      checksQueued,
      message: "Robustness suite completed.",
      config,
      result,
    };
    return NextResponse.json(response);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Robustness suite failed.";

    if (body.persist ?? true) {
      await persistRobustnessReport({
        runId,
        segment,
        status: "FAILED",
        config: null,
        result: null,
        error: message,
      });
      await recordQuantExecutionEvent({
        segment,
        mode: "paper",
        status: "ROBUSTNESS_FAILED",
        requestPayload: body,
        responsePayload: { runId, error: message },
      });
    }

    const response: RobustnessRunResponse = {
      phase: "engine_v1",
      status: "failed",
      runId,
      segment,
      checksQueued,
      message: "Robustness suite failed.",
      error: message,
    };
    return NextResponse.json(response, { status: 500 });
  }
}
