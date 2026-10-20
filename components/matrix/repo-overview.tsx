"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import Ago from "./ago";
import FetchedBadge from "./fetched-badge";
import { useMatrix, useRegisterRepo } from "./matrix-context";
import { PinToggle } from "./repo-toggles";
import { STUCK_DAYS, freshness, matchRepo, openByStage, stuck } from "./shared";
import { TagChip } from "./tags";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import useScrollMemory from "@/hooks/use-scroll-memory";
import type { RepoView } from "@/lib/overview";
import { cn } from "@/lib/utils";

const COLUMNS = 6;
const COLLAPSED_KEY = "gbm.collapsed-sections";

/** Which overview sections are folded shut. Remembered per browser — a convenience, not data. */
const CollapseContext = createContext<{
  collapsed: Set<string>;
  toggle: (section: string) => void;
}>({ collapsed: new Set(), toggle: () => {} });

function useCollapsedSections() {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // read after mount: the server render has no storage, so it must start expanded
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]");
      if (Array.isArray(saved)) setCollapsed(new Set(saved.map(String)));
    } catch {}
  }, []);

  const toggle = useCallback((section: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (!next.delete(section)) next.add(section);
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  }, []);

  return { collapsed, toggle };
}

/**
 * One row per repo. The rows arrive as `children` because each one streams in
 * behind its own Suspense boundary — a slow repo no longer holds up the page.
 */
export function RepoOverview({
  total,
  archived,
  children,
}: {
  total: number;
  archived: number;
  children: React.ReactNode;
}) {
  const { models, query, pendingOnly, authors, tags, filtering, clearFilters } = useMatrix();
  const sections = useCollapsedSections();

  const { open, hidden, stale } = useMemo(() => {
    let open = 0;
    let hidden = 0;
    let stale = 0;
    for (const model of models) {
      if (!model.error && freshness(model.fetchedAt) === "stale") stale++;
      const tickets = matchRepo(model, { query, pendingOnly, authors, tags });
      if (!tickets) hidden++;
      else open += tickets.filter((t) => !t.done).length;
    }
    return { open, hidden, stale };
  }, [models, query, pendingOnly, authors, tags]);

  const loading = total - models.length;
  const scrollRef = useScrollMemory();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-6">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <p>
          {total} repo{total === 1 ? "" : "s"} · {open} open{filtering && " matching the filter"}
          {loading > 0 && ` · reading ${loading} from git…`}
          {stale > 0 && (
            <span className="text-destructive"> · {stale} not fetched in over a week</span>
          )}
        </p>
        <Link href="/manage" className="ml-auto hover:text-foreground hover:underline">
          Manage repos{archived > 0 && ` · ${archived} archived`}
        </Link>
      </div>

      <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card">
        <Table containerRef={scrollRef} containerClassName="min-h-0 overflow-auto">
          <TableHeader sticky>
            <TableRow>
              <TableHead className="pl-4">Repo</TableHead>
              <TableHead className="text-right">Open</TableHead>
              <TableHead>Where open tickets are</TableHead>
              <TableHead title="Newest commit across the repo's tickets">Last commit</TableHead>
              <TableHead>Fetched</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <CollapseContext.Provider value={sections}>
            <TableBody>{children}</TableBody>
          </CollapseContext.Provider>
        </Table>

        {hidden > 0 && (
          <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
            <span>
              {hidden} repo{hidden === 1 ? "" : "s"} hidden — nothing matches the current filter.
            </span>
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={clearFilters}>
              Clear filters
            </Button>
          </footer>
        )}
      </section>
    </div>
  );
}

/** Heading row for Pinned / a group / Other. Folds its rows away on click. */
export function SectionHeading({
  section,
  label,
  repoIds,
}: {
  section: string;
  label: string;
  repoIds: number[];
}) {
  const { collapsed, toggle } = useContext(CollapseContext);
  const { models, query, pendingOnly, authors, tags, filtering } = useMatrix();
  const isCollapsed = collapsed.has(section);

  const { visible, open } = useMemo(() => {
    const ids = new Set(repoIds);
    let visible = 0;
    let open = 0;
    for (const model of models) {
      if (!ids.has(model.repoId)) continue;
      const tickets = matchRepo(model, { query, pendingOnly, authors, tags });
      if (!tickets) continue;
      visible++;
      open += tickets.filter((t) => !t.done).length;
    }
    return { visible, open };
  }, [models, repoIds, query, pendingOnly, authors, tags]);

  // every repo in it is loaded and filtered out: the heading alone is just noise
  const loaded = models.filter((m) => repoIds.includes(m.repoId)).length;
  if (filtering && loaded === repoIds.length && visible === 0) return null;

  const Icon = isCollapsed ? ChevronRightIcon : ChevronDownIcon;

  return (
    <TableRow className="bg-muted/40 hover:bg-muted/60">
      <TableCell colSpan={COLUMNS} className="py-1.5 pl-3">
        <button
          type="button"
          aria-expanded={!isCollapsed}
          onClick={() => toggle(section)}
          className="flex w-full items-center gap-1.5 text-left text-xs"
        >
          <Icon className="size-3.5 text-muted-foreground" />
          <span className="font-semibold">{label}</span>
          <span className="text-muted-foreground">
            {repoIds.length} repo{repoIds.length === 1 ? "" : "s"} · {open} open
          </span>
        </button>
      </TableCell>
    </TableRow>
  );
}

