"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { RefreshCwIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useTransition } from "react";
import { toast } from "sonner";

import AddRepoDialog from "./add-repo-dialog";
import AuthorFilter from "./author-filter";
import CommandPalette from "./command-palette";
import Logo from "./logo";
import { useMatrix } from "./matrix-context";
import { authorOptions } from "./shared";

import { fetchReposAction } from "@/app/actions";
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
  const {
    query,
    setQuery,
    pendingOnly,
    setPendingOnly,
    authors,
    setAuthors,
    tags,
    setTags,
    models,
  } = useMatrix();
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

  // count = how many repos on screen carry the tag
  const tagChoices = useMemo(() => {
    const counts = new Map<string, number>();
    for (const model of models) {
      for (const tag of model.settings.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    for (const tag of tags) if (!counts.has(tag)) counts.set(tag, 0);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, count }));
  }, [models, tags]);
  // Fetch the repos on screen through the helper on the host, then re-read them.
  // Without the helper it still re-reads — the data is just as old as the last fetch.
  const refresh = () =>
    startRefresh(async () => {
      const result = await fetchReposAction(models.map((m) => m.repoId));
      if (!result.ok) {
        toast.warning("Re-read without fetching", { description: result.error });
      } else if (result.failed.length) {
        toast.error(`Fetch failed for ${result.failed.map((f) => f.name).join(", ")}`, {
          description: result.failed[0].error,
        });
      } else if (result.fetched.length) {
        const n = result.fetched.length;
        toast.success(`Fetched ${n} repo${n === 1 ? "" : "s"}`);
      }
      router.refresh();
    });

  // a tag picks repos, so it only means something where several repos are listed
  const showTags = !pathname.startsWith("/repo/") && !pathname.startsWith("/manage");

  return (
    <header className="flex shrink-0 flex-wrap items-center gap-3 border-b bg-background px-6 py-3">
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

        {showTags && (tagChoices.length > 0 || tags.length > 0) && (
          <AuthorFilter
            label="Tag"
            empty="no tags yet"
            options={tagChoices}
            value={tags}
            onChange={setTags}
          />
        )}
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
              aria-label="Fetch from remote and re-read"
              disabled={refreshing}
              onClick={refresh}
            >
              <RefreshCwIcon className={cn("size-4", { "animate-spin": refreshing })} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Fetch from remote and re-read</TooltipContent>
        </Tooltip>

        <CommandPalette />
        <AddRepoDialog />
      </div>
    </header>
  );
}

export default AppHeader;
