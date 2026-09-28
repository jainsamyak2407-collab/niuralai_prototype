import type { Cents } from "@/lib/contracts/domain";

// Currency-aware formatting. Amounts are integer cents; USD uses two minor units.
// The currency code goes before the amount, as in the Niural app ("USD 1,300.00").
const MINOR_UNITS: Record<string, number> = { USD: 2, JPY: 0 };

export function fmtMoney(cents: Cents, currency = "USD", opts: { sign?: boolean } = {}): string {
  const digits = MINOR_UNITS[currency] ?? 2;
  const abs = Math.abs(cents) / 10 ** digits;
  const body = abs.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const sign = cents < 0 ? "- " : opts.sign && cents > 0 ? "+ " : "";
  return `${sign}${currency} ${body}`;
}
