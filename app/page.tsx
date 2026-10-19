import { Suspense } from "react";

import AddRepoDialog from "@/components/matrix/add-repo-dialog";
import { RepoOverview, RepoRow, RepoRowSkeleton } from "@/components/matrix/repo-overview";
import { type RepoRow as RepoRecord, listRepos } from "@/lib/db";
import { loadRepo } from "@/lib/overview";

// Git state changes every time you merge — never serve this from the cache.
export const dynamic = "force-dynamic";

async function LoadedRow({ row }: { row: RepoRecord }) {
  return <RepoRow model={await loadRepo(row)} />;
}

export default async function Page() {
  const repos = await listRepos();

  if (repos.length === 0) {
    return (
      <div className="p-6">
        <div className="rounded-xl border bg-card px-4 py-16 text-center">
          <p className="text-sm text-muted-foreground">No repos tracked yet.</p>
          <div className="mt-3 flex justify-center">
            <AddRepoDialog />
          </div>
        </div>
      </div>
    );
  }

  return (
    <RepoOverview total={repos.length}>
      {repos.map((row) => (
        <Suspense key={row.id} fallback={<RepoRowSkeleton name={row.name} path={row.path} />}>
          <LoadedRow row={row} />
        </Suspense>
      ))}
    </RepoOverview>
  );
}
