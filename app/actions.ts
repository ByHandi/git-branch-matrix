"use server";

import { existsSync } from "node:fs";
import { basename, dirname } from "node:path";

import { revalidatePath } from "next/cache";

import { BROWSE_ROOT, type Listing, findRepos, listDir } from "@/lib/browse";
import {
  type RepoConfig,
  type RepoSettings,
  addRepo,
  addReposIfNew,
  deleteNote,
  listRepos,
  patchRepo,
  removeRepo,
  reorderRepos,
  toSettings,
  updateRepo,
  upsertNote,
} from "@/lib/db";
import { DEFAULTS, GitError, type RepoProbe, probeRepo } from "@/lib/git";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function addRepoAction(input: {
  name: string;
  path: string;
  envs: string[];
  remote: string;
  ticketPattern: string;
  doneEnvs: string[];
}): Promise<ActionResult> {
  const name = input.name.trim();
  const path = input.path.trim();
  if (!name || !path) return { ok: false, error: "name and path are required" };
  if (!existsSync(path)) return { ok: false, error: `folder not found: ${path}` };

  try {
    new RegExp(input.ticketPattern);
  } catch {
    return { ok: false, error: "ticket pattern is not a valid regex" };
  }

  try {
    await addRepo({
      name,
      path,
      envs: input.envs.length ? input.envs : undefined,
      remote: input.remote.trim() || undefined,
      ticketPattern: input.ticketPattern.trim() || undefined,
      doneEnvs: input.doneEnvs.length ? input.doneEnvs : undefined,
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "failed to save repo" };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateRepoAction(id: number, input: RepoConfig): Promise<ActionResult> {
  const name = input.name.trim();
  const path = input.path.trim();
  if (!name || !path) return { ok: false, error: "name and path are required" };
  if (!existsSync(path)) return { ok: false, error: `folder not found: ${path}` };
  if (!input.envs.length) return { ok: false, error: "at least one environment branch is needed" };
  try {
    new RegExp(input.ticketPattern);
  } catch {
    return { ok: false, error: "ticket pattern is not a valid regex" };
  }

  try {
    const row = await updateRepo(id, {
      ...input,
      name,
      path,
      remote: input.remote.trim() || DEFAULTS.remote,
      ticketPattern: input.ticketPattern.trim() || DEFAULTS.ticketPattern,
      group: input.group?.trim() || null,
    });
    if (!row) return { ok: false, error: "repo not found" };
  } catch (error) {
    // repo.name is unique
    if ((error as { code?: string }).code === "23505") {
      return { ok: false, error: `another repo is already called "${name}"` };
    }
    return { ok: false, error: error instanceof Error ? error.message : "failed to save repo" };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function patchRepoAction(
  id: number,
  patch: { archived?: boolean; pinned?: boolean; group?: string | null },
): Promise<ActionResult> {
  await patchRepo(id, "group" in patch ? { ...patch, group: patch.group?.trim() || null } : patch);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function reorderReposAction(ids: number[]): Promise<ActionResult> {
  await reorderRepos(ids);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeRepoAction(id: number): Promise<ActionResult> {
  await removeRepo(id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveNoteAction(input: {
  repoId: number;
  branch: string;
  note: string;
  status: string;
  tickets: string[];
}): Promise<ActionResult> {
  if (!input.branch) return { ok: false, error: "branch is empty" };

  const empty = !input.note.trim() && !input.status.trim() && !input.tickets.length;
  if (empty) await deleteNote(input.repoId, input.branch);
  else
    await upsertNote(input.repoId, input.branch, {
      note: input.note,
      status: input.status,
      tickets: input.tickets,
    });

  revalidatePath("/", "layout");
  return { ok: true };
}

export type BrowseResult = { ok: true; listing: Listing } | { ok: false; error: string };

export async function browseAction(path?: string): Promise<BrowseResult> {
  try {
    return { ok: true, listing: await listDir(path) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "failed to read folder" };
  }
}

export type ProbeResult = { ok: true; probe: RepoProbe } | { ok: false; error: string };

export async function probeRepoAction(path: string): Promise<ProbeResult> {
  try {
    return { ok: true, probe: await probeRepo(path) };
  } catch (error) {
    if (error instanceof GitError) return { ok: false, error: "this folder is not a git repo" };
    return { ok: false, error: error instanceof Error ? error.message : "failed to read repo" };
  }
}

export async function browseRootAction(): Promise<string> {
  return BROWSE_ROOT;
}

export type ScanCandidate = {
  path: string;
  name: string;
  remote: string;
  /** env branches found in the repo, earliest stage first; empty when none look like one */
  envs: string[];
  branchCount: number;
  /** parent folder below the scan root, e.g. "telescope" for <root>/telescope/api */
  group: string | null;
};

export type ScanResult =
  | { ok: true; root: string; candidates: ScanCandidate[]; tracked: number; truncated: boolean }
  | { ok: false; error: string };

/** Every git repo under `path` that is not tracked yet, with its envs guessed. */
export async function scanReposAction(path?: string): Promise<ScanResult> {
  let found: Awaited<ReturnType<typeof findRepos>>;
  try {
    found = await findRepos(path);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "failed to scan" };
  }

  const existing = await listRepos(true);
  const trackedPaths = new Set(existing.map((r) => r.path));
  const fresh = found.repos.filter((p) => !trackedPaths.has(p));

  // a few at a time: every probe spawns several git processes
  const probes: (RepoProbe | null)[] = [];
  for (let i = 0; i < fresh.length; i += 8) {
    const batch = fresh.slice(i, i + 8).map((p) => probeRepo(p).catch(() => null));
    probes.push(...(await Promise.all(batch)));
  }

  // Names are unique in the database. Two clones called "api" in different
  // groups become "groupA/api" and "groupB/api" rather than one replacing the other.
  const taken = new Set(existing.map((r) => r.name));
  const baseCount = new Map<string, number>();
  for (const p of fresh) baseCount.set(basename(p), (baseCount.get(basename(p)) ?? 0) + 1);

  const candidates: ScanCandidate[] = [];
  fresh.forEach((p, i) => {
    const probe = probes[i];
    if (!probe || trackedPaths.has(probe.toplevel)) return;

    const base = basename(p);
    let name =
      taken.has(base) || baseCount.get(base)! > 1 ? `${basename(dirname(p))}/${base}` : base;
    for (let n = 2; taken.has(name); n++) name = `${basename(dirname(p))}/${base}-${n}`;
    taken.add(name);

    const parent = dirname(p);
    candidates.push({
      path: probe.toplevel,
      name,
      remote: probe.remote,
      envs: probe.guessedEnvs,
      branchCount: probe.branches.length,
      group: parent === found.root ? null : basename(parent),
    });
  });

  return {
    ok: true,
    root: found.root,
    candidates,
    tracked: found.repos.length - fresh.length,
    truncated: found.truncated,
  };
}

export type AddReposResult =
  | { ok: true; added: string[]; skipped: string[] }
  | { ok: false; error: string };

export async function addReposAction(
  items: { name: string; path: string; remote: string; envs: string[]; group: string | null }[],
): Promise<AddReposResult> {
  const valid = items.filter((item) => item.name.trim() && existsSync(item.path));
  if (!valid.length) return { ok: false, error: "nothing to add" };

  try {
    const result = await addReposIfNew(
      valid.map((item) => {
        const envs = item.envs.length ? item.envs : [...DEFAULTS.envs];
        return {
          name: item.name.trim(),
          path: item.path,
          remote: item.remote || DEFAULTS.remote,
          group: item.group,
          envs,
          // the last stages of the pipeline are the ones that mean "shipped"
          doneEnvs: item.envs.length ? envs.slice(-2) : [...DEFAULTS.doneEnvs],
        };
      }),
    );
    revalidatePath("/", "layout");
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "failed to save repos" };
  }
}

/** Every repo, archived ones included, for the command palette. Reads Postgres only — no git. */
export async function listReposAction(): Promise<RepoSettings[]> {
  return (await listRepos(true)).map(toSettings);
}
