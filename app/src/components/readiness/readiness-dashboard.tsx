"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Info,
  RotateCcw,
  Search,
  SearchX,
  X,
} from "lucide-react";
import {
  ENTITIES,
  PAYROLL_DATE,
  PAY_PERIOD,
  STATUS_LABEL,
  STORAGE_KEY,
  StoredStateSchema,
  formatDate,
  formatMoney,
  percentChange,
  type Entity,
  type Status,
  type StoredState,
} from "@/lib/contracts/readiness";

const EMPTY: StoredState = { reviewed: {} };

function loadState(): StoredState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = StoredStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY;
  } catch {
    return EMPTY;
  }
}

function saveState(state: StoredState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

function resolveEntities(state: StoredState): Entity[] {
  return ENTITIES.map((e) =>
    state.reviewed[e.id] && e.variance
      ? { ...e, status: "ready" as Status }
      : e,
  );
}

/* ---------- small building blocks ---------- */

function Money({
  minor,
  currency,
  className = "",
}: {
  minor: number;
  currency: string;
  className?: string;
}) {
  const m = formatMoney(minor, currency);
  return (
    <span className={`tabular whitespace-nowrap ${className}`}>
      <span className="text-muted">{m.code}</span> {m.amount}
    </span>
  );
}

const DOT: Record<Status, string> = {
  ready: "bg-success",
  review: "bg-warning",
  blocked: "bg-error",
};

function StatusBadge({ status }: { status: Status }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs">
      {status === "blocked" ? (
        <AlertTriangle
          className="size-3.5 text-error"
          strokeWidth={2}
          aria-hidden
        />
      ) : (
        <span className={`size-1.5 rounded-full ${DOT[status]}`} aria-hidden />
      )}
      {STATUS_LABEL[status]}
    </span>
  );
}

const btn = {
  primary:
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm text-white hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-60",
  outline:
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 text-sm text-ink hover:bg-fill",
  link: "inline-flex items-center gap-1 text-sm text-primary hover:underline",
};

/* ---------- dashboard ---------- */

type Filter = "all" | Status;

