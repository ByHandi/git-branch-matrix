"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import CommandPalette from "./command-palette";
import Logo from "./logo";

import { cn } from "@/lib/utils";

const VIEWS = [
  { href: "/", label: "Repos" },
  { href: "/tickets", label: "Tickets" },
];

/**
 * Navigation and ⌘K only. Filters, refresh and "+ Repo" act on what a page lists, so each page
 * draws them in its own toolbar (see page-filters.tsx).
 */
function AppHeader() {
  const pathname = usePathname();
  const view = pathname.startsWith("/tickets") ? "/tickets" : "/";

  return (
    <header className="flex shrink-0 items-center gap-3 border-b bg-background px-6 py-3">
      <Link href="/" className="flex items-center gap-3">
        <Logo className="size-7 shrink-0" />
        <div>
          <h1 className="text-sm font-semibold">Git Branch Matrix</h1>
          <p className="text-xs text-muted-foreground">git read-only</p>
        </div>
      </Link>

      <nav className="flex gap-1 rounded-lg bg-muted p-1">
        {VIEWS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            aria-current={view === href ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground",
              view === href && "bg-background text-foreground shadow-xs",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="ml-auto">
        <CommandPalette />
      </div>
    </header>
  );
}

export default AppHeader;
