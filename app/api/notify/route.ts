import { NextRequest, NextResponse } from "next/server";
import {
  isTelegramConfigured,
  sendTelegramMessage,
  formatSignalAlert,
} from "@/lib/telegram";

// POST /api/notify — send a signal alert via Telegram
export async function POST(req: NextRequest) {
  if (!isTelegramConfigured()) {
    return NextResponse.json(
      { enabled: false, message: "Telegram not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID env vars." },
      { status: 200 }
    );
  }

  try {
    const body = await req.json();

    const alert = {
      segment: body.segment ?? "UNKNOWN",
      bias: body.bias ?? "NEUTRAL",
      confidence: body.confidence ?? 0,
      strike: body.strike,
      side: body.side,
      premium: body.premium,
      entry: body.entry,
      stopLoss: body.stopLoss,
      t1: body.t1,
      t2: body.t2,
      t3: body.t3,
      ltp: body.ltp,
      pcr: body.pcr,
      summary: body.summary,
    };

    const message = formatSignalAlert(alert);
    const sent = await sendTelegramMessage(message);

    return NextResponse.json({ enabled: true, sent });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send notification" },
      { status: 500 }
    );
  }
}

// GET /api/notify — check if Telegram is configured
export async function GET() {
  return NextResponse.json({ enabled: isTelegramConfigured() });
}
