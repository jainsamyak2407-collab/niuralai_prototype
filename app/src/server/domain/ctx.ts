import type { AiActivity, AuditEvent, DemoUser, Notification, QleCase, ScenarioState, Task } from "@/lib/contracts/domain";
import { localDate } from "@/lib/dates";
import { USERS, userById } from "@/server/config/identities";

// Execution context for one command against one scenario document.
export interface Ctx {
  s: ScenarioState;
  actor: DemoUser;
  real: string; // real wall-clock ISO time (audit ingestion)
}

export class DomainError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 422,
    public code: string,
    message: string,
    public nextAction?: string,
    public fieldErrors?: Record<string, string>,
    public latest?: unknown,
  ) {
    super(message);
  }
}

export const now = (ctx: Ctx) => ctx.s.clock.businessNow;
export const today = (s: ScenarioState) => localDate(s.clock.businessNow);

export function nextId(s: ScenarioState, prefix: string): string {
  s.counters[prefix] = (s.counters[prefix] ?? 0) + 1;
  return `${prefix}_${s.scenarioId.slice(0, 1)}${s.counters[prefix]}`;
}

export function findCase(s: ScenarioState, id: string): QleCase {
  const c = s.cases.find((x) => x.id === id);
  if (!c) throw new DomainError(404, "case_not_found", "We could not find that case.");
  return c;
}

export function touch(ctx: Ctx, c: QleCase) {
  c.version += 1;
  c.updatedAt = now(ctx);
}

export function audit(
  ctx: Ctx,
  e: { caseId: string | null; type: string; summary: string; employeeSummary?: string | null; data?: AuditEvent["data"]; actor?: string },
): AuditEvent {
  const ev: AuditEvent = {
    id: nextId(ctx.s, "au"),
    caseId: e.caseId,
    at: now(ctx),
    ingestedAt: ctx.real,
    actor: e.actor ?? ctx.actor.id,
    type: e.type,
    summary: e.summary,
    employeeSummary: e.employeeSummary ?? null,
    visibility: e.employeeSummary ? "employee" : "internal",
    data: e.data,
  };
  ctx.s.audit.push(ev);
  return ev;
}

export function metric(ctx: Ctx, name: string, caseId: string | null) {
  ctx.s.metrics.push({ at: now(ctx), name, caseId });
}

export function aiLog(ctx: Ctx, a: Omit<AiActivity, "id" | "at" | "actor"> & { actor?: string }) {
  ctx.s.ai.push({ id: nextId(ctx.s, "ai"), at: now(ctx), actor: a.actor ?? ctx.actor.id, ...a });
}

const LINK_FOR: Record<string, (caseId: string) => string> = {
  employee: (id) => `/employee/cases/${id}`,
  hr_admin: (id) => `/admin/qle/${id}`,
};

/** Deduplicated simulated email + in-app notification. Never includes evidence, SSNs or private former-spouse details. */
export function notify(
  ctx: Ctx,
  n: { key: string; userId: string; subject: string; preview: string; caseId: string | null; eventType: string; link?: string },
): Notification | null {
  const key = `${n.key}:${n.userId}`;
  if (ctx.s.outbox.some((x) => x.key === key)) return null;
  const user = userById(n.userId);
  const role = user?.role ?? "hr_admin";
  const link = n.link ?? (n.caseId ? (LINK_FOR[role]?.(n.caseId) ?? "/") : "/");
  const out: Notification = {
    id: nextId(ctx.s, "nt"),
    key,
    recipientUserId: n.userId,
    recipientEmail: user?.email ?? `${n.userId}@demo.example`,
    recipientRole: role,
    subject: n.subject,
    preview: n.preview,
    caseId: n.caseId,
    link,
    eventType: n.eventType,
    createdAt: now(ctx),
    deliveryState: "simulated_delivered",
  };
  ctx.s.outbox.push(out);
  return out;
}

export function addTask(ctx: Ctx, t: Omit<Task, "id" | "createdAt" | "status">): Task {
  const task: Task = { id: nextId(ctx.s, "task"), createdAt: now(ctx), status: "open", ...t };
  ctx.s.tasks.push(task);
  return task;
}

export function closeTasks(ctx: Ctx, pred: (t: Task) => boolean, resolution: string) {
  for (const t of ctx.s.tasks) {
    if (t.status === "open" && pred(t)) {
      t.status = "done";
      t.resolvedAt = now(ctx);
      t.resolution = resolution;
    }
  }
}

export function hoursFrom(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 3600_000).toISOString();
}

/** Add business days (Mon–Fri) to a timestamp, keeping the time of day. */
export function addBusinessDays(iso: string, days: number): string {
  const d = new Date(iso);
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) left -= 1;
  }
  return d.toISOString();
}

export const HR_ID = "u_daniel";
export const HR_BACKUP = "u_rosa";
export const EMPLOYEE_ID = "u_maya";
export const allUsers = USERS;
