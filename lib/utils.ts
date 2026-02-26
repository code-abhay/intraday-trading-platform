import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const IST_OFFSET_MINUTES = 330;
const MINUTES_PER_DAY = 1440;
const MARKET_OPEN_MINUTES = 9 * 60 + 15; // 09:15
const MARKET_CLOSE_MINUTES = 15 * 60 + 30; // 15:30

interface IstTimeContext {
  day: number; // 0=Sun ... 6=Sat
  minutes: number;
}

function getIstContext(now: Date = new Date()): IstTimeContext {
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const istTotalMinutes = utcMinutes + IST_OFFSET_MINUTES;
  const day =
    istTotalMinutes >= MINUTES_PER_DAY
      ? (now.getUTCDay() + 1) % 7
      : now.getUTCDay();
  const minutes =
    istTotalMinutes >= MINUTES_PER_DAY
      ? istTotalMinutes - MINUTES_PER_DAY
      : istTotalMinutes;
  return { day, minutes };
}

function formatIstTime(totalMinutes: number): string {
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  const period = hh >= 12 ? "PM" : "AM";
  const displayHour = hh % 12 || 12;
  return `${displayHour}:${String(mm).padStart(2, "0")} ${period} IST`;
}

export function isMarketOpen(now: Date = new Date()): boolean {
  const { day, minutes } = getIstContext(now);
  if (day === 0 || day === 6) return false;
  return minutes >= MARKET_OPEN_MINUTES && minutes <= MARKET_CLOSE_MINUTES;
}

export function isTradeEntryWindow(
  skipFirstMinutes = 15,
  skipLastMinutes = 30,
  now: Date = new Date()
): boolean {
  const { day, minutes } = getIstContext(now);
  if (day === 0 || day === 6) return false;

  const entryStart = MARKET_OPEN_MINUTES + Math.max(0, skipFirstMinutes);
  const entryEnd = MARKET_CLOSE_MINUTES - Math.max(0, skipLastMinutes);
  if (entryStart >= entryEnd) return false;

  return minutes >= entryStart && minutes <= entryEnd;
}

export function getTradeEntryWindowMessage(
  skipFirstMinutes = 15,
  skipLastMinutes = 30,
  now: Date = new Date()
): string {
  const { day, minutes } = getIstContext(now);
  if (day === 0 || day === 6) {
    return "Trade entry blocked: weekend session.";
  }

  const entryStart = MARKET_OPEN_MINUTES + Math.max(0, skipFirstMinutes);
  const entryEnd = MARKET_CLOSE_MINUTES - Math.max(0, skipLastMinutes);
  if (entryStart >= entryEnd) {
    return "Trade entry blocked: invalid entry window configuration.";
  }

  if (minutes < entryStart) {
    return `Trade entry starts at ${formatIstTime(entryStart)} after opening noise settles.`;
  }
  if (minutes > entryEnd) {
    return `Trade entry closed at ${formatIstTime(entryEnd)} to avoid end-of-day volatility.`;
  }

  return "Trade entry window is open.";
}

export function getMarketStatusMessage(now: Date = new Date()): string {
  const { day, minutes } = getIstContext(now);

  if (day === 0 || day === 6) {
    return "Market is closed (weekend). Opens Monday 9:15 AM IST.";
  }

  if (minutes < MARKET_OPEN_MINUTES) {
    const wait = MARKET_OPEN_MINUTES - minutes;
    const h = Math.floor(wait / 60);
    const m = Math.round(wait % 60);
    return `Market opens at 9:15 AM IST (in ${h > 0 ? `${h}h ` : ""}${m}m).`;
  }

  if (day === 5) {
    return "Market closed at 3:30 PM IST. Opens Monday at 9:15 AM.";
  }

  return "Market closed at 3:30 PM IST. Opens tomorrow at 9:15 AM.";
}