export function ReadinessDashboard() {
  const [state, setState] = useState<StoredState | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const closePanel = useCallback(() => setOpenId(null), []);

  // Hydrate from localStorage after mount so server and client markup match.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(loadState());
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  // "/" focuses search, matching the Niural toolbar hint.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const entities = useMemo(
    () => (state ? resolveEntities(state) : ENTITIES),
    [state],
  );
  const counts = useMemo(() => {
    const c = { ready: 0, review: 0, blocked: 0 };
    for (const e of entities) c[e.status] += 1;
    return c;
  }, [entities]);

  const visible = entities.filter((e) => {
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      e.name.toLowerCase().includes(q) ||
      e.country.toLowerCase().includes(q);
    return matchesQuery && (filter === "all" || e.status === filter);
  });

  const open = entities.find((e) => e.id === openId) ?? null;

  function markReviewed(id: string) {
    if (!state || state.reviewed[id]) return; // guard against duplicate submits
    const next: StoredState = {
      reviewed: { ...state.reviewed, [id]: new Date().toISOString() },
    };
    if (!saveState(next)) {
      setSaveError(true);
      return;
    }
    setSaveError(false);
    setState(next);
    const name = ENTITIES.find((e) => e.id === id)?.name;
    setToast(`Variance marked as reviewed. ${name} is now ready for payroll.`);
  }

  function resetDemo() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* storage unavailable; in-memory reset still applies */
    }
    setState(EMPTY);
    setOpenId(null);
    setQuery("");
    setFilter("all");
    setToast("Demo reset. All entities are back to their starting status.");
  }

  const ready = state !== null;
  const allReady = counts.review === 0 && counts.blocked === 0;

  return (
    <div className="flex h-full">
      <div className="min-w-0 flex-1 px-6 py-6">
        {/* Page header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-medium">Payroll Readiness</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-muted">
              <CalendarDays className="size-4" strokeWidth={1.75} aria-hidden />
              <span>
                Next payroll{" "}
                <span className="tabular text-ink">
                  {formatDate(PAYROLL_DATE)}
                </span>
              </span>
              <span aria-hidden>·</span>
              <span>
                Pay period{" "}
                <span className="tabular text-ink">{PAY_PERIOD}</span>
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-fill px-2 py-1 text-xs text-muted">
              Rehearsal · synthetic data
            </span>
            <button type="button" className={btn.outline} onClick={resetDemo}>
              <RotateCcw className="size-4" strokeWidth={1.75} />
              Reset demo
            </button>
          </div>
        </div>

        {/* Readiness summary */}
        <section
          aria-labelledby="summary-title"
          className="mt-6 rounded-xl border border-line"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-divider px-5 py-3.5">
            <h2 id="summary-title" className="text-base font-medium">
              Readiness summary
            </h2>
            <p
              className={`text-sm ${allReady ? "text-success-text" : "text-warning-text"}`}
            >
              {allReady
                ? "All entities are ready to approve."
                : `Deadline: ${formatDate("2026-10-07")}. Resolve ${counts.review + counts.blocked} ${
                    counts.review + counts.blocked === 1 ? "entity" : "entities"
                  } before approving payroll.`}
            </p>
          </div>
          <dl
            className="grid grid-cols-2 divide-divider sm:grid-cols-4 sm:divide-x"
            aria-live="polite"
          >
            {(
              [
                ["Entities", ENTITIES.length, null],
                ["Ready", counts.ready, "ready"],
                ["Needs review", counts.review, "review"],
                ["Blocked", counts.blocked, "blocked"],
              ] as const
            ).map(([label, value, s]) => (
              <div key={label} className="px-5 py-4">
                <dt className="flex items-center gap-1.5 text-sm text-muted">
                  {s && (
                    <span
                      className={`size-1.5 rounded-full ${DOT[s]}`}
                      aria-hidden
                    />
                  )}
                  {label}
                </dt>
                <dd
                  className="tabular mt-1 text-xl font-medium"
                  data-testid={`count-${s ?? "total"}`}
                >
                  {ready ? (
                    value
                  ) : (
                    <span className="inline-block h-6 w-6 animate-pulse rounded bg-fill" />
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Toolbar */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <label className="relative block w-full max-w-xs">
            <span className="sr-only">Search entities</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search entity or country..."
              className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-8 text-sm placeholder:text-muted focus:border-primary focus:outline-none"
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded bg-fill px-1.5 text-xs text-muted">
              /
            </kbd>
          </label>
          <div className="relative ml-auto">
            <label htmlFor="status-filter" className="sr-only">
              Filter by status
            </label>
            <select
              id="status-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value as Filter)}
              className="h-9 appearance-none rounded-lg border border-line bg-surface pl-3 pr-9 text-sm focus:border-primary focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="ready">Ready</option>
              <option value="review">Needs review</option>
              <option value="blocked">Blocked</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          </div>
        </div>

        {/* Table */}
        <div className="mt-4 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-fill text-left">
              <tr>
                <th scope="col" className="px-4 py-3 font-normal">
                  Entity
                </th>
                <th scope="col" className="px-4 py-3 font-normal">
                  Country
                </th>
                <th scope="col" className="px-4 py-3 text-right font-normal">
                  Employees
                </th>
                <th scope="col" className="px-4 py-3 text-right font-normal">
                  Payroll total
                </th>
                <th scope="col" className="px-4 py-3 font-normal">
                  Deadline
                </th>
                <th scope="col" className="px-4 py-3 font-normal">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-right font-normal">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((e) => (
                <tr
                  key={e.id}
                  className={`border-t border-divider ${openId === e.id ? "bg-tint-4" : ""}`}
                >
                  <td className="px-4 py-3.5">
                    <div className="font-medium">{e.name}</div>
                    {e.issue && e.status !== "ready" && (
                      <div
                        className="mt-0.5 max-w-[280px] truncate text-xs text-muted"
                        title={e.issue}
                      >
                        {e.issue}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <span aria-hidden>{e.flag}</span>
                      {e.country}
                    </span>
                  </td>
                  <td className="tabular px-4 py-3.5 text-right">
                    {e.employees}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <Money minor={e.totalMinor} currency={e.currency} />
                  </td>
                  <td className="tabular px-4 py-3.5">
                    {formatDate(e.deadline)}
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={e.status} />
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      type="button"
                      className={btn.outline}
                      onClick={() => setOpenId(e.id)}
                      aria-label={`Review ${e.name}`}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr className="border-t border-divider">
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <SearchX
                      className="mx-auto size-6 text-muted"
                      strokeWidth={1.5}
                      aria-hidden
                    />
                    <p className="mt-2 font-medium">
                      No entities match these filters
                    </p>
                    <button
                      type="button"
                      className={`${btn.link} mt-1`}
                      onClick={() => {
                        setQuery("");
                        setFilter("all");
                      }}
                    >
                      Clear filters
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-divider px-4 py-3 text-sm">
            <span className="text-muted">
              Showing {visible.length} of {ENTITIES.length} entities
            </span>
            <div className="flex items-center gap-3">
              <span className="text-muted">Page 1 of 1</span>
              <div className="flex gap-1.5">
                {[ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight].map(
                  (Icon, i) => (
                    <button
                      key={i}
                      type="button"
                      disabled
                      aria-label={
                        [
                          "First page",
                          "Previous page",
                          "Next page",
                          "Last page",
                        ][i]
                      }
                      className="grid size-8 place-items-center rounded-lg border border-line text-muted disabled:opacity-50"
                    >
                      <Icon className="size-4" />
                    </button>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {open && (
        <DetailPanel
          entity={open}
          reviewedAt={state?.reviewed[open.id]}
          saveError={saveError}
          onClose={closePanel}
          onMarkReviewed={() => markReviewed(open.id)}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-line bg-surface px-4 py-3 text-sm shadow-[0_0_0_1px_#00000014,0_4px_8px_#00000014,0_8px_16px_#00000014]"
        >
          <CheckCircle2 className="size-4 text-success" aria-hidden />
          {toast}
        </div>
      )}
    </div>
  );
}

/* ---------- detail panel ---------- */

function DetailPanel({
  entity,
  reviewedAt,
  saveError,
  onClose,
  onMarkReviewed,
}: {
  entity: Entity;
  reviewedAt?: string;
  saveError: boolean;
  onClose: () => void;
  onMarkReviewed: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [entity.id, onClose]);

  const v = entity.variance;
  const delta = v ? entity.totalMinor - v.previousMinor : 0;
  const pct = v ? percentChange(v.previousMinor, entity.totalMinor) : 0;

  return (
    <>
      <button
        type="button"
        aria-label="Close panel"
        tabIndex={-1}
        onClick={onClose}
        className="fixed inset-0 z-30 bg-ink/20"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="panel-title"
        className="sheet-in fixed inset-y-0 right-0 z-40 flex w-full max-w-[440px] flex-col border-l border-line bg-surface shadow-[0_0_0_1px_#00000014,0_16px_32px_#00000014]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-divider px-5 py-4">
          <div>
            <h2 id="panel-title" className="text-base font-medium">
              {entity.name}
            </h2>
            <p className="mt-1 flex items-center gap-2 text-sm text-muted">
              <span aria-hidden>{entity.flag}</span> {entity.country} ·{" "}
              {entity.employees} employees
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="grid size-8 place-items-center rounded-lg border border-line hover:bg-fill"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 text-sm">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <dt className="text-muted">Status</dt>
            <dd>
              <StatusBadge status={entity.status} />
            </dd>
            <dt className="text-muted">Payroll total</dt>
            <dd>
              <Money minor={entity.totalMinor} currency={entity.currency} />
            </dd>
            <dt className="text-muted">Approval deadline</dt>
            <dd className="tabular text-warning-text">
              {formatDate(entity.deadline)}
            </dd>
          </dl>

          {!v && entity.issue && (
            <div
              className={`flex gap-2 rounded-lg border px-3 py-2.5 ${
                entity.status === "blocked"
                  ? "border-error/30 bg-delta-bg"
                  : "border-warning/40 bg-warning-bg"
              }`}
            >
              <AlertTriangle
                className={`mt-0.5 size-4 shrink-0 ${entity.status === "blocked" ? "text-error" : "text-warning-text"}`}
                aria-hidden
              />
              <p>
                {entity.issue} This is outside the rehearsal scope, so it cannot
                be resolved here.
              </p>
            </div>
          )}

          {!v && !entity.issue && (
            <div className="flex gap-2 rounded-lg border border-line px-3 py-2.5">
              <CheckCircle2
                className="mt-0.5 size-4 shrink-0 text-success"
                aria-hidden
              />
              <p>
                No issues found. This entity matches the previous cycle within
                normal range.
              </p>
            </div>
          )}

          {v && (
            <>
              <section className="rounded-xl border border-line">
                <div className="flex items-center justify-between border-b border-divider px-4 py-3">
                  <h3 className="font-medium">Payroll variance</h3>
                  <span className="tabular rounded-md bg-delta-bg px-1.5 py-0.5 text-xs text-delta">
                    ↑ {pct}%
                  </span>
                </div>
                <dl className="grid grid-cols-[1fr_auto] gap-y-2 px-4 py-3">
                  <dt className="text-muted">Previous cycle</dt>
                  <dd className="text-right">
                    <Money minor={v.previousMinor} currency={entity.currency} />
                  </dd>
                  <dt className="text-muted">Current cycle</dt>
                  <dd className="text-right">
                    <Money
                      minor={entity.totalMinor}
                      currency={entity.currency}
                    />
                  </dd>
                  <dt className="border-t border-divider pt-2 font-medium">
                    Increase
                  </dt>
                  <dd className="border-t border-divider pt-2 text-right font-medium">
                    + <Money minor={delta} currency={entity.currency} />
                  </dd>
                </dl>
              </section>

              <section>
                <h3 className="font-medium">Contributing changes</h3>
                <ul className="mt-2 divide-y divide-divider rounded-xl border border-line">
                  {v.changes.map((c) => (
                    <li
                      key={c.label}
                      className="flex items-start justify-between gap-3 px-4 py-3"
                    >
                      <div>
                        <p>{c.label}</p>
                        <p className="text-xs text-muted">{c.detail}</p>
                      </div>
                      <span className="whitespace-nowrap">
                        +{" "}
                        <Money
                          minor={c.amountMinor}
                          currency={entity.currency}
                        />
                      </span>
                    </li>
                  ))}
                  <li className="flex justify-between bg-fill px-4 py-2.5 font-medium">
                    <span>Total of changes</span>
                    <span>
                      +{" "}
                      <Money
                        minor={v.changes.reduce((s, c) => s + c.amountMinor, 0)}
                        currency={entity.currency}
                      />
                    </span>
                  </li>
                </ul>
              </section>

              <section className="rounded-xl border border-line bg-tint-4/60 px-4 py-3">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-primary-strong">
                  <Info className="size-3.5" aria-hidden /> Sample analysis
                </p>
                <p className="mt-2 leading-relaxed">{v.sampleExplanation}</p>
                <p className="mt-2 text-xs text-muted">
                  Written for this rehearsal, not generated from live data.
                  Check the changes above before approving.
                </p>
              </section>
            </>
          )}
        </div>

        {v && (
          <div className="border-t border-divider px-5 py-4">
            {saveError && (
              <p role="alert" className="mb-3 text-sm text-error">
                Could not save the review in this browser. Check that site
                storage is allowed, then try again.
              </p>
            )}
            {reviewedAt ? (
              <p className="flex items-center gap-2 text-sm text-success-text">
                <Check className="size-4" aria-hidden />
                Variance reviewed on{" "}
                {new Date(reviewedAt).toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            ) : (
              <div className="flex justify-end gap-2">
                <button type="button" className={btn.outline} onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={btn.primary}
                  onClick={onMarkReviewed}
                >
                  <Check className="size-4" /> Mark as reviewed
                </button>
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
