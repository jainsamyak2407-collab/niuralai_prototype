"use client";

import Link from "next/link";
import type { TimingResult } from "@/lib/contracts/domain";
import { Banner } from "@/components/ui/primitives";
import { Button, buttonClass } from "@/components/ui/button";
import { AskEmmaButton } from "@/components/emma/EmmaDock";
import { fmtDate } from "@/lib/dates";
import { timingTone } from "./labels";

/**
 * Deadline message computed by the rules engine (never by the client). Shown as soon as
 * the event date is known. A late request offers Emma, HR review and saving a draft.
 */
export function TimingBanner({ timing, caseId, onSaveDraft, savePending, showReviewAction = true }: { timing: TimingResult; caseId: string; onSaveDraft?: () => void; savePending?: boolean; showReviewAction?: boolean }) {
  if (!timing.eventDate) return null;
  const late = timing.status === "late";
  const title =
    timing.status === "late"
      ? "Needs HR review"
      : timing.status === "last_day"
        ? "Last day to submit"
        : timing.status === "future_event"
          ? "This date is in the future"
          : timing.status === "advance_request"
            ? "Advance request"
            : timing.deadline
              ? `Submit by ${fmtDate(timing.deadline)}`
              : undefined;
  return (
    <Banner tone={timingTone(timing.status)} title={title}>
      <p>{timing.message}</p>
      <p className="mt-1 text-xs text-muted">
        Source: {timing.label} · rule {timing.ruleId} v{timing.ruleVersion}
        {timing.deadline ? ` · deadline ${fmtDate(timing.deadline)}, end of day Eastern Time` : ""}
      </p>
      {late ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <AskEmmaButton question="My request is past Nexa's standard window. What happens with a late request?" className="mr-2">
            Explain with Emma
          </AskEmmaButton>
          {showReviewAction ? (
            <Link href={`/employee/life-events/${caseId}/review?mode=review`} className={buttonClass("outline", "sm")}>
              Send to HR for review
            </Link>
          ) : null}
          {onSaveDraft ? (
            <Button variant="ghost" size="sm" onClick={onSaveDraft} pending={savePending} pendingLabel="Saving…">
              Save draft
            </Button>
          ) : null}
        </div>
      ) : null}
    </Banner>
  );
}
