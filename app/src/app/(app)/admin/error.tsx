"use client";

import { SegmentError } from "@/components/hr/SegmentError";

export default function AdminError({
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
      home="/admin"
      homeLabel="Back to overview"
    />
  );
}
