import type { Ticket } from "@/lib/git";
import type { RepoView } from "@/lib/overview";
import { pullRequestUrl } from "@/lib/remote";
import { hasTags } from "@/lib/tags";

/**
 * "14h ago". With `now` (a live client clock) it goes down to minutes; without
 * it, on the server and while hydrating, it stays at whole days so both sides
 * render the same text.
 */
export function ago(iso: string | null, now?: number | null): string {
  if (!iso) return "";
  const ms = (now ?? Date.now()) - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days < 1) {
    if (now == null) return "today";
    const minutes = Math.floor(ms / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  }
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

export type Freshness = "fresh" | "aging" | "stale";

/** How far a repo's remote branches may lag, judged by its last `git fetch`. */
export function freshness(fetchedAt: string | null): Freshness {
  if (!fetchedAt) return "stale";
  const days = (Date.now() - new Date(fetchedAt).getTime()) / 86_400_000;
  return days > 7 ? "stale" : days > 1 ? "aging" : "fresh";
}

export const ticketLabel = (id: string) => id.replace("(no-ticket) ", "");

/** The ticket's page in the issue tracker, or null — a branch with no ticket ID has none. */
export function ticketHref(model: Pick<RepoView, "ticketUrl">, ticket: Ticket): string | null {
  if (!model.ticketUrl || ticket.untracked) return null;
  return model.ticketUrl.replaceAll("{ticket}", encodeURIComponent(ticket.id));
}

export type SortKey = "date" | "ticket" | "reach" | "author";
export type SortDir = "asc" | "desc";
export type Sort = { key: SortKey; dir: SortDir };

/** Most recently touched first — what you almost always want when scanning. */
export const DEFAULT_SORT: Sort = { key: "date", dir: "desc" };

export const PAGE_SIZES = [25, 50, 100, 250] as const;
export const DEFAULT_PAGE_SIZE = 25;

export function filterTickets(
  model: RepoView,
  query: string,
  pendingOnly: boolean,
  authors: string[] = [],
): Ticket[] {
  const wanted = new Set(authors);
  let q = query.trim().toLowerCase();
  // typing a repo's name means "show me that repo", not "find tickets named so"
  if (q && model.repoName.toLowerCase().includes(q)) q = "";

  return model.tickets
    .filter((t) => !(pendingOnly && t.done))
    .filter((t) => !wanted.size || t.authors.some((a) => wanted.has(a)))
    .filter(
      (t) =>
        !q ||
        t.id.toLowerCase().includes(q) ||
        t.branches.some((b) => b.toLowerCase().includes(q)) ||
        t.authors.some((a) => a.toLowerCase().includes(q)),
    );
}

export type Filters = { query: string; pendingOnly: boolean; authors: string[]; tags: string[] };

/**
 * The repo's tickets that pass every filter, or null when the repo itself is
 * filtered out: it lacks a selected tag, or a ticket filter is on and nothing
 * matches. A tag filter alone keeps a repo with no tickets at all visible.
 */
export function matchRepo(model: RepoView, f: Filters): Ticket[] | null {
  if (!hasTags(model.settings.tags, f.tags)) return null;
  const tickets = filterTickets(model, f.query, f.pendingOnly, f.authors);
  const narrowing = Boolean(f.query.trim()) || f.pendingOnly || f.authors.length > 0;
  return narrowing && tickets.length === 0 ? null : tickets;
}

export function sortTickets(tickets: Ticket[], sort: Sort): Ticket[] {
  const factor = sort.dir === "asc" ? 1 : -1;

  return [...tickets].sort((a, b) => {
    switch (sort.key) {
      case "ticket":
        // numeric so SLM-9 sorts before SLM-10
        return factor * a.id.localeCompare(b.id, undefined, { numeric: true });
      case "author": {
        const an = a.authors[0] ?? "";
        const bn = b.authors[0] ?? "";
        // branches with no known author sink to the bottom either way
        if (!an !== !bn) return an ? -1 : 1;
        return factor * an.localeCompare(bn) || String(b.date).localeCompare(String(a.date));
      }
      case "reach":
        return factor * (a.reach - b.reach) || String(b.date).localeCompare(String(a.date));
      case "date":
      default:
        return factor * String(a.date ?? "").localeCompare(String(b.date ?? ""));
    }
  });
}

/** Every author seen across all repos, with how many tickets each one touched. */
export function authorOptions(models: RepoView[]) {
  const counts = new Map<string, number>();
  for (const model of models) {
    for (const ticket of model.tickets) {
      for (const author of ticket.authors) counts.set(author, (counts.get(author) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, count }));
}

/**
 * Open tickets grouped by the furthest env each one has reached, in pipeline
 * order. The "" key holds tickets not merged into any env yet.
 */
export function openByStage(model: RepoView, tickets: Ticket[]) {
  const counts = new Map<string, number>([["", 0], ...model.envs.map((e) => [e, 0] as const)]);
  for (const ticket of tickets) {
    if (ticket.done) continue;
    let stage = "";
    for (const env of model.envs) if (ticket.envs[env]) stage = env;
    counts.set(stage, (counts.get(stage) ?? 0) + 1);
  }
  return counts;
}

export const STUCK_DAYS = 7;

/**
 * How long an open ticket has sat in its furthest env without moving on, when
 * that is past STUCK_DAYS — otherwise null. Null too when git can't date the
 * merge (a branch merged without a merge commit has no date to go by).
 */
export function stuck(model: RepoView, ticket: Ticket): { env: string; days: number } | null {
  if (ticket.done) return null;
  let env: string | null = null;
  for (const e of model.envs) if (ticket.envs[e]) env = e;
  const since = env && ticket.envs[env].date;
  if (!env || !since) return null;
  const days = Math.floor((Date.now() - new Date(since).getTime()) / 86_400_000);
  return days > STUCK_DAYS ? { env, days } : null;
}

/**
 * Where a "create PR" link for this ticket/env should point, or null when there
 * is nothing sensible to link to: already merged, no usable remote, the branch
 * is gone, or the ticket spans several live branches so the head is ambiguous.
 */
export function prTarget(model: RepoView, ticket: Ticket, env: string) {
  if (ticket.envs[env]) return null;
  if (!model.remote) return null;

  const live = ticket.branches.filter((name) =>
    model.branches.some((b) => b.name === name && b.live),
  );
  if (live.length !== 1) return null;

  const url = pullRequestUrl(model.remote, env, live[0]);
  return url ? { url, head: live[0] } : null;
}

/** Same thing for one specific branch, used by the detail panel. */
export function branchPrUrl(model: RepoView, branch: string, env: string) {
  return model.remote ? pullRequestUrl(model.remote, env, branch) : null;
}
