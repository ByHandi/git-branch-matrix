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

// Big trees that never hold a repo worth tracking, or that a repo only vendors.
const SCAN_SKIP = new Set(["node_modules", "vendor", "Library", "Applications"]);
const SCAN_MAX_DIRS = 5000;

/**
 * Every git repo under `requested`, at most `maxDepth` folders down — enough for
 * ~/projects/<group>/<repo>. A repo is a leaf: its subfolders are not searched,
 * and the walk gives up after SCAN_MAX_DIRS folders so a huge tree can't hang it.
 */
export async function findRepos(requested?: string, maxDepth = 3) {
  const root = resolve(requested?.trim() || BROWSE_ROOT);
  if (!inRoot(root)) throw new Error(`outside the allowed root (${BROWSE_ROOT})`);
  if (!(await isDir(root))) throw new Error(`not a folder: ${root}`);

  const repos: string[] = [];
  let level = [root];
  let visited = 0;
  let truncated = false;

  for (let depth = 0; depth <= maxDepth && level.length; depth++) {
    const next: string[] = [];
    for (const dir of level) {
      if (++visited > SCAN_MAX_DIRS) {
        truncated = true;
        break;
      }
      if (await isDir(resolve(dir, ".git"))) {
        repos.push(dir);
        continue;
      }
      if (depth === maxDepth) continue;
      const children = await readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const d of children) {
        if (d.isDirectory() && !d.name.startsWith(".") && !SCAN_SKIP.has(d.name)) {
          next.push(resolve(dir, d.name));
        }
      }
    }
    if (truncated) break;
    level = next;
  }

  return { root, repos: repos.sort(), truncated };
}
