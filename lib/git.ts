import { execFile } from "node:child_process";
import { promisify } from "node:util";

import "server-only";

import { type RemoteInfo, parseRemoteUrl } from "@/lib/remote";

const run = promisify(execFile);

/**
 * Read-only git layer.
 *
 * Every command used here only READS. Nothing in this file writes to the repo,
 * the index, the working tree, or the remote — `git fetch` included, because
 * `fetch --prune` rewrites `.git/refs/remotes/`.
 */
const READ_ONLY_COMMANDS = new Set(["rev-parse", "for-each-ref", "log", "remote"]);

export class GitError extends Error {}

export type RepoConfig = {
  envs: string[];
  remote: string;
  ticketPattern: string;
  scanLimit: number;
  /**
   * Environments that decide whether a ticket is done. A ticket is done once it
   * has landed in ALL of these — not in every env. Intersected with the envs the
   * repo actually has, so a repo without `release` still behaves sensibly.
   */
  doneEnvs: string[];
  overlay?: Record<string, BranchOverlay>;
};

export type BranchOverlay = {
  tickets?: string[];
  note?: string | null;
  status?: string | null;
};

export type MergeCell = { pr?: number; date?: string; via?: string };

export type { RemoteInfo, RemoteProvider } from "@/lib/remote";
export { parseRemoteUrl, pullRequestUrl } from "@/lib/remote";

export type Branch = {
  name: string;
  tickets: string[];
  envs: Record<string, MergeCell>;
  live: boolean;
  date: string | null;
  author: string | null;
  /** true when `author` came from the merge commit, not the branch tip */
  authorFromMerge?: boolean;
  sha: string | null;
  combined: boolean;
  squashed?: boolean;
  note?: string | null;
  status?: string | null;
  manualTickets?: string[];
};

export type Ticket = {
  id: string;
  branches: string[];
  authors: string[];
  envs: Record<string, MergeCell>;
  date: string | null;
  combined: boolean;
  untracked: boolean;
  reach: number;
  done: boolean;
};

export type RepoModel = {
  repo: string;
  /** null when the remote is missing or its host is not one we can link to */
  remote: RemoteInfo | null;
  envs: string[];
  /** Subset of `envs` that a ticket must reach to count as done. */
  doneEnvs: string[];
  missingEnvs: string[];
  branches: Branch[];
  tickets: Ticket[];
  generatedAt: string;
  error?: string;
};

export const DEFAULTS = {
  envs: ["development", "staging", "release", "main"],
  remote: "origin",
  ticketPattern: "[A-Z][A-Z0-9]{1,9}-\\d+",
  scanLimit: 500,
  doneEnvs: ["release", "main"],
} as const;

async function git(repo: string, args: string[], allowFail = false): Promise<string> {
  if (!READ_ONLY_COMMANDS.has(args[0])) {
    // Hard guard: adding a mutating command here fails loudly instead of
    // quietly touching the user's repo.
    throw new GitError(`git command "${args[0]}" is not read-only, refused`);
  }
  try {
    const { stdout } = await run("git", ["-C", repo, ...args], {
      maxBuffer: 64 * 1024 * 1024,
      encoding: "utf8",
    });
    return stdout;
  } catch (error) {
    if (allowFail) return "";
    const detail = error instanceof Error ? error.message : String(error);
    throw new GitError(`git ${args.join(" ")} failed: ${detail.trim()}`);
  }
}

export async function toplevel(repoPath: string): Promise<string> {
  return (await git(repoPath, ["rev-parse", "--show-toplevel"])).trim();
}

async function resolveRef(repo: string, remote: string, name: string) {
  for (const ref of [`refs/remotes/${remote}/${name}`, `refs/heads/${name}`]) {
    const sha = (await git(repo, ["rev-parse", "--verify", "--quiet", ref], true)).trim();
    if (sha) return { ref, sha };
  }
  return null;
}

async function listBranches(repo: string, remote: string) {
  const out = await git(repo, [
    "for-each-ref",
    "--format=%(refname)%09%(objectname)%09%(committerdate:iso8601-strict)%09%(authorname)",
    `refs/remotes/${remote}`,
    "refs/heads",
  ]);

  const map = new Map<string, { name: string; sha: string; date: string; author: string }>();
  const remotePrefix = `refs/remotes/${remote}/`;

  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    const [refname, sha, date, author] = line.split("\t");
    // origin/HEAD is a symref to the default branch, not a branch of its own
    if (refname.endsWith("/HEAD")) continue;
    const isRemote = refname.startsWith(remotePrefix);
    const name = isRemote
      ? refname.slice(remotePrefix.length)
      : refname.replace(/^refs\/heads\//, "");
    if (!map.has(name) || isRemote) map.set(name, { name, sha, date, author });
  }
  return map;
}

