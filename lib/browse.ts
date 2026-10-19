import { readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve, sep } from "node:path";

import "server-only";

/**
 * Directory listing for the folder picker. Confined to a root (default $HOME)
 * so the endpoint can't be used to enumerate the whole filesystem.
 */
export const BROWSE_ROOT = resolve(process.env.BRANCH_MATRIX_ROOT ?? homedir());

export type DirEntry = { name: string; path: string; isRepo: boolean };

export type Listing = {
  path: string;
  parent: string | null;
  entries: DirEntry[];
  isRepo: boolean;
};

function inRoot(target: string) {
  return target === BROWSE_ROOT || target.startsWith(BROWSE_ROOT + sep);
}

const isDir = async (p: string) => {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
};

export async function listDir(requested?: string): Promise<Listing> {
  const target = resolve(requested?.trim() || BROWSE_ROOT);
  if (!inRoot(target)) throw new Error(`outside the allowed root (${BROWSE_ROOT})`);
  if (!(await isDir(target))) throw new Error(`not a folder: ${target}`);

  const names = await readdir(target, { withFileTypes: true });
  const dirs = names
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .map((d) => ({ name: d.name, path: resolve(target, d.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const entries: DirEntry[] = await Promise.all(
    dirs.map(async (d) => ({ ...d, isRepo: await isDir(resolve(d.path, ".git")) })),
  );

  return {
    path: target,
    parent: target === BROWSE_ROOT ? null : resolve(target, ".."),
    entries,
    isRepo: await isDir(resolve(target, ".git")),
  };
}
