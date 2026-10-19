import { existsSync } from "node:fs";

import "server-only";

import { type RepoRow, notesFor } from "@/lib/db";
import { GitError, type RepoModel, buildModel } from "@/lib/git";

export type RepoView = RepoModel & {
  repoId: number;
  repoName: string;
  configuredEnvs: string[];
};

function failed(row: RepoRow, message: string): RepoView {
  return {
    repoId: row.id,
    repoName: row.name,
    configuredEnvs: row.envs,
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
    const overlay = await notesFor(row.id);
    const model = await buildModel(row.path, {
      envs: row.envs,
      remote: row.remote,
      ticketPattern: row.ticket_pattern,
      scanLimit: row.scan_limit,
      doneEnvs: row.done_envs,
      overlay,
    });
    return { ...model, repoId: row.id, repoName: row.name, configuredEnvs: row.envs };
  } catch (error) {
    if (error instanceof GitError) return failed(row, error.message);
    throw error;
  }
}
