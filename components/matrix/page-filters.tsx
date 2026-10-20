"use client";

import { useRouter } from "next/navigation";

import { RefreshCwIcon, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useTransition } from "react";
import { toast } from "sonner";

import InputText from "../ui/input-text";

import AuthorFilter from "./author-filter";
import { useMatrix } from "./matrix-context";
import { authorOptions } from "./shared";

import { fetchReposAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { RepoView } from "@/lib/overview";
import { cn } from "@/lib/utils";

// Options come from the repos on screen, which change while rows stream in and
// when you move between pages — keep a selected author listed even when the
// current page has none of their tickets, or it would filter invisibly.
function authorChoicesOf(models: RepoView[], selected: string[]) {
  const options = authorOptions(models);
  const known = new Set(options.map((o) => o.value));
  return [
    ...options,
    ...selected.filter((a) => !known.has(a)).map((value) => ({ value, count: 0 })),
  ];
}

// count = how many repos on screen carry the tag
function tagChoicesOf(models: RepoView[], selected: string[]) {
  const counts = new Map<string, number>();
  for (const model of models) {
    for (const tag of model.settings.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  for (const tag of selected) if (!counts.has(tag)) counts.set(tag, 0);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, count }));
}

/**
 * Search, tag, author and "Open only", for a page that lists tickets. The values live in the
 * matrix context (and the URL), so they follow you from page to page; only where they are drawn
 * is per page.
 */
export function PageFilters({ showTags = false }: { showTags?: boolean }) {
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

  const authorChoices = useMemo(() => authorChoicesOf(models, authors), [models, authors]);
  const tagChoices = useMemo(() => tagChoicesOf(models, tags), [models, tags]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <InputText
        ref={searchRef}
        type="search"
        placeholder="search ticket / branch / author…"
        startContent={<Search size={18} />}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-8 w-56"
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
    </div>
  );
}

/**
 * Fetch the repos on screen through the helper on the host, then re-read them.
 * Without the helper it still re-reads — the data is just as old as the last fetch.
 */
export function RefreshButton() {
  const router = useRouter();
  const { models } = useMatrix();
  const [refreshing, startRefresh] = useTransition();
  const label =
    models.length === 1 ? "Fetch this repo and re-read" : "Fetch these repos and re-read";

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

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          aria-label={label}
          disabled={refreshing}
          onClick={refresh}
        >
          <RefreshCwIcon className={cn("size-4", { "animate-spin": refreshing })} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
