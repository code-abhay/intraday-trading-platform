const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export function isTelegramConfigured(): boolean {
  return !!(BOT_TOKEN && CHAT_ID);
}

export async function sendTelegramMessage(text: string): Promise<boolean> {
  if (!BOT_TOKEN || !CHAT_ID) return false;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

interface SignalAlert {
  segment: string;
  bias: string;
  confidence: number;
  strike?: number;
  side?: string;
  premium?: number;
  entry?: number;
  stopLoss?: number;
  t1?: number;
  t2?: number;
  t3?: number;
  ltp?: number;
  pcr?: number;
  summary?: string;
}

export function formatSignalAlert(alert: SignalAlert): string {
  const emoji =
    alert.bias === "BULLISH" ? "🟢" :
    alert.bias === "BEARISH" ? "🔴" : "🟡";

  const lines = [
    `${emoji} <b>${alert.segment} — ${alert.bias}</b>`,
    `Confidence: ${alert.confidence}%`,
  ];

  if (alert.ltp) lines.push(`LTP: ₹${alert.ltp}`);
  if (alert.pcr) lines.push(`PCR: ${alert.pcr}`);

  if (alert.strike && alert.side) {
    lines.push("");
    lines.push(`<b>📊 Recommended: ${alert.strike} ${alert.side}</b>`);
    if (alert.premium) lines.push(`Premium: ₹${alert.premium}`);
  }

  if (alert.entry) {
    lines.push("");
    lines.push(`Entry: ₹${alert.entry}`);
    if (alert.stopLoss) lines.push(`Stop Loss: ₹${alert.stopLoss}`);
    if (alert.t1) lines.push(`T1: ₹${alert.t1} | T2: ₹${alert.t2} | T3: ₹${alert.t3}`);
  }

  if (alert.summary) {
    lines.push("");
    lines.push(`<i>${alert.summary}</i>`);
  }

  lines.push("");
  lines.push(`⏰ ${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST`);

  return lines.join("\n");
}
