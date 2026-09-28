import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, Check, CheckCircle2, ChevronRight, Info, XCircle } from "lucide-react";
import { fmtMoney } from "@/lib/money";
import { fmtDate, fmtDateTime } from "@/lib/dates";

// Shared Niural-style primitives. Server-safe (no client state).

export type Tone = "green" | "amber" | "blue" | "red" | "gray" | "purple";
const DOT: Record<Tone, string> = { green: "bg-success", amber: "bg-warning", blue: "bg-info", red: "bg-danger", gray: "bg-muted", purple: "bg-primary" };

/** White status pill with a colored dot, as in the Niural tables. */
export function StatusPill({ tone, children, className = "" }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-0.5 text-xs text-ink whitespace-nowrap ${className}`}>
      <span className={`size-1.5 rounded-full ${DOT[tone]}`} aria-hidden />
      {children}
    </span>
  );
}

/** Gray tag (4–6px radius). */
export function Tag({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center rounded-[5px] bg-fill px-1.5 py-0.5 text-xs text-ink-2 ${className}`}>{children}</span>;
}

export function Money({ cents, sign, className = "" }: { cents: number; sign?: boolean; className?: string }) {
  const text = fmtMoney(cents, "USD", { sign });
  const [code, ...rest] = text.replace(/^[-+] /, "").split(" ");
  const prefix = cents < 0 ? "- " : sign && cents > 0 ? "+ " : "";
  return (
    <span className={`tabular whitespace-nowrap ${cents < 0 ? "text-danger-text" : ""} ${className}`}>
      {prefix}
      <span className="text-muted">{code}</span> {rest.join(" ")}
    </span>
  );
}

export function DateText({ date, time, className = "" }: { date?: string | null; time?: string | null; className?: string }) {
  return <span className={`tabular ${className}`}>{time ? fmtDateTime(time) : fmtDate(date)}</span>;
}