function RepoName({
  name,
  path,
  href,
  tags = [],
  activeTags = [],
  onTag,
}: {
  name: string;
  path: string;
  href?: string;
  tags?: string[];
  activeTags?: string[];
  onTag?: (tag: string) => void;
}) {
  return (
    <TableCell className="py-2.5 pl-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {href ? (
          <Link
            href={href}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-semibold hover:underline"
          >
            {name}
          </Link>
        ) : (
          <span className="text-sm font-semibold">{name}</span>
        )}
        {tags.map((tag) => (
          <TagChip key={tag} tag={tag} active={activeTags.includes(tag)} onClick={onTag} />
        ))}
      </div>
      <div title={path} className="max-w-72 truncate font-mono text-xs text-muted-foreground">
        {path}
      </div>
    </TableCell>
  );
}

export function RepoRow({ model, section }: { model: RepoView; section: string }) {
  useRegisterRepo(model);
  const router = useRouter();
  const { collapsed } = useContext(CollapseContext);
  const { query, pendingOnly, authors, tags, setTags } = useMatrix();

  const matched = useMemo(
    () => matchRepo(model, { query, pendingOnly, authors, tags }),
    [model, query, pendingOnly, authors, tags],
  );
  const tickets = useMemo(() => matched ?? [], [matched]);
  const stages = useMemo(() => openByStage(model, tickets), [model, tickets]);
  const stuckCount = useMemo(() => tickets.filter((t) => stuck(model, t)).length, [model, tickets]);

  if (collapsed.has(section)) return null;
  if (!matched) return null;

  const href = `/repo/${model.repoId}`;
  const open = tickets.filter((t) => !t.done).length;
  const latest = tickets.reduce<string | null>(
    (max, t) => (t.date && (!max || t.date > max) ? t.date : max),
    null,
  );

  return (
    <TableRow className="group cursor-pointer" onClick={() => router.push(href)}>
      <RepoName
        name={model.repoName}
        path={model.repo}
        href={href}
        tags={model.settings.tags}
        activeTags={tags}
        // clicking a tag narrows by it; clicking a selected one lets it go
        onTag={(tag) =>
          setTags(tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag])
        }
      />

      <TableCell className="text-right whitespace-nowrap tabular-nums">
        {model.error ? (
          <span className="text-muted-foreground/40">—</span>
        ) : (
          <>
            <span className={open ? "font-semibold" : "text-muted-foreground"}>{open}</span>
            <span className="text-xs text-muted-foreground"> / {tickets.length}</span>
            {stuckCount > 0 && (
              <div
                className="text-xs text-amber-600 dark:text-amber-400"
                title={`open tickets that have sat in one env for over ${STUCK_DAYS} days`}
              >
                {stuckCount} stuck
              </div>
            )}
          </>
        )}
      </TableCell>

      <TableCell>
        {model.error ? (
          <span className="text-xs text-destructive">{model.error}</span>
        ) : (
          <div className="flex flex-wrap items-center gap-1">
            {[...stages].map(([stage, n], i) => (
              <Fragment key={stage || "-"}>
                {i > 0 && <span className="text-xs text-muted-foreground/40">›</span>}
                <span
                  title={
                    stage
                      ? `${n} open ticket${n === 1 ? "" : "s"} whose furthest env is ${stage}`
                      : `${n} open ticket${n === 1 ? "" : "s"} not merged into any env yet`
                  }
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs",
                    !n && "opacity-40",
                  )}
                >
                  <span className="text-muted-foreground">{stage || "branch only"}</span>
                  <span className="font-semibold tabular-nums">{n}</span>
                </span>
              </Fragment>
            ))}
            {model.missingEnvs.length > 0 && (
              <Badge
                variant="outline"
                className="ml-1"
                title="these environment branches do not exist in this repo"
              >
                missing: {model.missingEnvs.join(", ")}
              </Badge>
            )}
          </div>
        )}
      </TableCell>

      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
        <Ago iso={latest} />
      </TableCell>

      <TableCell>{!model.error && <FetchedBadge fetchedAt={model.fetchedAt} />}</TableCell>

      <TableCell className="pr-4">
        <div className="flex items-center justify-end gap-1">
          <PinToggle
            settings={model.settings}
            className={cn(
              !model.settings.pinned &&
                "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
            )}
          />
          <ChevronRightIcon className="size-4 text-muted-foreground" />
        </div>
      </TableCell>
    </TableRow>
  );
}

/** Shown while a repo is still being read from git — name and path are known up front. */
export function RepoRowSkeleton({
  name,
  path,
  section,
}: {
  name: string;
  path: string;
  section: string;
}) {
  const { collapsed } = useContext(CollapseContext);
  if (collapsed.has(section)) return null;

  return (
    <TableRow>
      <RepoName name={name} path={path} />
      <TableCell>
        <Skeleton className="ml-auto h-4 w-10" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-5 w-72" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-14" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-20" />
      </TableCell>
      <TableCell />
    </TableRow>
  );
}
