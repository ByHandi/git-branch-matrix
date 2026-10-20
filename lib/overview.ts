import { existsSync } from "node:fs";

import "server-only";

import { type RepoRow, type RepoSettings, notesFor, ticketUrlFor, toSettings } from "@/lib/db";
import { GitError, type RepoModel, buildModel, lastFetchedAt } from "@/lib/git";

export type RepoView = RepoModel & {
  repoId: number;
  repoName: string;
  configuredEnvs: string[];
  /** last `git fetch` in this clone; null when it has never been fetched */
  fetchedAt: string | null;
  /** issue-tracker link with `{ticket}` in it, or null when ticket IDs link nowhere */
  ticketUrl: string | null;
  settings: RepoSettings;
};

const fromRow = (row: RepoRow) => ({
  repoId: row.id,
  repoName: row.name,
  configuredEnvs: row.envs,
  ticketUrl: ticketUrlFor(row),
  settings: toSettings(row),
});

function failed(row: RepoRow, message: string): RepoView {
  return {
    ...fromRow(row),
    fetchedAt: null,
    repo: row.path,
    remote: null,
    envs: [],
    doneEnvs: [],
    missingEnvs: row.envs,
    branches: [],
    tickets: [],
    generatedAt: new Date().toISOString(),
    error: message,
  };
}

export async function loadRepo(row: RepoRow): Promise<RepoView> {
  if (!existsSync(row.path)) return failed(row, `folder not found: ${row.path}`);

  try {
    const [overlay, fetchedAt] = await Promise.all([notesFor(row.id), lastFetchedAt(row.path)]);
    const model = await buildModel(row.path, {
      envs: row.envs,
      remote: row.remote,
      ticketPattern: row.ticket_pattern,
      scanLimit: row.scan_limit,
      doneEnvs: row.done_envs,
      overlay,
    });
    return { ...model, ...fromRow(row), fetchedAt };
  } catch (error) {
    if (error instanceof GitError) return failed(row, error.message);
    throw error;
  }
}
