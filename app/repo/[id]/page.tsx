import { notFound } from "next/navigation";

import RepoDetail from "@/components/matrix/repo-detail";
import { getRepo, groupNames, listRepos } from "@/lib/db";
import { loadRepo } from "@/lib/overview";

// Git state changes every time you merge — never serve this from the cache.
export const dynamic = "force-dynamic";

export default async function RepoPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const row = Number.isInteger(id) ? await getRepo(id) : undefined;
  if (!row) notFound();

  const [model, all] = await Promise.all([loadRepo(row), listRepos(true)]);
  return <RepoDetail model={model} groups={groupNames(all)} />;
}
