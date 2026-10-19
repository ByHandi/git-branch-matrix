import TicketsView from "@/components/matrix/tickets-view";
import { listRepos } from "@/lib/db";
import { loadRepo } from "@/lib/overview";

// Git state changes every time you merge — never serve this from the cache.
export const dynamic = "force-dynamic";

export default async function TicketsPage() {
  // every repo is needed before a ticket can be compared across them
  const models = await Promise.all((await listRepos()).map(loadRepo));
  return <TicketsView models={models} />;
}
