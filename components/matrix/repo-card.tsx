"use client";

import { ArrowDownIcon, ArrowUpIcon, Check, ChevronsUpDownIcon, PencilLine } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Tooltip from "../shared/tooltip";

import Ago from "./ago";
import EditRepoDialog from "./edit-repo-dialog";
import FetchedBadge from "./fetched-badge";
import { useMatrix } from "./matrix-context";
import { ArchiveToggle, PinToggle } from "./repo-toggles";
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT,
  PAGE_SIZES,
  type Sort,
  type SortKey,
  filterTickets,
  prTarget,
  sortTickets,
  stuck,
  ticketLabel,
} from "./shared";
import { TagChip } from "./tags";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import useScrollMemory from "@/hooks/use-scroll-memory";
import { useTimeZone } from "@/hooks/use-time-zone";
import type { MergeCell, Ticket } from "@/lib/git";
import type { RepoView } from "@/lib/overview";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";

type Props = {
  model: RepoView;
  query: string;
  pendingOnly: boolean;
  authors: string[];
  onSelect: (model: RepoView, ticket: Ticket) => void;
  onAuthorClick: (author: string) => void;
  /** existing group names, suggested in the edit dialog */
  groups?: string[];
  /** existing tags, suggested in the edit dialog */
  tagSuggestions?: string[];
};

export interface SortHeadProps {
  label: string;
  sortKey: SortKey;
  sort: Sort;
  onSort: (key: SortKey) => void;
  className?: string;
  title?: string;
}

function SortHead({ label, sortKey, sort, onSort, className, title }: SortHeadProps) {
  const active = sort.key === sortKey;
  const Icon = !active ? ChevronsUpDownIcon : sort.dir === "asc" ? ArrowUpIcon : ArrowDownIcon;

  return (
    <TableHead className={className} title={title}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          active && "text-foreground",
        )}
      >
        {label}
        <Icon className={cn("size-3", !active && "opacity-40")} />
      </button>
    </TableHead>
  );
}

function mergedTitle(env: string, cell: MergeCell, timeZone: string) {
  const when = cell.date
    ? formatDateTime(cell.date, timeZone)
    : "date unknown (merged without a merge commit)";
  return `Merged into ${env} · ${when}${cell.via ? ` via ${cell.via}` : ""}`;
}

function StuckBadge({ model, ticket }: { model: RepoView; ticket: Ticket }) {
  const info = stuck(model, ticket);
  if (!info) return null;
  return (
    <Badge
      variant="outline"
      className="ml-2 border-amber-500/40 text-amber-600 dark:text-amber-400"
      title={`In ${info.env} for ${info.days} days without moving on`}
    >
      stuck {info.days}d
    </Badge>
  );
}

