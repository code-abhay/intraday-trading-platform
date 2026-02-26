import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isMarketOpen(): boolean {
  const now = new Date();
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const istTotalMinutes = utcMinutes + 330; // IST = UTC+5:30

  const istDay = istTotalMinutes >= 1440
    ? (now.getUTCDay() + 1) % 7
    : now.getUTCDay();
  const istMinutes = istTotalMinutes >= 1440
    ? istTotalMinutes - 1440
    : istTotalMinutes;

  if (istDay === 0 || istDay === 6) return false;

  return istMinutes >= 555 && istMinutes <= 930; // 9:15 AM – 3:30 PM
}

export function getMarketStatusMessage(): string {
  const now = new Date();
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const istTotalMinutes = utcMinutes + 330;
  const istDay = istTotalMinutes >= 1440
    ? (now.getUTCDay() + 1) % 7
    : now.getUTCDay();
  const istMinutes = istTotalMinutes >= 1440
    ? istTotalMinutes - 1440
    : istTotalMinutes;

  if (istDay === 0 || istDay === 6)
    return "Market is closed (weekend). Opens Monday 9:15 AM IST.";

  if (istMinutes < 555) {
    const wait = 555 - istMinutes;
    const h = Math.floor(wait / 60);
    const m = Math.round(wait % 60);
    return `Market opens at 9:15 AM IST (in ${h > 0 ? `${h}h ` : ""}${m}m).`;
  }

  if (istDay === 5)
    return "Market closed at 3:30 PM IST. Opens Monday at 9:15 AM.";

  return "Market closed at 3:30 PM IST. Opens tomorrow at 9:15 AM.";
}
