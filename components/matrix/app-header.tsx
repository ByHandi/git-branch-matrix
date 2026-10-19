"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { RefreshCwIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useTransition } from "react";

import AddRepoDialog from "./add-repo-dialog";
import AuthorFilter from "./author-filter";
import Logo from "./logo";
import { useMatrix } from "./matrix-context";
import { authorOptions } from "./shared";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const VIEWS = [
  { href: "/", label: "Repos" },
  { href: "/tickets", label: "Tickets" },
];

function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const view = pathname.startsWith("/tickets") ? "/tickets" : "/";
  const { query, setQuery, pendingOnly, setPendingOnly, authors, setAuthors, models } = useMatrix();
  const [refreshing, startRefresh] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  // "/" focuses search, the way it works in most dev tools
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && /^(INPUT|TEXTAREA)$/.test(target.tagName);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Options come from the repos on screen, which change while rows stream in and
  // when you move between pages — keep a selected author listed even when the
  // current page has none of their tickets, or it would filter invisibly.
  const authorChoices = useMemo(() => {
    const options = authorOptions(models);
    const known = new Set(options.map((o) => o.value));
    return [
      ...options,
      ...authors.filter((a) => !known.has(a)).map((value) => ({ value, count: 0 })),
    ];
  }, [models, authors]);

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/75">
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

      <div className="ml-auto flex items-center gap-2">
        <Input
          ref={searchRef}
          type="search"
          placeholder="search ticket / branch / author…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 w-52"
        />

        <AuthorFilter options={authorChoices} value={authors} onChange={setAuthors} />

        <Button
          size="sm"
          variant={pendingOnly ? "secondary" : "outline"}
          aria-pressed={pendingOnly}
          onClick={() => setPendingOnly((v) => !v)}
        >
          Open only
        </Button>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Re-read from git"
              isLoading={refreshing}
              onClick={() => startRefresh(() => router.refresh())}
            >
              <RefreshCwIcon className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Re-read from git</TooltipContent>
        </Tooltip>

        <AddRepoDialog />
      </div>
    </header>
  );
}

export default AppHeader;
