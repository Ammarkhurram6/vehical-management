/* Formatting helpers.
   IMPORTANT: All dates coming from the API are "wall clock" times stored as
   UTC-based Dates (see trip-parser). They must always be rendered using the
   UTC getters so users see exactly the time their tracking system logged. */

export function fmtINR(n: number, decimals = 0): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export function fmtINRCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)}Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)}L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}

export function fmtKm(n: number, decimals = 1): string {
  return `${n.toLocaleString("en-IN", { maximumFractionDigits: decimals })} km`;
}

export function fmtNum(n: number, decimals = 1): string {
  return n.toLocaleString("en-IN", { maximumFractionDigits: decimals });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad(n: number) { return n < 10 ? `0${n}` : String(n); }

/** "01 Aug 2026" from ISO string (UTC wall clock) */
export function fmtDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "01 Aug, 06:30 AM" from ISO string (UTC wall clock) */
export function fmtDateTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const h24 = d.getUTCHours();
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]}, ${h12}:${pad(d.getUTCMinutes())} ${ampm}`;
}

/** "06:30 AM" (UTC wall clock) */
export function fmtTime(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const h24 = d.getUTCHours();
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${pad(d.getUTCMinutes())} ${ampm}`;
}

/** "Mon, 01 Aug" (UTC wall clock) */
export function fmtDayShort(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return `${DAYS[d.getUTCDay()]}, ${pad(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]}`;
}

/** "Aug 2026" from "YYYY-MM" */
export function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${y}`;
}

export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/** YYYY-MM for "this month" in the user's local timezone */
export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}

/** YYYY-MM-DD local (for date inputs) */
export function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Convert a "YYYY-MM-DD" or "YYYY-MM-DD HH:mm" local input into a UTC-wallclock Date.
    The string components are used verbatim as UTC components. */
export function wallClock(input: string): Date {
  const m = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return new Date(input);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0)));
}
