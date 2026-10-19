"use server";

import { existsSync } from "node:fs";

import { revalidatePath } from "next/cache";

import { BROWSE_ROOT, type Listing, listDir } from "@/lib/browse";
import { addRepo, deleteNote, removeRepo, upsertNote } from "@/lib/db";
import { GitError, type RepoProbe, probeRepo } from "@/lib/git";

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
