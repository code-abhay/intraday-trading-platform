import { NextRequest, NextResponse } from "next/server";
import { recordSignalDirection } from "@/lib/strategy";

interface AckPayload {
  symbol?: string;
  bias?: string;
}

export async function POST(req: NextRequest) {
  let body: AckPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const symbol = String(body.symbol ?? "").trim().toUpperCase();
  const bias = String(body.bias ?? "").trim().toUpperCase();
  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }
  if (bias !== "BULLISH" && bias !== "BEARISH") {
    return NextResponse.json(
      { error: "bias must be BULLISH or BEARISH" },
      { status: 400 }
    );
  }

  recordSignalDirection(symbol, bias);
  return NextResponse.json({ success: true });
}