async function mergedInto(repo: string, envRef: string) {
  const out = await git(
    repo,
    ["for-each-ref", "--merged", envRef, "--format=%(refname:short)", "refs/remotes", "refs/heads"],
    true,
  );
  return new Set(
    out
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

type MergeEntry = {
  date: string;
  pr: number | null;
  branch: string | null;
  subject: string;
  body: string;
  kind: "merge" | "squash";
  /** Tip of the merged branch. Survives even after the branch is deleted. */
  secondParent: string | null;
  /** Whoever authored the merge commit — the person who clicked merge. */
  mergedBy: string | null;
};

/**
 * Parse merge commits on an env branch to recover PR numbers, merge dates, and
 * branches that were deleted after their PR was merged.
 */
async function scanMerges(repo: string, envRef: string, limit: number): Promise<MergeEntry[]> {
  const SEP = "\x1e";
  const out = await git(
    repo,
    [
      "log",
      envRef,
      "--first-parent",
      `--max-count=${limit}`,
      `--pretty=format:%H${SEP}%P${SEP}%aI${SEP}%s${SEP}%b${SEP}%an${SEP}`,
      "-z",
    ],
    true,
  );

  const entries: MergeEntry[] = [];
  for (const rec of out.split("\0")) {
    if (!rec.trim()) continue;
    const [, parents, date, subject, body, mergedBy] = rec.split(SEP);
    if (subject === undefined) continue;
    const parentList = (parents ?? "").trim().split(/\s+/).filter(Boolean);
    const isMerge = parentList.length > 1;
    const secondParent = parentList[1] ?? null;
    const base = { date, subject, body, secondParent, mergedBy: mergedBy ?? null };

    let m = /^Merge pull request #(\d+) from (\S+)/.exec(subject);
    if (m) {
      const branch = m[2].includes("/") ? m[2].slice(m[2].indexOf("/") + 1) : m[2];
      entries.push({ ...base, pr: Number(m[1]), branch, kind: "merge" });
      continue;
    }
    m = /^Merge branch '([^']+)'/.exec(subject);
    if (m) {
      entries.push({ ...base, pr: null, branch: m[1], kind: "merge" });
      continue;
    }
    m = /\(#(\d+)\)\s*$/.exec(subject);
    if (m && !isMerge) {
      entries.push({ ...base, pr: Number(m[1]), branch: null, kind: "squash" });
    }
  }
  return entries;
}

/**
 * Look up the author of arbitrary commits in one pass. Used to recover who
 * actually wrote a branch after the branch itself was deleted — the merge
 * commit only tells you who pressed merge.
 */
async function authorsOf(repo: string, shas: string[]): Promise<Map<string, string>> {
  const SEP = "\x1e";
  const found = new Map<string, string>();
  const unique = [...new Set(shas.filter(Boolean))];

  // keep argv well under the OS limit on repos with a long history
  for (let i = 0; i < unique.length; i += 200) {
    const chunk = unique.slice(i, i + 200);
    const out = await git(
      repo,
      ["log", "--no-walk", `--pretty=format:%H${SEP}%an`, "-z", ...chunk],
      true,
    );
    for (const rec of out.split("\0")) {
      if (!rec.trim()) continue;
      const [sha, author] = rec.split(SEP);
      if (sha && author) found.set(sha, author);
    }
  }
  return found;
}

function makeExtractor(pattern: string) {
  const re = new RegExp(pattern, "g");
  return (...texts: (string | null | undefined)[]) => {
    const found = new Set<string>();
    for (const t of texts) {
      if (!t) continue;
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(t))) found.add(m[0]);
    }
    return [...found];
  };
}