function RepoCard(props: Props) {
  const { model, query, pendingOnly, authors, onSelect, onAuthorClick, groups, tagSuggestions } =
    props;

  const { navigate } = useMatrix();
  const timeZone = useTimeZone();
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const remember = useScrollMemory();
  const scroller = useRef<HTMLDivElement | null>(null);
  const scrollRef = useCallback(
    (el: HTMLDivElement | null) => {
      scroller.current = el;
      return remember(el);
    },
    [remember],
  );

  const filtered = useMemo(
    () => filterTickets(model, query, pendingOnly, authors),
    [model, query, pendingOnly, authors],
  );
  const sorted = useMemo(() => sortTickets(filtered, sort), [filtered, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  // a narrowed filter can leave you on a page that no longer exists
  useEffect(() => setPage(1), [query, pendingOnly, authors, sort, pageSize]);
  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  const visible = sorted.slice(start, start + pageSize);

  // the list scrolls on its own now, so a new page would otherwise open mid-way down
  const goTo = (next: number) => {
    setPage(next);
    scroller.current?.scrollTo({ top: 0 });
  };

  const toggleSort = (key: SortKey) =>
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "ticket" ? "asc" : "desc" },
    );

  const unfinished = model.tickets.filter((t) => !t.done).length;

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{model.repoName}</h2>
        <span className="font-mono text-xs text-muted-foreground">{model.repo}</span>
        {model.settings.tags.map((tag) => (
          <TagChip
            key={tag}
            tag={tag}
            onClick={(t) => {
              navigate("/", { tags: [t] });
            }}
          />
        ))}
        {!model.error && <FetchedBadge fetchedAt={model.fetchedAt} />}

        {!model.error && (
          <Badge variant="secondary">
            {unfinished} open / {model.tickets.length} tickets
          </Badge>
        )}
        {model.missingEnvs.length > 0 && (
          <Badge variant="outline" title="these environment branches do not exist in this repo">
            missing: {model.missingEnvs.join(", ")}
          </Badge>
        )}

        {model.settings.archived && <Badge variant="outline">archived</Badge>}

        <div className="ml-auto flex items-center gap-1">
          <PinToggle settings={model.settings} />
          <EditRepoDialog settings={model.settings} groups={groups} tags={tagSuggestions}>
            <Tooltip description={`Edit ${model.repo}`}>
              <Button size="icon-sm" variant="ghost">
                <PencilLine className="size-4" />
              </Button>
            </Tooltip>
          </EditRepoDialog>
          <ArchiveToggle settings={model.settings} />
        </div>
      </header>

      {model.error ? (
        <p className="px-4 py-8 text-center text-sm text-destructive">{model.error}</p>
      ) : sorted.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">nothing matches</p>
      ) : (
        <>
          <Table containerRef={scrollRef} containerClassName="min-h-0 overflow-auto">
            <TableHeader sticky>
              <TableRow>
                <SortHead label="Ticket" sortKey="ticket" sort={sort} onSort={toggleSort} />
                <TableHead>Branch</TableHead>
                <SortHead label="Author" sortKey="author" sort={sort} onSort={toggleSort} />
                {model.envs.map((env, i) => {
                  const counts = model.doneEnvs.includes(env);
                  return (
                    <TableHead
                      key={env}
                      className={cn("text-center", !counts && "font-normal opacity-70")}
                      title={
                        counts
                          ? "counts toward done"
                          : "shown for progress, but does not decide done"
                      }
                    >
                      {i === 0 ? (
                        <button
                          type="button"
                          onClick={() => toggleSort("reach")}
                          className={cn(
                            "hover:text-foreground",
                            sort.key === "reach" && "text-foreground",
                          )}
                          title="Sort by how far the ticket has travelled"
                        >
                          {env}
                        </button>
                      ) : (
                        env
                      )}
                    </TableHead>
                  );
                })}
                <SortHead
                  label="Last commit"
                  title="Newest commit on the ticket's branches — not when it was merged; hover a ✓ for that"
                  sortKey="date"
                  sort={sort}
                  onSort={toggleSort}
                />
              </TableRow>
            </TableHeader>

            <TableBody>
              {visible.map((ticket) => (
                <TableRow
                  key={ticket.id}
                  className="cursor-pointer"
                  onClick={() => onSelect(model, ticket)}
                >
                  <TableCell>
                    <span
                      className={cn(
                        "font-mono text-xs",
                        ticket.done || ticket.untracked ? "text-muted-foreground" : "font-semibold",
                      )}
                    >
                      {ticketLabel(ticket.id)}
                    </span>
                    {ticket.untracked && (
                      <Badge variant="outline" className="ml-2">
                        no ticket
                      </Badge>
                    )}
                    <StuckBadge model={model} ticket={ticket} />
                    {ticket.combined && (
                      <Badge variant="secondary" className="ml-2" title="combined branch">
                        ⧉ combined
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell className="space-y-0.5">
                    {ticket.branches.map((name) => {
                      const branch = model.branches.find((b) => b.name === name);
                      return (
                        <div
                          key={name}
                          title={branch?.live ? undefined : "branch has been deleted"}
                          className={cn(
                            "font-mono text-xs text-muted-foreground",
                            !branch?.live && "line-through opacity-70",
                          )}
                        >
                          {name}
                        </div>
                      );
                    })}
                  </TableCell>

                  <TableCell className="text-xs whitespace-nowrap">
                    {ticket.authors.length ? (
                      ticket.authors.map((author, i) => (
                        <span key={author}>
                          {i > 0 && ", "}
                          <button
                            type="button"
                            title={`Filter to ${author} only`}
                            className="hover:text-foreground hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAuthorClick(author);
                            }}
                          >
                            {author}
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </TableCell>

                  {model.envs.map((env) => {
                    const cell = ticket.envs[env];
                    const pr = cell ? null : prTarget(model, ticket, env);
                    return (
                      <TableCell key={env} className="text-center">
                        {cell ? (
                          <span
                            className="flex items-center gap-1 font-medium"
                            title={mergedTitle(env, cell, timeZone)}
                          >
                            <Check className="size-4 text-emerald-600 dark:text-emerald-400" />

                            {cell.pr ? (
                              <span className="text-xs font-normal text-muted-foreground">
                                #{cell.pr}
                              </span>
                            ) : null}
                          </span>
                        ) : pr ? (
                          <a
                            href={pr.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title={`Open a pull request: ${pr.head} → ${env}`}
                            className="group/pr inline-flex w-12 justify-center"
                          >
                            <span className="text-muted-foreground/40 group-hover/pr:hidden">
                              ·
                            </span>
                            <span className="hidden text-xs font-medium text-sky-600 group-hover/pr:inline dark:text-sky-400">
                              + PR
                            </span>
                          </a>
                        ) : (
                          <span className="inline-flex w-12 justify-center text-muted-foreground/40">
                            ·
                          </span>
                        )}
                      </TableCell>
                    );
                  })}

                  <TableCell className="text-xs text-muted-foreground">
                    <Ago iso={ticket.date} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <footer className="flex shrink-0 flex-wrap items-center gap-3 border-t px-4 py-2 text-xs text-muted-foreground">
            <span>
              {start + 1}–{Math.min(start + pageSize, sorted.length)} of {sorted.length}
              {sorted.length !== model.tickets.length && ` (filtered from ${model.tickets.length})`}
            </span>

            <div className="flex items-center gap-1">
              <span>per page</span>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger size="sm" className="h-7 w-18">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="ml-auto flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                disabled={current <= 1}
                onClick={() => goTo(current - 1)}
              >
                ‹ Prev
              </Button>
              <span className="px-1">
                {current} / {pageCount}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={current >= pageCount}
                onClick={() => goTo(current + 1)}
              >
                Next ›
              </Button>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}

export default RepoCard;
