import { Pool } from "pg";
import "server-only";

/**
 * The ONLY place this app writes. Git is read strictly read-only (see lib/git.ts);
 * every mutation lands in Postgres.
 */
const CONNECTION_STRING =
  process.env.BRANCH_MATRIX_DB ??
  process.env.DATABASE_URL ??
  `postgres://${process.env.USER ?? "postgres"}@localhost:5432/branch_matrix`;

// `next dev` re-evaluates modules on every edit; without this the pool is
// recreated each time until Postgres refuses new connections.
const globalForPg = globalThis as unknown as { branchMatrixPool?: Pool };

export const pool =
  globalForPg.branchMatrixPool ?? new Pool({ connectionString: CONNECTION_STRING, max: 4 });

if (process.env.NODE_ENV !== "production") globalForPg.branchMatrixPool = pool;

export type RepoRow = {
  id: number;
  name: string;
  path: string;
  envs: string[];
  remote: string;
  ticket_pattern: string;
  scan_limit: number;
  done_envs: string[];
  sort_order: number;
  archived: boolean;
  created_at: Date;
};

export type BranchNoteRow = {
  id: number;
  repo_id: number;
  branch: string;
  tickets: string[];
  note: string | null;
  status: string | null;
  updated_at: Date;
};

export async function listRepos(includeArchived = false): Promise<RepoRow[]> {
  const { rows } = await pool.query<RepoRow>(
    `select * from repo ${includeArchived ? "" : "where not archived"} order by sort_order, name`,
  );
  return rows;
}

export async function getRepo(id: number): Promise<RepoRow | undefined> {
  const { rows } = await pool.query<RepoRow>("select * from repo where id = $1", [id]);
  return rows[0];
}

export async function addRepo(input: {
  name: string;
  path: string;
  envs?: string[];
  remote?: string;
  ticketPattern?: string;
  scanLimit?: number;
  doneEnvs?: string[];
}): Promise<RepoRow> {
  const { rows } = await pool.query<RepoRow>(
    `insert into repo (name, path, envs, remote, ticket_pattern, scan_limit, done_envs)
     values ($1, $2,
             coalesce($3::text[], '{development,staging,release,main}'::text[]),
             coalesce($4::text, 'origin'),
             coalesce($5::text, '[A-Z][A-Z0-9]{1,9}-\\d+'),
             coalesce($6::integer, 500),
             coalesce($7::text[], '{release,main}'::text[]))
     on conflict (name) do update set
       path = excluded.path, envs = excluded.envs, remote = excluded.remote,
       ticket_pattern = excluded.ticket_pattern, scan_limit = excluded.scan_limit,
       done_envs = excluded.done_envs, archived = false
     returning *`,
    [
      input.name,
      input.path,
      input.envs ?? null,
      input.remote ?? null,
      input.ticketPattern ?? null,
      input.scanLimit ?? null,
      input.doneEnvs ?? null,
    ],
  );
  return rows[0];
}

/**
 * Insert several repos in one transaction. Unlike addRepo this never overwrites:
 * a name that is already taken is skipped and reported back.
 */
export async function addReposIfNew(
  inputs: { name: string; path: string; envs: string[]; remote: string; doneEnvs: string[] }[],
): Promise<{ added: string[]; skipped: string[] }> {
  const client = await pool.connect();
  const added: string[] = [];
  const skipped: string[] = [];
  try {
    await client.query("begin");
    for (const input of inputs) {
      const { rowCount } = await client.query(
        `insert into repo (name, path, envs, remote, done_envs)
         values ($1, $2, $3::text[], $4, $5::text[])
         on conflict (name) do nothing`,
        [input.name, input.path, input.envs, input.remote, input.doneEnvs],
      );
      (rowCount ? added : skipped).push(input.name);
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
  return { added, skipped };
}

export async function removeRepo(id: number): Promise<boolean> {
  const { rowCount } = await pool.query("delete from repo where id = $1", [id]);
  return (rowCount ?? 0) > 0;
}

export async function notesFor(repoId: number) {
  const { rows } = await pool.query<BranchNoteRow>(
    "select branch, tickets, note, status from branch_note where repo_id = $1",
    [repoId],
  );
  const overlay: Record<string, { tickets: string[]; note: string | null; status: string | null }> =
    {};
  for (const r of rows) overlay[r.branch] = { tickets: r.tickets, note: r.note, status: r.status };
  return overlay;
}

export async function upsertNote(
  repoId: number,
  branch: string,
  input: { tickets?: string[]; note?: string | null; status?: string | null },
): Promise<BranchNoteRow> {
  const blank = (v: string | null | undefined) => (typeof v === "string" && !v.trim() ? null : v);
  const { rows } = await pool.query<BranchNoteRow>(
    `insert into branch_note (repo_id, branch, tickets, note, status)
     values ($1, $2, coalesce($3::text[], '{}'::text[]), $4::text, $5::text)
     on conflict (repo_id, branch) do update set
       tickets = coalesce($3::text[], branch_note.tickets),
       note    = $4::text,
       status  = $5::text
     returning *`,
    [repoId, branch, input.tickets ?? null, blank(input.note) ?? null, blank(input.status) ?? null],
  );
  return rows[0];
}

export async function deleteNote(repoId: number, branch: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    "delete from branch_note where repo_id = $1 and branch = $2",
    [repoId, branch],
  );
  return (rowCount ?? 0) > 0;
}
