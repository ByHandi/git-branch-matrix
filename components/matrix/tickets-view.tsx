"use client";

import { useRouter } from "next/navigation";

import { CheckIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useMatrix, useRegisterRepos } from "./matrix-context";
import { ago, filterTickets, ticketLabel } from "./shared";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Ticket } from "@/lib/git";
import type { RepoView } from "@/lib/overview";
import { cn } from "@/lib/utils";

type Entry = { model: RepoView; ticket: Ticket; stage: string | null };

const isPartial = (c: CrossTicket) => c.doneIn > 0 && c.doneIn < c.entries.length;

type CrossTicket = {
  id: string;
  entries: Entry[];
  doneIn: number;
  authors: string[];
  date: string | null;
};

const PAGE = 50;

/** Furthest env the ticket reached in this repo, or null when it is merged nowhere yet. */
function stageOf(model: RepoView, ticket: Ticket) {
  let stage: string | null = null;
  for (const env of model.envs) if (ticket.envs[env]) stage = env;
  return stage;
}

/** One entry per ticket id, collecting that ticket from every repo it appears in. */
function crossTickets(models: RepoView[]): CrossTicket[] {
  const byId = new Map<string, CrossTicket>();
  for (const model of models) {
    for (const ticket of model.tickets) {
      // "no ticket" rows are per-branch; sharing a branch name across repos means nothing
      if (ticket.untracked) continue;
      const cross = byId.get(ticket.id) ?? {
        id: ticket.id,
        entries: [],
        doneIn: 0,
        authors: [],
        date: null,
      };
      cross.entries.push({ model, ticket, stage: stageOf(model, ticket) });
      if (ticket.done) cross.doneIn++;
      for (const a of ticket.authors) if (!cross.authors.includes(a)) cross.authors.push(a);
      if (ticket.date && (!cross.date || ticket.date > cross.date)) cross.date = ticket.date;
      byId.set(ticket.id, cross);
    }
  }
  return [...byId.values()].sort((a, b) =>
    String(b.date ?? "").localeCompare(String(a.date ?? "")),
  );
}

function Status({ cross }: { cross: CrossTicket }) {
  const total = cross.entries.length;
  if (cross.doneIn === total)
    return <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">done</span>;
  if (cross.doneIn > 0)
    return (
      <span
        className="text-xs font-medium text-amber-600 dark:text-amber-400"
        title="shipped in some repos but not all of them"
      >
        partial {cross.doneIn}/{total}
      </span>
    );
  return <span className="text-xs text-muted-foreground">open</span>;
}

function TicketsView({ models }: { models: RepoView[] }) {
  useRegisterRepos(models);
  const router = useRouter();
  const { query, focusTicket, pendingOnly, authors, filtering, clearFilters } = useMatrix();
  const [multiOnly, setMultiOnly] = useState(false);
  const [partialOnly, setPartialOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const all = useMemo(() => crossTickets(models), [models]);

  const visible = useMemo(() => {
    // Match per repo with the usual filter, then keep the whole ticket if any of
    // its repos matched — an author filter should not hide the other half of it.
    const matched = new Set<string>();
    for (const model of models) {
      for (const t of filterTickets(model, query, false, authors))
        matched.add(`${model.repoId}:${t.id}`);
    }
    return all.filter(
      (cross) =>
        cross.entries.some((e) => matched.has(`${e.model.repoId}:${e.ticket.id}`)) &&
        !(pendingOnly && cross.doneIn === cross.entries.length) &&
        !(multiOnly && cross.entries.length < 2),
    );
  }, [all, models, query, authors, pendingOnly, multiOnly]);

  const partial = visible.filter(isPartial).length;
  // the toggle stays usable after the last partial ticket is filtered away
  const listed = partialOnly ? visible.filter(isPartial) : visible;

  useEffect(() => setLimit(PAGE), [query, authors, pendingOnly, multiOnly, partialOnly]);

  const shown = listed.slice(0, limit);

  // jump to the repo with the search narrowed to this ticket
  const open = (entry: Entry) => {
    focusTicket(ticketLabel(entry.ticket.id));
    router.push(`/repo/${entry.model.repoId}`);
  };

  return (
    <div className="flex flex-col gap-3 p-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
        <p>
          {listed.length} ticket{listed.length === 1 ? "" : "s"} across {models.length} repo
          {models.length === 1 ? "" : "s"}
          {(partial > 0 || partialOnly) && (
            <>
              {" · "}
              <button
                type="button"
                aria-pressed={partialOnly}
                onClick={() => setPartialOnly((v) => !v)}
                className="text-amber-600 underline-offset-2 hover:underline dark:text-amber-400"
              >
                {partialOnly
                  ? "showing only the partly shipped — show all"
                  : `${partial} shipped in only some of their repos`}
              </button>
            </>
          )}
        </p>
        <Button
          size="sm"
          variant={multiOnly ? "secondary" : "outline"}
          aria-pressed={multiOnly}
          className="ml-auto h-7 text-xs"
          onClick={() => setMultiOnly((v) => !v)}
        >
          In 2+ repos only
        </Button>
      </div>

      <section className="rounded-xl border bg-card">
        {shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-16 text-sm text-muted-foreground">
            nothing matches
            {filtering && (
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Ticket</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Where it is, per repo</TableHead>
                <TableHead>Author</TableHead>
                <TableHead className="pr-4">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((cross) => (
                <TableRow key={cross.id}>
                  <TableCell className="pl-4 align-top font-mono text-xs font-semibold">
                    {ticketLabel(cross.id)}
                  </TableCell>
                  <TableCell className="align-top">
                    <Status cross={cross} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {cross.entries.map((entry) => (
                        <button
                          key={entry.model.repoId}
                          type="button"
                          onClick={() => open(entry)}
                          title={`Open ${entry.model.repoName}, filtered to this ticket`}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs hover:bg-accent",
                            entry.ticket.done && "border-emerald-600/40",
                          )}
                        >
                          <span>{entry.model.repoName}</span>
                          <span className="text-muted-foreground">
                            {entry.stage ?? "branch only"}
                          </span>
                          {entry.ticket.done && (
                            <CheckIcon className="size-3 text-emerald-600 dark:text-emerald-400" />
                          )}
                        </button>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="align-top text-xs">
                    {cross.authors.join(", ") || (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-4 align-top text-xs whitespace-nowrap text-muted-foreground">
                    {ago(cross.date)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {listed.length > limit && (
          <footer className="flex justify-center border-t px-4 py-2">
            <Button size="sm" variant="ghost" onClick={() => setLimit((n) => n + PAGE)}>
              Show {Math.min(PAGE, listed.length - limit)} more of {listed.length - limit}
            </Button>
          </footer>
        )}
      </section>
    </div>
  );
}

export default TicketsView;
