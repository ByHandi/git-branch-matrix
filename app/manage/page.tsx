import ManageRepos from "@/components/matrix/manage-repos";
import { listRepos, toSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ManagePage() {
  const repos = await listRepos(true);
  return <ManageRepos repos={repos.map(toSettings)} />;
}
