/**
 * Pure URL helpers for git hosting providers.
 *
 * Deliberately free of node APIs and of "server-only": client components need
 * `pullRequestUrl`, and importing it from lib/git.ts would drag child_process
 * into the browser bundle.
 */
export type RemoteProvider = "github" | "gitlab" | "bitbucket" | "unknown";

export type RemoteInfo = {
  provider: RemoteProvider;
  /** Base web URL of the project, e.g. https://github.com/owner/repo */
  webUrl: string;
  owner: string;
  repo: string;
};

/**
 * Turn a git remote URL into something we can build web links from.
 * Handles scp-style (git@host:owner/repo.git), ssh:// and https://.
 */
export function parseRemoteUrl(url: string): RemoteInfo | null {
  const raw = url.trim();
  if (!raw) return null;

  let host: string, path: string;

  const scp = /^(?:([^@]+)@)?([^:/]+):(.+)$/.exec(raw);
  if (scp && !raw.includes("://")) {
    host = scp[2];
    path = scp[3];
  } else {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return null;
    }
    host = parsed.hostname;
    path = parsed.pathname;
  }

  const segments = path
    .replace(/^\/+/, "")
    .replace(/\.git$/, "")
    .split("/")
    .filter(Boolean);
  if (segments.length < 2) return null;

  const repo = segments[segments.length - 1];
  const owner = segments.slice(0, -1).join("/");

  const provider: RemoteProvider = host.includes("github")
    ? "github"
    : host.includes("gitlab")
      ? "gitlab"
      : host.includes("bitbucket")
        ? "bitbucket"
        : "unknown";

  return { provider, webUrl: `https://${host}/${owner}/${repo}`, owner, repo };
}

/** Percent-encode a branch name but keep the slashes these hosts expect. */
const encodeBranch = (name: string) => name.split("/").map(encodeURIComponent).join("/");

/** Link that opens the "create pull request" form for head -> base. */
export function pullRequestUrl(
  remote: RemoteInfo | null,
  base: string,
  head: string,
): string | null {
  if (!remote) return null;
  const b = encodeBranch(base);
  const h = encodeBranch(head);

  switch (remote.provider) {
    case "github":
      return `${remote.webUrl}/compare/${b}...${h}?expand=1`;
    case "gitlab":
      return (
        `${remote.webUrl}/-/merge_requests/new` +
        `?merge_request%5Bsource_branch%5D=${encodeURIComponent(head)}` +
        `&merge_request%5Btarget_branch%5D=${encodeURIComponent(base)}`
      );
    case "bitbucket":
      return (
        `${remote.webUrl}/pull-requests/new` +
        `?source=${encodeURIComponent(head)}&dest=${encodeURIComponent(base)}`
      );
    default:
      return null;
  }
}
