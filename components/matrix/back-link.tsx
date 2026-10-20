"use client";

import Link from "next/link";

import { ChevronLeftIcon } from "lucide-react";

import useBackTo from "@/hooks/use-back-to";

/**
 * Goes back to wherever you came from (the overview, Tickets…) with its scroll
 * position and filters intact. Opened straight from a link, there is nowhere
 * of ours to go back to, so it goes to `fallbackHref` instead (see useBackTo).
 * Still a real link to it, so ⌘-click and middle-click open it in a new tab.
 */
function BackLink({ fallbackHref = "/" }: { fallbackHref?: string }) {
  const goBack = useBackTo(fallbackHref);

  return (
    <Link
      href={fallbackHref}
      onClick={(e) => {
        // let the browser handle new-tab / new-window clicks
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        goBack();
      }}
      className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      <ChevronLeftIcon className="size-3.5" />
      Back
    </Link>
  );
}

export default BackLink;
