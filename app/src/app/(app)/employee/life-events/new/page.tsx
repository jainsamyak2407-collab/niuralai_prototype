import { ButtonLink } from "@/components/ui/button";
import { Banner, PageHeader } from "@/components/ui/primitives";
import { EventPicker } from "@/components/employee/EventPicker";
import { requireSession } from "@/server/guard";
import { employeeCasesView } from "@/server/views";
import { EVENT_TILES } from "@/server/config/rules";

export default async function NewLifeEventPage() {
  const { user, scenarioId } = await requireSession(["employee"]);
  const drafts = (await employeeCasesView(user, scenarioId)).filter((r) => r.status === "draft");
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Report a life event"
        crumbs={[{ label: "Life events", href: "/employee/life-events" }, { label: "New request" }]}
        description="Choose the kind of change. We ask for dates first so you can see your deadline right away."
      />
      {drafts.length ? (
        <Banner
          className="mb-5"
          title={`You have ${drafts.length === 1 ? "a draft" : `${drafts.length} drafts`} in progress`}
          action={
            <ButtonLink href={drafts[0].href} variant="outline" size="sm">
              Continue {drafts[0].caseNumber}
            </ButtonLink>
          }
        >
          {drafts.map((d) => `${d.caseNumber} · ${d.event}`).join("; ")}. Continue it instead of starting again if it is the same event.
        </Banner>
      ) : null}
      <EventPicker tiles={EVENT_TILES} />
    </div>
  );
}
