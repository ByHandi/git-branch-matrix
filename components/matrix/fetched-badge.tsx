import { type Freshness, ago, freshness } from "./shared";

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
  // UTC on purpose: server and browser timezones differ, a local time would not hydrate
  const when = fetchedAt ? `Last git fetch: ${fetchedAt.slice(0, 16).replace("T", " ")} UTC. ` : "";

  return (
    <span
      title={`${when}Run \`git fetch\` in this repo to pick up newer merges.`}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs whitespace-nowrap",
        TONE[level],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {fetchedAt ? `fetched ${ago(fetchedAt)}` : "never fetched"}
    </span>
  );
}

export default FetchedBadge;
