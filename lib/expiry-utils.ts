/**
 * Weekly expiry days per segment:
 *   NIFTY     → Tuesday  (day 2)
 *   BANKNIFTY → Wednesday (day 3)
 *   SENSEX    → Friday   (day 5)
 *   MIDCPNIFTY→ Monday   (day 1)
 *
 * Format for Angel One Option Greeks: DDMMMYYYY (e.g. "04MAR2026")
 * Format for Angel One option symbol: NIFTY04MAR2625400CE (DDMONYY style used by SearchScrip)
 */

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export type ExpiryDay = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sun .. 6=Sat

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/**
 * Get the next occurrence of a specific weekday.
 * If today IS that weekday and before 3:30 PM IST, returns today.
 */
function getNextWeekday(targetDay: ExpiryDay, from: Date = new Date()): Date {
  const d = new Date(from);
  const currentDay = d.getDay();
  let daysAhead = (targetDay - currentDay + 7) % 7;

  if (daysAhead === 0) {
    const istHour = d.getUTCHours() + 5 + (d.getUTCMinutes() + 30 >= 60 ? 1 : 0);
    const istMin = (d.getUTCMinutes() + 30) % 60;
    if (istHour > 15 || (istHour === 15 && istMin >= 30)) {
      daysAhead = 7;
    }
  }

  d.setDate(d.getDate() + daysAhead);
  return d;
}

export function formatExpiryForAngelOne(d: Date): string {
  const day = d.getDate();
  const month = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${day.toString().padStart(2, "0")}${month}${year}`;
}

/**
 * Format for Angel One option trading symbol: DDMONYY
 * e.g. Date(2026, 2, 4) → "04MAR26"
 */
export function formatExpiryShort(d: Date): string {
  const day = d.getDate();
  const month = MONTHS[d.getMonth()];
  const year = String(d.getFullYear()).slice(2);
  return `${day.toString().padStart(2, "0")}${month}${year}`;
}

/**
 * Get robust expiry candidates for a segment.
 * Handles holiday shifts by trying: expected day, day-1, day-2 for current & next week.
 * Skips weekends. Returns formatted strings for the Option Greeks API.
 */
export function getExpiryCandidates(expiryDay: ExpiryDay): string[] {
  const now = new Date();
  const thisWeekTarget = getNextWeekday(expiryDay, now);

  const candidates: Date[] = [];

  // This week: expected day, then day-1, day-2 (holiday prepone)
  candidates.push(thisWeekTarget);
  const tw1 = addDays(thisWeekTarget, -1);
  if (!isWeekend(tw1)) candidates.push(tw1);
  const tw2 = addDays(thisWeekTarget, -2);
  if (!isWeekend(tw2)) candidates.push(tw2);

  // Next week: same pattern
  const nextWeekTarget = addDays(thisWeekTarget, 7);
  candidates.push(nextWeekTarget);
  const nw1 = addDays(nextWeekTarget, -1);
  if (!isWeekend(nw1)) candidates.push(nw1);
  const nw2 = addDays(nextWeekTarget, -2);
  if (!isWeekend(nw2)) candidates.push(nw2);

  // Deduplicate and format
  const seen = new Set<string>();
  const result: string[] = [];
  for (const d of candidates) {
    const formatted = formatExpiryForAngelOne(d);
    if (!seen.has(formatted)) {
      seen.add(formatted);
      result.push(formatted);
    }
  }

  return result;
}

/**
 * Build the Angel One NFO/BFO option trading symbol.
 * Format: NIFTY04MAR2625400CE
 */
export function buildOptionSymbol(
  underlying: string,
  expiryDate: Date | string,
  strike: number,
  optionType: "CE" | "PE",
): string {
  let shortExpiry: string;
  if (typeof expiryDate === "string") {
    // Convert from "04MAR2026" → "04MAR26"
    const dd = expiryDate.slice(0, 2);
    const mon = expiryDate.slice(2, 5);
    const yy = expiryDate.slice(6, 8);
    shortExpiry = `${dd}${mon}${yy}`;
  } else {
    shortExpiry = formatExpiryShort(expiryDate);
  }
  return `${underlying}${shortExpiry}${strike}${optionType}`;
}

/**
 * Legacy — returns Thursday-based expiry (kept for backward compat)
 */
export function getNextWeeklyExpiry(): string {
  return formatExpiryForAngelOne(getNextWeekday(4));
}
