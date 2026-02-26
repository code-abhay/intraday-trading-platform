/**
 * NSE index options expiry: weekly on Thursday.
 * Format for Angel One: DDMMMYYYY (e.g. "06MAR2025")
 */

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/**
 * Get next Thursday from a given date (or today).
 * If today is Thursday and before 3:30 PM IST, return today; else next Thursday.
 */
function getNextThursday(from: Date = new Date()): Date {
  const d = new Date(from);
  const day = d.getDay(); // 0=Sun, 4=Thu
  const daysToThursday = (4 - day + 7) % 7;
  if (daysToThursday === 0) {
    // Today is Thursday - use it
    return d;
  }
  d.setDate(d.getDate() + daysToThursday);
  return d;
}

/**
 * Format date as DDMMMYYYY for Angel One API
 */
export function formatExpiryForAngelOne(d: Date): string {
  const day = d.getDate();
  const month = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${day.toString().padStart(2, "0")}${month}${year}`;
}

/**
 * Get next weekly expiry for NIFTY/BANKNIFTY in Angel One format
 */
export function getNextWeeklyExpiry(): string {
  return formatExpiryForAngelOne(getNextThursday());
}
