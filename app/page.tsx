import Link from "next/link";

import { Fragment, Suspense } from "react";

import AddRepoDialog from "@/components/matrix/add-repo-dialog";
import {
  RepoOverview,
  RepoRow,
  RepoRowSkeleton,
  SectionHeading,
} from "@/components/matrix/repo-overview";
import { type RepoRow as RepoRecord, listRepos } from "@/lib/db";
import { loadRepo } from "@/lib/overview";

// Git state changes every time you merge — never serve this from the cache.
export const dynamic = "force-dynamic";

async function LoadedRow({ row, section }: { row: RepoRecord; section: string }) {
  return <RepoRow model={await loadRepo(row)} section={section} />;
}

type Section = { key: string; label: string | null; rows: RepoRecord[] };

/**
 * Pinned first, then one section per group (A–Z), then everything ungrouped.
 * With no pins and no groups there is a single unlabelled section, so a small
 * setup still looks like a plain list.
 */
function sectionsOf(repos: RepoRecord[]): Section[] {
  const pinned = repos.filter((r) => r.pinned);
  const groups = new Map<string, RepoRecord[]>();
  const other: RepoRecord[] = [];

  for (const repo of repos) {
    if (repo.pinned) continue;
    if (repo.group_name)
      groups.set(repo.group_name, [...(groups.get(repo.group_name) ?? []), repo]);
    else other.push(repo);
  }

  const labelled = pinned.length > 0 || groups.size > 0;
  return [
    ...(pinned.length ? [{ key: "pinned", label: "Pinned", rows: pinned }] : []),
    ...[...groups.keys()]
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ key: `group:${name}`, label: name, rows: groups.get(name)! })),
    ...(other.length ? [{ key: "other", label: labelled ? "Other" : null, rows: other }] : []),
  ];
}

export default async function Page() {
  const all = await listRepos(true);
  const repos = all.filter((r) => !r.archived);
  const archived = all.length - repos.length;

  if (repos.length === 0) {
    return (
      <div className="p-6">
        <div className="rounded-xl border bg-card px-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">No repos tracked yet.</p>
          <div className="mt-3 flex justify-center">
            <AddRepoDialog />
          </div>
          {archived > 0 && (
            <Link
              href="/manage"
              className="mt-3 inline-block text-xs text-muted-foreground hover:underline"
            >
              {archived} archived — Manage repos
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <RepoOverview total={repos.length} archived={archived}>
      {sectionsOf(repos).map((section) => (
        <Fragment key={section.key}>
          {section.label && (
            <SectionHeading
              section={section.key}
              label={section.label}
              repoIds={section.rows.map((r) => r.id)}
            />
          )}
          {section.rows.map((row) => (
            <Suspense
              key={row.id}
              fallback={<RepoRowSkeleton name={row.name} path={row.path} section={section.key} />}
            >
              <LoadedRow row={row} section={section.key} />
            </Suspense>
          ))}
        </Fragment>
      ))}
    </RepoOverview>
  );
}
