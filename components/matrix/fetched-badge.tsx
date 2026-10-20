import { type Freshness, ago, freshness } from "./shared";

import { useNow } from "@/hooks/use-now";
import { useTimeZone } from "@/hooks/use-time-zone";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";

const TONE: Record<Freshness, string> = {
  fresh: "text-muted-foreground",
  aging: "text-amber-600 dark:text-amber-400",
  stale: "text-destructive",
};

/**
 * The app only reads git and never fetches, so a clone nobody fetched lately
 * silently shows old merges. This makes that lag visible.
 */
function FetchedBadge({ fetchedAt, className }: { fetchedAt: string | null; className?: string }) {
  const level = freshness(fetchedAt);
  const timeZone = useTimeZone();
  const now = useNow();
  const when = fetchedAt ? `Last git fetch: ${formatDateTime(fetchedAt, timeZone)}. ` : "";

  return (
    <span
      title={`${when}The refresh button in the header fetches and re-reads.`}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs whitespace-nowrap",
        TONE[level],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {fetchedAt ? `fetched ${ago(fetchedAt, now)}` : "never fetched"}
    </span>
  );
}

export default FetchedBadge;
