import { SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-3xl rounded-[12px] border border-line bg-surface">
      <EmptyState icon={<SearchX aria-hidden />} title="We could not find that request" action={<ButtonLink href="/employee/life-events">See my requests</ButtonLink>}>
        It may belong to another scenario, or the link is out of date.
      </EmptyState>
    </div>
  );
}
