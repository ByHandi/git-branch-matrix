#!/usr/bin/env node
// Runs `git fetch --prune` for the dashboard, on the host itself.
//
// The app only reads git, and in Docker it sees the repos through a read-only
// mount with no access to your SSH keys. This helper is the one piece that
// writes (refs/remotes + objects, never the working tree), and it does so as
// you, with your own ~/.ssh setup. It listens on loopback only.
//
//   npm run fetch-helper                   # foreground, any OS
//   ./scripts/fetch-helper.sh install      # macOS: auto-start at login
//
// POST /fetch {"paths": ["/abs/repo", ...]}  ->  {"results": [{path, ok, ms, error?}]}
// GET  /health                               ->  {"ok": true}
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { resolve, sep } from "node:path";

const PORT = Number(process.env.FETCH_HELPER_PORT ?? 4329);
// Loopback by default. On Linux with plain Docker Engine the container reaches the host through the
// docker0 bridge, not loopback — set this to the bridge address (usually 172.17.0.1), never 0.0.0.0.
const HOST = process.env.FETCH_HELPER_HOST ?? "127.0.0.1";
// Same confinement as the app's folder picker: nothing outside this root is touched.
const ROOT = resolve(process.env.BRANCH_MATRIX_ROOT ?? `${homedir()}/projects`);
const CONCURRENCY = 6;
const TIMEOUT_MS = 60_000;
const MAX_PATHS = 200;

const inRoot = (p) => p === ROOT || p.startsWith(ROOT + sep);
// a directory for a normal clone, a file for a worktree — either way it exists
const isRepo = (p) => existsSync(resolve(p, ".git"));

function fetchRepo(path) {
  const started = Date.now();
  return new Promise((done) => {
    execFile(
      "git",
      ["-C", path, "fetch", "--prune", "--quiet"],
      // never stop for a password or host-key prompt: there is no one to answer it
      {
        timeout: TIMEOUT_MS,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_SSH_COMMAND: "ssh -o BatchMode=yes" },
      },
      (error, _stdout, stderr) =>
        done({
          path,
          ok: !error,
          ms: Date.now() - started,
          ...(error && { error: (stderr || error.message).trim().split("\n").pop() }),
        }),
    );
  });
}

async function fetchAll(paths) {
  const results = [];
  for (let i = 0; i < paths.length; i += CONCURRENCY) {
    results.push(...(await Promise.all(paths.slice(i, i + CONCURRENCY).map(fetchRepo))));
  }
  return results;
}

function send(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/health")
    return send(res, 200, { ok: true, root: ROOT });
  if (req.method !== "POST" || req.url !== "/fetch") return send(res, 404, { error: "not found" });

  let raw = "";
  req.on("data", (chunk) => {
    raw += chunk;
    if (raw.length > 64 * 1024) req.destroy();
  });
  req.on("end", async () => {
    let paths;
    try {
      paths = JSON.parse(raw).paths;
    } catch {
      return send(res, 400, { error: 'body must be JSON: {"paths": [...]}' });
    }
    if (!Array.isArray(paths) || paths.length > MAX_PATHS) {
      return send(res, 400, { error: `paths must be an array of at most ${MAX_PATHS}` });
    }

    const wanted = [...new Set(paths.filter((p) => typeof p === "string").map((p) => resolve(p)))];
    const refused = wanted
      .filter((p) => !inRoot(p) || !isRepo(p))
      .map((path) => ({ path, ok: false, ms: 0, error: `not a git repo under ${ROOT}` }));
    const allowed = wanted.filter((p) => inRoot(p) && isRepo(p));

    const results = [...(await fetchAll(allowed)), ...refused];
    const failed = results.filter((r) => !r.ok).length;
    console.log(
      `${new Date().toLocaleString("sv-SE")} fetched ${results.length - failed}/${results.length}` +
        (failed
          ? ` — failed: ${results
              .filter((r) => !r.ok)
              .map((r) => r.path)
              .join(", ")}`
          : ""),
    );
    send(res, 200, { results });
  });
});

server.listen(PORT, HOST, () =>
  console.log(`fetch helper on http://${HOST}:${PORT}, repos under ${ROOT}`),
);
