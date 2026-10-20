"use client";

import { ExternalLinkIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Opens a ticket in the issue tracker (Jira, Linear…) in a new tab. Rows around it open the ticket
 * sheet on click, so the click stops here. Renders nothing when the repo has no tracker link.
 */
function TicketLink({ href, className }: { href: string | null; className?: string }) {
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title="Open in issue tracker"
      aria-label="Open in issue tracker"
      className={cn(
        "ml-1 inline-flex align-middle text-muted-foreground hover:text-sky-600 dark:hover:text-sky-400",
        className,
      )}
    >
      <ExternalLinkIcon className="size-3" />
    </a>
  );
}

export default TicketLink;
