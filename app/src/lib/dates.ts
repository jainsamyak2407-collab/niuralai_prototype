// Date helpers. Calendar dates are date-only strings; timestamps are UTC ISO strings.
// Deadlines display in the employer timezone (America/New_York). That timezone does not
// imply New York-only legal scope.

export const EMPLOYER_TZ = "America/New_York";

export function parseDate(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}
export function fmtISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function isValidDate(d: string | null | undefined): d is string {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const x = parseDate(d);
  return !Number.isNaN(x.getTime()) && fmtISO(x) === d;
}
export function addDays(d: string, n: number): string {
  const x = parseDate(d);
  x.setUTCDate(x.getUTCDate() + n);
  return fmtISO(x);
}
export function diffDays(a: string, b: string): number {
  return Math.round((parseDate(a).getTime() - parseDate(b).getTime()) / 86400000);
}
export function firstOfNextMonth(d: string): string {
  const x = parseDate(d);
  return fmtISO(new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 1)));
}
export function lastOfMonth(d: string): string {
  const x = parseDate(d);
  return fmtISO(new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)));
}
export function daysInMonth(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
export function monthOf(d: string): string {
  return d.slice(0, 7);
}
export function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

function tzParts(iso: string, tz = EMPLOYER_TZ) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const p = Object.fromEntries(f.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { y: p.year, m: p.month, d: p.day, h: p.hour, min: p.minute };
}

/** Local employer calendar date for a UTC timestamp. */
export function localDate(iso: string, tz = EMPLOYER_TZ): string {
  const p = tzParts(iso, tz);
  return `${p.y}-${p.m}-${p.d}`;
}

/** UTC timestamp for a local wall-clock time in the employer timezone. */
export function zonedToUtc(date: string, time: string, tz = EMPLOYER_TZ): string {
  const [hh, mm] = time.split(":").map(Number);
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // offset = local(guess) - guess
  const p = tzParts(new Date(guess).toISOString(), tz);
  const localAsUtc = Date.UTC(+p.y, +p.m - 1, +p.d, +p.h, +p.min);
  const offset = localAsUtc - guess;
  return new Date(guess - offset).toISOString();
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "Sep 1, 2026" */
export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-").map(Number);
  return `${MONTHS[m - 1]} ${day}, ${y}`;
}
/** "September 1" */
export function fmtDateLong(d: string | null | undefined, withYear = false): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-").map(Number);
  return `${MONTHS_LONG[m - 1]} ${day}${withYear ? `, ${y}` : ""}`;
}
/** "Sep 27, 2026, 9:00 AM ET" */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const p = tzParts(iso);
  const h = +p.h;
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${MONTHS[+p.m - 1]} ${+p.d}, ${p.y}, ${hr}:${p.min} ${h < 12 ? "AM" : "PM"} ET`;
}
export function fmtMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}