export interface Crumb {
  label: string;
  href?: string;
}
export function PageHeader({ title, crumbs, actions, description }: { title: string; crumbs?: Crumb[]; actions?: ReactNode; description?: ReactNode }) {
  return (
    <header className="mb-5">
      {crumbs?.length ? (
        <nav aria-label="Breadcrumb" className="mb-1.5 flex items-center gap-1 text-[13px] text-muted">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {c.href ? (
                <Link href={c.href} className="hover:text-primary">
                  {c.label}
                </Link>
              ) : (
                <span aria-current="page">{c.label}</span>
              )}
              {i < crumbs.length - 1 ? <ChevronRight className="size-3.5" aria-hidden /> : null}
            </span>
          ))}
        </nav>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[20px] font-medium leading-7 text-ink">{title}</h1>
          {description ? <div className="mt-1 text-sm text-muted">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

/** Section card with a header row (title + divider) and body. */
export function Section({ title, actions, children, className = "", bodyClassName = "p-5", id, description }: { title: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string; id?: string; description?: ReactNode }) {
  return (
    <section id={id} className={`rounded-[12px] border border-line bg-surface ${className}`} aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-divider px-5 py-3.5">
        <div className="min-w-0">
          <h2 id={id ? `${id}-title` : undefined} className="text-base font-medium text-ink">
            {title}
          </h2>
          {description ? <p className="mt-0.5 text-[13px] text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/** Plain bordered card without a header row (inner action cards). */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[12px] border border-line bg-surface ${className}`}>{children}</div>;
}

export function Banner({ tone = "info", title, children, action, className = "" }: { tone?: "info" | "warning" | "error" | "success"; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  const styles = {
    info: "bg-surface border-line",
    warning: "bg-warning-soft border-warning/40",
    error: "bg-danger-soft border-danger/30",
    success: "bg-success-soft border-success/30",
  }[tone];
  const Icon = tone === "info" ? Info : tone === "warning" ? AlertTriangle : tone === "error" ? XCircle : CheckCircle2;
  const iconColor = tone === "info" ? "text-info" : tone === "warning" ? "text-warning" : tone === "error" ? "text-danger" : "text-success";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex items-start gap-3 rounded-[10px] border px-4 py-3 text-sm ${styles} ${className}`}>
      <Icon className={`mt-0.5 size-4 shrink-0 ${iconColor}`} aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-medium text-ink">{title}</p> : null}
        {children ? <div className="text-ink-2">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {icon ? <div className="mb-3 text-muted [&_svg]:size-5">{icon}</div> : null}
      <p className="text-base font-medium text-ink">{title}</p>
      {children ? <p className="mt-1 max-w-md text-sm text-muted">{children}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-[6px] bg-fill ${className}`} aria-hidden />;
}

/** Label/value grid used on detail pages. */
export function LabelValue({ items, cols = 3 }: { items: { label: string; value: ReactNode }[]; cols?: 2 | 3 | 4 }) {
  const grid = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[cols];
  return (
    <dl className={`grid grid-cols-1 gap-x-6 gap-y-4 ${grid}`}>
      {items.map((it, i) => (
        <div key={i} className="min-w-0">
          <dt className="text-[13px] font-medium text-ink">{it.label}</dt>
          <dd className="mt-0.5 text-sm text-ink-2 break-words">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// ---- Table rhythm: #F4F4F5 header, 1px row dividers, no zebra ----
export function Table({ children, className = "", label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full border-collapse text-sm" aria-label={label}>
        {children}
      </table>
    </div>
  );
}
export function THead({ children }: { children: ReactNode }) {
  return <thead className="bg-fill text-left text-ink">{children}</thead>;
}
export function Th({ children, className = "", align = "left" }: { children?: ReactNode; className?: string; align?: "left" | "right" }) {
  return (
    <th scope="col" className={`h-11 whitespace-nowrap border-b border-divider px-4 font-normal ${align === "right" ? "text-right" : "text-left"} ${className}`}>
      {children}
    </th>
  );
}
export function Td({ children, className = "", align = "left" }: { children?: ReactNode; className?: string; align?: "left" | "right" }) {
  return <td className={`h-13 border-b border-divider px-4 py-2.5 align-middle ${align === "right" ? "text-right tabular" : ""} ${className}`}>{children}</td>;
}
export function TableFooter({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[13px] text-muted">{children}</div>;
}

/** Five-stage wizard indicator. */
export function Stepper({ steps, current }: { steps: { label: string; href?: string }[]; current: number }) {
  return (
    <ol className="mb-6 flex flex-wrap items-center gap-2 text-[13px]" aria-label="Progress">
      {steps.map((s, i) => {
        const state = i < current ? "done" : i === current ? "current" : "upcoming";
        const inner = (
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${state === "current" ? "bg-primary-soft text-primary-strong" : state === "done" ? "text-ink" : "text-muted"}`}>
            <span
              className={`grid size-5 place-items-center rounded-full text-[11px] ${state === "current" ? "bg-primary text-white" : state === "done" ? "bg-success-soft text-success-text" : "border border-line text-muted"}`}
              aria-hidden
            >
              {state === "done" ? <Check className="size-3" /> : i + 1}
            </span>
            {s.label}
          </span>
        );
        return (
          <li key={s.label} className="flex items-center gap-2" aria-current={state === "current" ? "step" : undefined}>
            {s.href && state === "done" ? (
              <Link href={s.href} className="rounded-full hover:bg-fill">
                {inner}
              </Link>
            ) : (
              inner
            )}
            {i < steps.length - 1 ? <span className="h-px w-6 bg-line" aria-hidden /> : null}
          </li>
        );
      })}
    </ol>
  );
}

export function SyntheticLabel({ className = "" }: { className?: string }) {
  return <span className={`inline-flex items-center rounded-full border border-line bg-surface px-2 py-0.5 text-[11px] text-muted ${className}`}>Synthetic data · Demo environment</span>;
}
