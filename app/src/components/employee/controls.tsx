"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";

// Small form controls for the employee wizard. Option cards follow hire-worker-type.png:
// white bordered cards, the selected one gets the green success border.

export interface Option<T extends string> {
  value: T;
  label: string;
  description?: ReactNode;
  tag?: ReactNode;
}

/** Radio group rendered as selectable option cards. Arrow keys move within the group (native radios). */
export function OptionCards<T extends string>({ name, legend, options, value, onChange, required, error, errorId, cols = 2, hint }: { name: string; legend: string; options: Option<T>[]; value: T | null | undefined; onChange: (v: T) => void; required?: boolean; error?: string | null; errorId?: string; cols?: 1 | 2 | 3; hint?: ReactNode }) {
  const grid = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3" }[cols];
  const eid = errorId ?? `${name}-error`;
  const hid = `${name}-hint`;
  return (
    <fieldset aria-describedby={[error ? eid : null, hint ? hid : null].filter(Boolean).join(" ") || undefined} aria-invalid={error ? true : undefined}>
      <legend className="mb-2 text-sm text-ink">
        {legend}
        {required ? <span className="ml-0.5 text-danger" aria-hidden>*</span> : null}
      </legend>
      <div className={`grid grid-cols-1 gap-3 ${grid}`}>
        {options.map((o) => {
          const selected = value === o.value;
          return (
            <label
              key={o.value}
              className={`relative flex cursor-pointer items-start gap-3 rounded-[10px] border bg-surface px-4 py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${selected ? "border-success ring-1 ring-success" : error ? "border-danger" : "border-line hover:border-tint-2"}`}
            >
              <input type="radio" name={name} value={o.value} checked={selected} onChange={() => onChange(o.value)} className="sr-only" />
              <span aria-hidden className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border ${selected ? "border-success bg-success" : "border-line"}`}>
                {selected ? <Check className="size-3 text-white" strokeWidth={3} /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-sm text-ink">
                  {o.label}
                  {o.tag}
                </span>
                {o.description ? <span className="mt-0.5 block text-[13px] text-muted">{o.description}</span> : null}
              </span>
            </label>
          );
        })}
      </div>
      {hint ? (
        <p id={hid} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={eid} className="mt-1.5 text-xs text-danger-text">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/** Compact yes/no question. */
export function YesNo({ name, legend, value, onChange, required, error, hint, yesLabel = "Yes", noLabel = "No" }: { name: string; legend: string; value: boolean | undefined; onChange: (v: boolean) => void; required?: boolean; error?: string | null; hint?: ReactNode; yesLabel?: string; noLabel?: string }) {
  const eid = `${name}-error`;
  const hid = `${name}-hint`;
  return (
    <fieldset aria-describedby={[error ? eid : null, hint ? hid : null].filter(Boolean).join(" ") || undefined} aria-invalid={error ? true : undefined}>
      <legend className="mb-2 text-sm text-ink">
        {legend}
        {required ? <span className="ml-0.5 text-danger" aria-hidden>*</span> : null}
      </legend>
      <div className="inline-flex rounded-[8px] border border-line bg-surface p-0.5">
        {([true, false] as const).map((v) => {
          const selected = value === v;
          return (
            <label key={String(v)} className={`cursor-pointer rounded-[6px] px-4 py-1.5 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${selected ? "bg-segment text-ink" : "text-muted hover:text-ink"}`}>
              <input type="radio" name={name} checked={selected} onChange={() => onChange(v)} className="sr-only" />
              {v ? yesLabel : noLabel}
            </label>
          );
        })}
      </div>
      {hint ? (
        <p id={hid} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={eid} className="mt-1.5 text-xs text-danger-text">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/** Checkbox with label and optional description. */
export function CheckRow({ checked, onChange, label, description, disabled, id }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; disabled?: boolean; id?: string }) {
  return (
    <label className={`flex items-start gap-2.5 text-sm ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 size-4 shrink-0 rounded-[4px] accent-primary" />
      <span className="min-w-0">
        <span className="text-ink">{label}</span>
        {description ? <span className="block text-[13px] text-muted">{description}</span> : null}
      </span>
    </label>
  );
}
