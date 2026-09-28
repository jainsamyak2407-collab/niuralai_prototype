"use client";

import { SimError } from "@/components/demo/SimError";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <SimError error={error} retry={retry} what="the simulator" />;
}
