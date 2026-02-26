/**
 * Weekly expiry days per segment:
 *   NIFTY     → Tuesday  (day 2)
 *   BANKNIFTY → Wednesday (day 3)
 *   SENSEX    → Friday   (day 5)
 *   MIDCPNIFTY→ Monday   (day 1)
 *
 * Format for Angel One Option Greeks: DDMMMYYYY (e.g. "04MAR2026")
 */

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export type ExpiryDay = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sun .. 6=Sat

/**
 * Get the next occurrence of a specific weekday from today.
 * If today IS that weekday and before 3:30 PM IST, returns today.
 * Otherwise returns the next occurrence.
 */
function getNextWeekday(targetDay: ExpiryDay, from: Date = new Date()): Date {
  const d = new Date(from);
  const currentDay = d.getDay();
  let daysAhead = (targetDay - currentDay + 7) % 7;

  if (daysAhead === 0) {
    // Today is the target day — check if market is still open (before 3:30 PM IST)
    const istHour = d.getUTCHours() + 5 + (d.getUTCMinutes() + 30 >= 60 ? 1 : 0);
    const istMin = (d.getUTCMinutes() + 30) % 60;
    if (istHour > 15 || (istHour === 15 && istMin >= 30)) {
      daysAhead = 7; // past expiry time, move to next week
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
 * Get expiry candidates for a segment (current week + next week).
 * Returns array of formatted expiry strings to try in order.
 */
export function getExpiryCandidates(expiryDay: ExpiryDay): string[] {
  const now = new Date();
  const thisWeek = getNextWeekday(expiryDay, now);

  const nextWeek = new Date(thisWeek);
  nextWeek.setDate(nextWeek.getDate() + 7);

  return [
    formatExpiryForAngelOne(thisWeek),
    formatExpiryForAngelOne(nextWeek),
  ];
}

/**
 * Legacy — returns Thursday-based expiry (kept for backward compat)
 */
export function getNextWeeklyExpiry(): string {
  return formatExpiryForAngelOne(getNextWeekday(4)); // Thursday
}
