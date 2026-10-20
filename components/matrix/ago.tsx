"use client";

import { ago } from "./shared";

import { useNow } from "@/hooks/use-now";
import { useTimeZone } from "@/hooks/use-time-zone";
import { formatDateTime } from "@/lib/time";

/** A relative time ("14h ago") that shows the exact moment, in the viewer's zone, on hover. */
function Ago({ iso, prefix = "" }: { iso: string | null; prefix?: string }) {
  const now = useNow();
  const timeZone = useTimeZone();
  if (!iso) return null;
  return (
    <time dateTime={iso} title={formatDateTime(iso, timeZone)}>
      {prefix}
      {ago(iso, now)}
    </time>
  );
}

export default Ago;
