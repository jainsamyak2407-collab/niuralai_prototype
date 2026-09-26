import { z } from "zod";

// Synthetic rehearsal data. No real entities, people, or payroll.

export const StatusSchema = z.enum(["ready", "review", "blocked"]);
export type Status = z.infer<typeof StatusSchema>;

export const STATUS_LABEL: Record<Status, string> = {
  ready: "Ready",
  review: "Needs review",
  blocked: "Blocked",
};

export type Change = { label: string; detail: string; amountMinor: number };

export type Variance = {
  previousMinor: number;
  changes: Change[];
  sampleExplanation: string;
};

export type Entity = {
  id: string;
  name: string;
  country: string;
  flag: string;
  employees: number;
  currency: string;
  totalMinor: number; // amount in the currency's minor unit
  deadline: string; // ISO date
  status: Status;
  issue?: string;
  variance?: Variance;
};

export const PAYROLL_DATE = "2026-10-15";
export const PAY_PERIOD = "Oct 01 - Oct 15, 2026";

export const ENTITIES: Entity[] = [
  {
    id: "us",
    name: "Northwind Labs Inc.",
    country: "United States",
    flag: "🇺🇸",
    employees: 42,
    currency: "USD",
    totalMinor: 135_000_00,
    deadline: "2026-10-09",
    status: "review",
    issue: "Payroll is 35% higher than the previous cycle.",
    variance: {
      previousMinor: 100_000_00,
      changes: [
        { label: "New hires", detail: "3 engineers joined on Oct 01", amountMinor: 21_000_00 },
        { label: "Salary adjustments", detail: "Annual raises for 8 employees", amountMinor: 9_500_00 },
        { label: "One-time bonus", detail: "Q3 sales commission, 2 employees", amountMinor: 4_500_00 },
      ],
      sampleExplanation:
        "Most of the increase comes from three new engineers who start this cycle. Raises from the annual review and a one-time Q3 commission make up the rest. None of these look unusual, but confirm the new hires' start dates before approving.",
    },
  },
  {
    id: "uk",
    name: "Northwind UK Ltd",
    country: "United Kingdom",
    flag: "🇬🇧",
    employees: 18,
    currency: "GBP",
    totalMinor: 96_400_00,
    deadline: "2026-10-09",
    status: "ready",
  },
  {
    id: "ca",
    name: "Northwind Canada Corp.",
    country: "Canada",
    flag: "🇨🇦",
    employees: 12,
    currency: "CAD",
    totalMinor: 88_250_00,
    deadline: "2026-10-10",
    status: "ready",
  },
  {
    id: "in",
    name: "Northwind India Pvt Ltd",
    country: "India",
    flag: "🇮🇳",
    employees: 35,
    currency: "INR",
    totalMinor: 48_500_000_00,
    deadline: "2026-10-08",
    status: "ready",
  },
  {
    id: "de",
    name: "Northwind GmbH",
    country: "Germany",
    flag: "🇩🇪",
    employees: 9,
    currency: "EUR",
    totalMinor: 71_300_00,
    deadline: "2026-10-08",
    status: "review",
    issue: "1 new hire is missing a tax ID. Collect it before approving payroll.",
  },
  {
    id: "jp",
    name: "Northwind Japan KK",
    country: "Japan",
    flag: "🇯🇵",
    employees: 6,
    currency: "JPY",
    totalMinor: 5_420_000, // JPY has no minor unit
    deadline: "2026-10-07",
    status: "blocked",
    issue: "Bank account verification failed for the funding account. Payroll cannot run until it is fixed.",
  },
];

// Currency-aware formatting: minor-unit digits come from Intl, not a hardcoded 2.
function fractionDigits(currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).resolvedOptions()
    .maximumFractionDigits ?? 2;
}

export function formatMoney(minor: number, currency: string) {
  const digits = fractionDigits(currency);
  const value = minor / 10 ** digits;
  return {
    code: currency,
    amount: new Intl.NumberFormat("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value),
  };
}

export function percentChange(previous: number, current: number) {
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Persisted client state for the rehearsal (localStorage).
export const StoredStateSchema = z.object({
  reviewed: z.record(z.string(), z.string()), // entity id -> ISO timestamp
});
export type StoredState = z.infer<typeof StoredStateSchema>;
export const STORAGE_KEY = "niural-readiness-demo-v1";
