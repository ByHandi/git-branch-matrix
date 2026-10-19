"use client";

import { useRouter } from "next/navigation";

import {
  ArchiveIcon,
  FolderGit2Icon,
  LayoutListIcon,
  SearchIcon,
  SettingsIcon,
  TagIcon,
  TicketIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useMatrix } from "./matrix-context";
import { ticketLabel } from "./shared";

import { listReposAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { RepoSettings } from "@/lib/db";
import { cn } from "@/lib/utils";

type Item = {
  key: string;
  section: "Go to" | "Repos" | "Tags" | "Tickets";
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
};

const MAX_TICKETS = 8;

/** ⌘K / Ctrl+K: jump to a page, a repo or a ticket without reaching for the mouse. */
function CommandPalette() {
  const router = useRouter();
  const { models, setQuery, setTags, focusTicket } = useMatrix();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const [repos, setRepos] = useState<RepoSettings[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // the page on screen may hold one repo or none, so fetch the full list on open
  useEffect(() => {
    if (!open) return;
    setText("");
    setActive(0);
    listReposAction().then(setRepos);
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const q = text.trim().toLowerCase();
    const hit = (...fields: (string | null | undefined)[]) =>
      !q || fields.some((f) => f?.toLowerCase().includes(q));
    const go = (href: string) => () => router.push(href);

    const pages = (
      [
        { key: "p:/", label: "All repos", icon: LayoutListIcon, run: go("/") },
        { key: "p:/tickets", label: "Tickets across repos", icon: TicketIcon, run: go("/tickets") },
        { key: "p:/manage", label: "Manage repos", icon: SettingsIcon, run: go("/manage") },
      ] as const
    )
      .filter((p) => hit(p.label))
      .map((p): Item => ({ ...p, section: "Go to" }));

    const repoItems: Item[] = repos
      .filter((r) => hit(r.name, r.group, r.path, ...r.tags))
      .map((r) => ({
        key: `r:${r.id}`,
        section: "Repos",
        label: r.name,
        hint: r.archived ? "archived" : (r.group ?? undefined),
        icon: r.archived ? ArchiveIcon : FolderGit2Icon,
        run: go(`/repo/${r.id}`),
      }));

    // Tickets come from the repos already loaded on this page — on the overview
    // that is all of them. The last entry searches every repo on /tickets.
    const ticketItems: Item[] = [];
    if (q.length >= 2) {
      // newest first across every repo, so one big repo can't fill the list alone
      const matches = models
        .flatMap((model) =>
          model.tickets
            .filter((t) => !t.untracked && t.id.toLowerCase().includes(q))
            .map((ticket) => ({ model, ticket })),
        )
        .sort((a, b) => String(b.ticket.date ?? "").localeCompare(String(a.ticket.date ?? "")))
        .slice(0, MAX_TICKETS);

      for (const { model, ticket } of matches) {
        const label = ticketLabel(ticket.id);
        ticketItems.push({
          key: `t:${model.repoId}:${ticket.id}`,
          section: "Tickets",
          label,
          hint: model.repoName,
          icon: TicketIcon,
          run: () => {
            focusTicket(label);
            router.push(`/repo/${model.repoId}`);
          },
        });
      }
      ticketItems.push({
        key: "t:all",
        section: "Tickets",
        label: `Find “${text.trim()}” in every repo`,
        icon: SearchIcon,
        run: () => {
          setQuery(text.trim());
          router.push("/tickets");
        },
      });
    }

    const tagItems: Item[] = [...new Set(repos.flatMap((r) => r.tags))]
      .sort()
      .filter((tag) => q && hit(tag))
      .map((tag) => ({
        key: `g:${tag}`,
        section: "Tags",
        label: `Repos tagged “${tag}”`,
        hint: `${repos.filter((r) => r.tags.includes(tag)).length} repos`,
        icon: TagIcon,
        run: () => {
          setTags([tag]);
          router.push("/");
        },
      }));

    return [...pages, ...repoItems, ...tagItems, ...ticketItems];
  }, [text, repos, models, router, setQuery, setTags, focusTicket]);

  useEffect(() => setActive(0), [text]);

  // keep the highlighted row in view while arrowing through a long list
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const run = (item: Item | undefined) => {
    if (!item) return;
    setOpen(false);
    item.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + items.length) % Math.max(items.length, 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(items[active]);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        aria-label="Open command palette"
        className="gap-1.5 text-muted-foreground"
      >
        <SearchIcon className="size-4" />
        <kbd className="rounded border px-1 font-mono text-[10px]">⌘K</kbd>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogTitle className="sr-only">Command palette</DialogTitle>
          <div className="flex items-center gap-2 border-b px-3">
            <SearchIcon className="size-4 text-muted-foreground" />
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Jump to a repo, page or ticket…"
              aria-label="Search repos, pages and tickets"
              aria-activedescendant={items[active] ? `cmd-${items[active].key}` : undefined}
              role="combobox"
              aria-expanded
              aria-controls="cmd-list"
              className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div ref={listRef} id="cmd-list" role="listbox" className="max-h-80 overflow-y-auto p-1">
            {items.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matches.</p>
            )}
            {items.map((item, i) => (
              <div key={item.key}>
                {item.section !== items[i - 1]?.section && (
                  <p className="px-2 pt-2 pb-1 text-xs text-muted-foreground">{item.section}</p>
                )}
                <div
                  id={`cmd-${item.key}`}
                  role="option"
                  aria-selected={i === active}
                  data-index={i}
                  onMouseMove={() => setActive(i)}
                  onClick={() => run(item)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                    i === active && "bg-accent",
                  )}
                >
                  <item.icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{item.label}</span>
                  {item.hint && (
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {item.hint}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CommandPalette;
