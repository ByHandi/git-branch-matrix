"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ChevronRightIcon } from "lucide-react";
import { Fragment, useMemo } from "react";

import FetchedBadge from "./fetched-badge";
import { useMatrix, useRegisterRepo } from "./matrix-context";
import { ago, filterTickets, freshness, openByStage } from "./shared";

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
import type { RepoView } from "@/lib/overview";
import { cn } from "@/lib/utils";

/**
 * One row per repo. The rows arrive as `children` because each one streams in
 * behind its own Suspense boundary — a slow repo no longer holds up the page.
 */
export function RepoOverview({ total, children }: { total: number; children: React.ReactNode }) {
  const { models, query, pendingOnly, authors, filtering, clearFilters } = useMatrix();

  const { open, hidden, stale } = useMemo(() => {
    let open = 0;
    let hidden = 0;
    let stale = 0;
    for (const model of models) {
      if (!model.error && freshness(model.fetchedAt) === "stale") stale++;
      const tickets = filterTickets(model, query, pendingOnly, authors);
      open += tickets.filter((t) => !t.done).length;
      if (filtering && tickets.length === 0) hidden++;
    }
    return { open, hidden, stale };
  }, [models, query, pendingOnly, authors, filtering]);

  const loading = total - models.length;

  return (
    <div className="flex flex-col gap-3 p-6">
      <p className="text-xs text-muted-foreground">
        {total} repo{total === 1 ? "" : "s"} · {open} open{filtering && " matching the filter"}
        {loading > 0 && ` · reading ${loading} from git…`}
        {stale > 0 && (
          <span className="text-destructive"> · {stale} not fetched in over a week</span>
        )}
      </p>

      <section className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Repo</TableHead>
              <TableHead className="text-right">Open</TableHead>
              <TableHead>Where open tickets are</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead>Fetched</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>{children}</TableBody>
        </Table>

        {hidden > 0 && (
          <footer className="flex flex-wrap items-center gap-2 border-t px-4 py-2 text-xs text-muted-foreground">
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

function RepoName({ name, path, href }: { name: string; path: string; href?: string }) {
  return (
    <TableCell className="py-2.5 pl-4">
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
      <div className="font-mono text-xs text-muted-foreground">{path}</div>
    </TableCell>
  );
}

export function RepoRow({ model }: { model: RepoView }) {
  useRegisterRepo(model);
  const router = useRouter();
  const { query, pendingOnly, authors, filtering } = useMatrix();

  const tickets = useMemo(
    () => filterTickets(model, query, pendingOnly, authors),
    [model, query, pendingOnly, authors],
  );
  const stages = useMemo(() => openByStage(model, tickets), [model, tickets]);

  if (filtering && tickets.length === 0) return null;

  const href = `/repo/${model.repoId}`;
  const open = tickets.filter((t) => !t.done).length;
  const latest = tickets.reduce<string | null>(
    (max, t) => (t.date && (!max || t.date > max) ? t.date : max),
    null,
  );

  return (
    <TableRow className="cursor-pointer" onClick={() => router.push(href)}>
      <RepoName name={model.repoName} path={model.repo} href={href} />

      <TableCell className="text-right whitespace-nowrap tabular-nums">
        {model.error ? (
          <span className="text-muted-foreground/40">—</span>
        ) : (
          <>
            <span className={open ? "font-semibold" : "text-muted-foreground"}>{open}</span>
            <span className="text-xs text-muted-foreground"> / {tickets.length}</span>
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
        {ago(latest)}
      </TableCell>

      <TableCell>{!model.error && <FetchedBadge fetchedAt={model.fetchedAt} />}</TableCell>

      <TableCell className="pr-4">
        <ChevronRightIcon className="size-4 text-muted-foreground" />
      </TableCell>
    </TableRow>
  );
}

/** Shown while a repo is still being read from git — name and path are known up front. */
export function RepoRowSkeleton({ name, path }: { name: string; path: string }) {
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