/** Build the ticket × environment model for one repo. */
export async function buildModel(
  repoPath: string,
  options: Partial<RepoConfig> = {},
): Promise<RepoModel> {
  const cfg = { ...DEFAULTS, ...options };
  const repo = await toplevel(repoPath);
  const overlay = options.overlay ?? {};
  const extract = makeExtractor(cfg.ticketPattern);

  const envRefs: { name: string; ref: string }[] = [];
  const missingEnvs: string[] = [];
  for (const name of cfg.envs) {
    const found = await resolveRef(repo, cfg.remote, name);
    if (found) envRefs.push({ name, ref: found.ref });
    else missingEnvs.push(name);
  }
  if (!envRefs.length) {
    throw new GitError(`no environment branch found in ${repo}: ${cfg.envs.join(", ")}`);
  }

  const envNames = new Set(envRefs.map((e) => e.name));
  const remoteInfo = parseRemoteUrl(
    (await git(repo, ["remote", "get-url", cfg.remote], true)).trim(),
  );
  const [allBranches, mergedSets] = await Promise.all([
    listBranches(repo, cfg.remote),
    Promise.all(envRefs.map(async (e) => [e.name, await mergedInto(repo, e.ref)] as const)),
  ]);
  const merged = new Map(mergedSets);

  const branches = new Map<string, Branch>();
  const touch = (name: string): Branch => {
    let b = branches.get(name);
    if (!b) {
      b = {
        name,
        tickets: [],
        envs: {},
        live: false,
        date: null,
        author: null,
        sha: null,
        combined: false,
      };
      branches.set(name, b);
    }
    return b;
  };

  for (const [name, info] of allBranches) {
    if (envNames.has(name)) continue;
    const b = touch(name);
    b.live = true;
    b.date = info.date;
    b.author = info.author;
    b.sha = info.sha;
    b.tickets = extract(name);
    for (const e of envRefs) {
      const set = merged.get(e.name)!;
      if (set.has(name) || set.has(`${cfg.remote}/${name}`)) b.envs[e.name] ??= {};
    }
  }

  const scans = await Promise.all(
    envRefs.map(async (e) => [e.name, await scanMerges(repo, e.ref, cfg.scanLimit)] as const),
  );

  const tipAuthors = await authorsOf(
    repo,
    scans.flatMap(([, entries]) => entries.map((e) => e.secondParent ?? "")),
  );

  for (const [envName, entries] of scans) {
    for (const entry of entries) {
      const name = entry.branch ?? (entry.pr ? `#${entry.pr}` : null);
      if (!name || envNames.has(name)) continue;
      const b = touch(name);
      b.date ??= entry.date;
      if (!b.author) {
        const tipAuthor = entry.secondParent ? tipAuthors.get(entry.secondParent) : undefined;
        // squash merges have no second parent, so the merge author is all we have
        b.author = tipAuthor ?? entry.mergedBy ?? null;
        b.authorFromMerge = !tipAuthor;
      }
      b.tickets = [...new Set([...b.tickets, ...extract(entry.branch, entry.subject, entry.body)])];
      const cell = (b.envs[envName] ??= {});
      if (entry.pr && !cell.pr) cell.pr = entry.pr;
      if (!cell.date || entry.date < cell.date) cell.date = entry.date;
      if (entry.kind === "squash") b.squashed = true;
    }
  }

  for (const [name, meta] of Object.entries(overlay)) {
    const b = touch(name);
    if (meta.tickets?.length) b.tickets = [...new Set([...b.tickets, ...meta.tickets])];
    b.note = meta.note ?? null;
    b.status = meta.status ?? null;
    b.manualTickets = meta.tickets ?? [];
  }

  for (const b of branches.values()) b.combined = b.tickets.length > 1;

  const envList = envRefs.map((e) => e.name);
  // fall back to every env when none of the configured done envs exist here
  const doneEnvs = cfg.doneEnvs.filter((e) => envNames.has(e));
  const effectiveDoneEnvs = doneEnvs.length ? doneEnvs : envList;
  const tickets = new Map<string, Ticket>();

  for (const b of branches.values()) {
    const ids = b.tickets.length ? b.tickets : [`(no-ticket) ${b.name}`];
    for (const id of ids) {
      let t = tickets.get(id);
      if (!t) {
        t = {
          id,
          branches: [],
          authors: [],
          envs: {},
          date: null,
          combined: false,
          untracked: !b.tickets.length,
          reach: 0,
          done: false,
        };
        tickets.set(id, t);
      }
      t.branches.push(b.name);
      if (b.author && !t.authors.includes(b.author)) t.authors.push(b.author);
      if (b.combined) t.combined = true;
      if (!t.date || (b.date && b.date > t.date)) t.date = b.date;
      for (const [env, cell] of Object.entries(b.envs)) {
        const prev = t.envs[env];
        if (!prev || (cell.date && (!prev.date || cell.date < prev.date))) {
          t.envs[env] = { ...cell, via: b.name };
        }
      }
    }
  }

  const ticketList = [...tickets.values()].map((t) => ({
    ...t,
    reach: envList.filter((e) => t.envs[e]).length,
    done: effectiveDoneEnvs.every((e) => t.envs[e]),
  }));

  return {
    repo,
    remote: remoteInfo,
    envs: envList,
    doneEnvs: effectiveDoneEnvs,
    missingEnvs,
    branches: [...branches.values()],
    tickets: ticketList,
    generatedAt: new Date().toISOString(),
  };
}

/** Env branch names we look for when guessing a repo's pipeline, in pipeline order. */
const ENV_CANDIDATES = [
  "development",
  "develop",
  "dev",
  "staging",
  "stage",
  "uat",
  "release",
  "preprod",
  "main",
  "master",
  "production",
  "prod",
];

export type RepoProbe = {
  toplevel: string;
  remote: string;
  remotes: string[];
  branches: string[];
  guessedEnvs: string[];
};

/** Inspect a folder so the UI can prefill name, remote and env branches. */
export async function probeRepo(repoPath: string): Promise<RepoProbe> {
  const top = await toplevel(repoPath);
  const remotes = (await git(top, ["remote"], true))
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const remote = remotes.includes("origin") ? "origin" : (remotes[0] ?? "origin");

  const branches = [...(await listBranches(top, remote)).keys()].sort();
  const present = new Set(branches);
  const guessedEnvs = ENV_CANDIDATES.filter((e) => present.has(e));

  return { toplevel: top, remote, remotes, branches, guessedEnvs };
}
