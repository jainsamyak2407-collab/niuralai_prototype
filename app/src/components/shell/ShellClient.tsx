"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, CalendarClock, ChevronDown, LogOut, Sparkles, Users } from "lucide-react";
import type { Notification, Role } from "@/lib/contracts/domain";
import { fmtDateTime } from "@/lib/dates";
import { NavIcon } from "./icons";
import type { IconName, Module } from "./nav";
import { useEmma } from "@/components/emma/EmmaDock";

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

function isActive(pathname: string, href: string, match?: string) {
  if (match) return new RegExp(match).test(pathname);
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopNav({ modules }: { modules: { label: string; href: string; icon: IconName }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Modules" className="hidden items-center gap-1 md:flex">
      {modules.map((m) => {
        const active = pathname.startsWith(m.href.split("/").slice(0, 2).join("/"));
        return (
          <Link key={m.href} href={m.href} aria-current={active ? "page" : undefined} className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm ${active ? "bg-primary-soft text-primary-strong" : "text-ink hover:bg-fill"}`}>
            <NavIcon name={m.icon} />
            {m.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({ module }: { module: Module }) {
  const pathname = usePathname();
  return (
    <aside className="sidebar-gradient hidden w-[232px] shrink-0 flex-col overflow-y-auto px-4 py-6 lg:flex" aria-label={`${module.title} navigation`}>
      <p className="px-2 text-lg font-semibold text-ink">{module.title}</p>
      <nav className="mt-6 flex flex-col gap-6">
        {module.groups.map((g) => (
          <div key={g.label}>
            <p className="mb-2 px-2 text-xs font-medium tracking-wide text-muted uppercase">{g.label}</p>
            <ul className="flex flex-col gap-1">
              {g.items.map((it) => {
                const active = isActive(pathname, it.href, it.match);
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-[8px] border px-3 py-2 text-sm ${active ? "border-sidebar-pill bg-surface text-primary-strong" : "border-transparent text-ink hover:bg-white/60"}`}
                    >
                      <NavIcon name={it.icon} />
                      {it.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <p className="mt-auto px-2 pt-8 text-[11px] leading-4 text-muted">Synthetic data · Demo environment. Carrier, payroll, COBRA and email are simulated.</p>
    </aside>
  );
}

const SCENARIOS = [
  { id: "birth", title: "Birth" },
  { id: "divorce", title: "Divorce" },
  { id: "loss", title: "Loss of other coverage" },
] as const;

/** Scenario and business-clock chip. Switching never resets or merges scenarios. */
export function ScenarioChip({ scenarioId, title, now }: { scenarioId: string; title: string; now: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const router = useRouter();
  const ref = useOutside(open, () => setOpen(false));
  async function choose(id: string) {
    setPending(id);
    const res = await fetch("/api/session/scenario", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scenarioId: id }) });
    setPending(null);
    if (res.ok) {
      setOpen(false);
      router.refresh();
    }
  }
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex h-10 items-center gap-2 rounded-full border border-line px-3.5 text-sm hover:bg-fill">
        <CalendarClock className="size-4 text-primary" aria-hidden />
        <span className="hidden sm:inline">{title}</span>
        <span className="tabular hidden text-muted xl:inline">· {fmtDateTime(now)}</span>
        <ChevronDown className="size-4 text-muted" aria-hidden />
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-[12px] border border-line bg-surface p-2 shadow-[var(--shadow-flyout)]">
          <p className="px-2 pt-1 pb-2 text-xs text-muted">Demo scenario. Each keeps its own records and clock.</p>
          <p className="tabular px-2 pb-2 text-xs text-ink">Business time: {fmtDateTime(now)}</p>
          {SCENARIOS.map((s) => (
            <button key={s.id} type="button" onClick={() => choose(s.id)} disabled={!!pending} className={`flex w-full items-center justify-between rounded-[8px] px-2 py-2 text-left text-sm hover:bg-fill ${s.id === scenarioId ? "text-primary-strong" : "text-ink"}`}>
              {s.title}
              {s.id === scenarioId ? <span className="text-xs text-muted">Current</span> : pending === s.id ? <span className="text-xs text-muted">Switching…</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function EmmaButton() {
  const { toggle, open } = useEmma();
  return (
    <button type="button" onClick={toggle} aria-pressed={open} className={`flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm ${open ? "border-primary bg-tint-4 text-primary-strong" : "border-line text-primary hover:bg-fill"}`}>
      <Sparkles className="size-4" aria-hidden />
      <span className="hidden whitespace-nowrap sm:inline">Ask Emma</span>
      <span className="sr-only sm:hidden">Ask Emma</span>
    </button>
  );
}

export function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [error, setError] = useState(false);
  const ref = useOutside(open, () => setOpen(false));
  useEffect(() => {
    if (!open) return;
    setError(false);
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((b) => (b.ok ? setItems(b.notifications) : setError(true)))
      .catch(() => setError(true));
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Notifications" className="grid size-10 place-items-center rounded-full border border-line hover:bg-fill">
        <Bell className="size-4" aria-hidden />
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-[360px] rounded-[12px] border border-line bg-surface shadow-[var(--shadow-flyout)]">
          <div className="border-b border-divider px-4 py-3">
            <p className="text-sm font-medium">Notifications</p>
            <p className="text-xs text-muted">Simulated inbox. No real email is sent.</p>
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {error ? <li className="px-4 py-6 text-sm text-danger-text">We could not load notifications. Close and try again.</li> : null}
            {!items && !error ? <li className="px-4 py-6 text-sm text-muted">Loading…</li> : null}
            {items?.length === 0 ? <li className="px-4 py-6 text-sm text-muted">Nothing new. Updates about your requests appear here.</li> : null}
            {items?.map((n) => (
              <li key={n.id} className="border-b border-divider last:border-0">
                <Link href={n.link} onClick={() => setOpen(false)} className="block px-4 py-3 hover:bg-fill">
                  <p className="text-sm text-ink">{n.subject}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted">{n.preview}</p>
                  <p className="tabular mt-1 text-[11px] text-muted">{fmtDateTime(n.createdAt)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function AccountMenu({ name, email, title, role }: { name: string; email: string; title: string; role: Role }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useOutside(open, () => setOpen(false));
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  async function signOut() {
    await fetch("/api/session/demo", { method: "DELETE" });
    router.push("/");
    router.refresh();
  }
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={`Account: ${name}`} className={`grid size-10 place-items-center rounded-full text-sm font-medium text-white ${role === "employee" ? "bg-accent-pink" : "bg-primary"}`}>
        {initials}
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-72 rounded-[12px] border border-line bg-surface p-2 shadow-[var(--shadow-flyout)]">
          <div className="px-2 py-2">
            <p className="text-sm font-medium">{name}</p>
            <p className="text-xs text-muted">{email}</p>
            <p className="mt-1 text-xs text-muted">{title}</p>
            <p className="mt-2 inline-flex rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">Demo session</p>
          </div>
          <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-[8px] px-2 py-2 text-sm hover:bg-fill">
            <Users className="size-4" aria-hidden /> Switch role
          </Link>
          <button type="button" onClick={signOut} className="flex w-full items-center gap-2 rounded-[8px] px-2 py-2 text-left text-sm hover:bg-fill">
            <LogOut className="size-4" aria-hidden /> Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Short polling + refetch on focus: an operator action appears in other role views without manual refresh. */
export function LiveRefresh() {
  const router = useRouter();
  const rev = useRef<number | null>(null);
  useEffect(() => {
    let stop = false;
    async function tick() {
      if (document.hidden) return;
      try {
        const r = await fetch("/api/state", { cache: "no-store" });
        if (!r.ok) return;
        const b = (await r.json()) as { rev: number };
        if (rev.current !== null && b.rev !== rev.current && !stop) {
          // Do not interrupt typing: skip refresh while a form field has focus.
          const a = document.activeElement;
          if (!(a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement || a instanceof HTMLSelectElement)) router.refresh();
          else return;
        }
        rev.current = b.rev;
      } catch {
        /* offline: try again next tick */
      }
    }
    tick();
    const id = setInterval(tick, 5000);
    window.addEventListener("focus", tick);
    return () => {
      stop = true;
      clearInterval(id);
      window.removeEventListener("focus", tick);
    };
  }, [router]);
  return null;
}
