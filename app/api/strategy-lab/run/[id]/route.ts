import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { executeStrategyLabRun } from "@/lib/strategy-lab/run-executor";
import { getStrategyLabRun } from "@/lib/strategy-lab/store";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const sb = getSupabaseAdmin();
  if (!sb) {
    return NextResponse.json(
      { error: "Supabase is not configured. Strategy Lab async runs are unavailable." },
      { status: 503 }
    );
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing run id." }, { status: 400 });
  }

  const autoStart = request.nextUrl.searchParams.get("start") !== "0";
  let run = await getStrategyLabRun(id);
  if (!run) {
    return NextResponse.json({ error: "Run not found." }, { status: 404 });
  }

  if (autoStart && run.status === "PENDING") {
    run = await executeStrategyLabRun(id);
    if (!run) {
      return NextResponse.json({ error: "Run not found." }, { status: 404 });
    }
  }

  return NextResponse.json({
    runId: run.runId,
    status: run.status,
    error: run.error,
    params: run.params,
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    result: run.result,
  });
}
