"use client";

import { SegmentError } from "@/components/hr/SegmentError";

export default function BrokerError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  return (
    <SegmentError
      error={error}
      retry={() => (retry ?? reset)?.()}
      home="/broker/tasks"
      homeLabel="Back to tasks"
    />
  );
}
