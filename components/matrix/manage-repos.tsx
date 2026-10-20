"use client";

import Link from "next/link";

import { GripVerticalIcon, PencilIcon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import BackLink from "./back-link";
import EditRepoDialog from "./edit-repo-dialog";
import { ArchiveToggle, PinToggle } from "./repo-toggles";
import { TagInput } from "./tags";

import { patchRepoAction, reorderReposAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RepoSettings } from "@/lib/db";
import { cn } from "@/lib/utils";

type Section = { key: string; label: string; items: RepoSettings[] };

/** Same order as the overview, plus the archived repos it leaves out. */
function sectionsOf(items: RepoSettings[]): Section[] {
  const live = items.filter((r) => !r.archived);
  const groups = [...new Set(live.flatMap((r) => (!r.pinned && r.group ? [r.group] : [])))].sort(
    (a, b) => a.localeCompare(b),
  );
  return [
    { key: "pinned", label: "Pinned", items: live.filter((r) => r.pinned) },
    ...groups.map((g) => ({
      key: `group:${g}`,
      label: g,
      items: live.filter((r) => !r.pinned && r.group === g),
    })),
    { key: "other", label: "Ungrouped", items: live.filter((r) => !r.pinned && !r.group) },
    { key: "archived", label: "Archived", items: items.filter((r) => r.archived) },
  ].filter((s) => s.items.length);
}

/** `list` with `id` placed just before (or after) `targetId`. */
function moved(list: RepoSettings[], id: number, targetId: number, after: boolean) {
  if (id === targetId) return list;
  const moving = list.find((r) => r.id === id)!;
  const rest = list.filter((r) => r.id !== id);
  const at = rest.findIndex((r) => r.id === targetId) + (after ? 1 : 0);
  return [...rest.slice(0, at), moving, ...rest.slice(at)];
}

function GroupField({
  repo,
  onMove,
}: {
  repo: RepoSettings;
  /** move the row to its new section right away, before the save round-trips */
  onMove: (group: string | null) => void;
}) {
  const [value, setValue] = useState(repo.group ?? "");
  const [, startTransition] = useTransition();
  useEffect(() => setValue(repo.group ?? ""), [repo.group]);

  const commit = () => {
    const group = value.trim() || null;
    if (group === repo.group) return;
    onMove(group);
    startTransition(async () => {
      await patchRepoAction(repo.id, { group });
      toast.success(group ? `Moved to "${group}"` : "Removed from its group");
    });
  };

  return (
    <Input
      aria-label={`Group of ${repo.name}`}
      placeholder="no group"
      list="manage-groups"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      className="h-7 w-36 text-xs"
      disabled={repo.archived}
    />
  );
}

function ManageRepos({ repos }: { repos: RepoSettings[] }) {
  const [items, setItems] = useState(repos);
  // only a press on the handle makes a row draggable, so the inputs stay selectable
  const [armed, setArmed] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  // the server is the source of truth after every save
  useEffect(() => setItems(repos), [repos]);

  const sections = sectionsOf(items);
  const groups = [...new Set(repos.flatMap((r) => (r.group ? [r.group] : [])))].sort();
  const allTags = [...new Set(items.flatMap((r) => r.tags))].sort();

  const saveTags = (repo: RepoSettings, tags: string[]) => {
    setItems((prev) => prev.map((r) => (r.id === repo.id ? { ...r, tags } : r)));
    startTransition(async () => {
      await patchRepoAction(repo.id, { tags });
    });
  };

  const persist = (next: RepoSettings[]) =>
    startTransition(async () => {
      await reorderReposAction(sectionsOf(next).flatMap((s) => s.items.map((r) => r.id)));
    });

  const move = (id: number, targetId: number, after: boolean) =>
    setItems((prev) => moved(prev, id, targetId, after));

  const nudge = (section: Section, id: number, delta: -1 | 1) => {
    const target = section.items[section.items.findIndex((r) => r.id === id) + delta];
    if (!target) return;
    const next = moved(items, id, target.id, delta === 1);
    setItems(next);
    persist(next);
  };

  return (
    <div className="flex flex-col gap-3 p-6">
      <BackLink />

      <div>
        <h2 className="text-sm font-semibold">Manage repos</h2>
        <p className="text-xs text-muted-foreground">
          Drag the handle (or focus it and press ↑ ↓) to reorder within a section. Typing a group
          name moves the repo into that section; tags are free-form labels to filter by.
        </p>
      </div>

      <datalist id="manage-groups">
        {groups.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>

      {items.length === 0 && (
        <p className="rounded-xl border bg-card px-4 py-16 text-center text-sm text-muted-foreground">
          No repos tracked yet.
        </p>
      )}

      {sections.map((section) => (
        <section key={section.key} className="rounded-xl border bg-card">
          <header className="border-b px-4 py-2 text-xs">
            <span className="font-semibold">{section.label}</span>
            <span className="text-muted-foreground"> · {section.items.length}</span>
          </header>

          <ul>
            {section.items.map((repo) => (
              <li
                key={repo.id}
                draggable={armed === repo.id}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  setDragging(repo.id);
                }}
                onDragOver={(e) => {
                  if (dragging === null || !section.items.some((r) => r.id === dragging)) return;
                  e.preventDefault();
                  const box = e.currentTarget.getBoundingClientRect();
                  move(dragging, repo.id, e.clientY > box.top + box.height / 2);
                }}
                onDrop={(e) => e.preventDefault()}
                onDragEnd={() => {
                  setDragging(null);
                  setArmed(null);
                  persist(items);
                }}
                className={cn(
                  "flex flex-wrap items-center gap-3 border-b px-2 py-2 last:border-b-0",
                  dragging === repo.id && "opacity-40",
                  repo.archived && "text-muted-foreground",
                )}
              >
                <button
                  type="button"
                  aria-label={`Reorder ${repo.name}`}
                  disabled={repo.archived}
                  onPointerDown={() => setArmed(repo.id)}
                  onPointerUp={() => setArmed(null)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                      e.preventDefault();
                      nudge(section, repo.id, e.key === "ArrowUp" ? -1 : 1);
                    }
                  }}
                  className="cursor-grab rounded p-1 text-muted-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:invisible"
                >
                  <GripVerticalIcon className="size-4" />
                </button>

                <div className="min-w-0 flex-1">
                  <Link href={`/repo/${repo.id}`} className="text-sm font-medium hover:underline">
                    {repo.name}
                  </Link>
                  <div className="truncate font-mono text-xs text-muted-foreground">
                    {repo.path}
                  </div>
                </div>

                <GroupField
                  repo={repo}
                  onMove={(group) =>
                    setItems((prev) => prev.map((r) => (r.id === repo.id ? { ...r, group } : r)))
                  }
                />

                <TagInput
                  aria-label={`Tags of ${repo.name}`}
                  value={repo.tags}
                  onChange={(tags) => saveTags(repo, tags)}
                  suggestions={allTags}
                  placeholder="tags"
                  className="w-56"
                />

                <div className="flex items-center gap-1">
                  {!repo.archived && <PinToggle settings={repo} />}
                  <EditRepoDialog settings={repo} groups={groups} tags={allTags}>
                    <Button size="sm" variant="ghost">
                      <PencilIcon className="size-4" />
                      Edit
                    </Button>
                  </EditRepoDialog>
                  <ArchiveToggle settings={repo} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default ManageRepos;
