# Git Branch Matrix

Track tickets against environments (`development` / `staging` / `release` / `main`) straight from
your local git clones. Multi-repo.

**Git is read-only.** Every write goes to Postgres.

## Setup

```sh
npm install
npm run db:init          # createdb branch_matrix + apply db/schema.sql
npm run dev              # http://localhost:4321
```

Override the port with `PORT=5000 npm run dev`.

`db/schema.sql` is idempotent and carries its own migrations — after pulling, run `npm run db:init`
again (or pipe the file into `psql` for a Postgres in Docker).

### Docker / OrbStack

```sh
cp .env.local .env.docker   # then point the host at host.docker.internal instead of localhost
docker compose up -d --build   # http://localhost:4321 or http://gbm.orb.local
```

`~/projects` is mounted read-only at the same path, so repo paths stay valid both natively and in
the container. Rebuild after code changes with `docker compose up -d --build`; don't run the
LaunchAgent from `scripts/service.sh` at the same time — both want port 4321.

### A nicer URL

```sh
sudo ./scripts/hostname.sh install       # http://gbm.local:4321
sudo ./scripts/hostname.sh install 80    # http://gbm.local  (pf redirects 80 -> 4321)
./scripts/hostname.sh status
sudo ./scripts/hostname.sh uninstall
```

`install` appends one line to `/etc/hosts` (backed up to `/etc/hosts.branch-matrix.bak`) and
flushes the DNS cache. The record is IPv4-only on purpose: the app binds `127.0.0.1`, so an `::1`
record for the same name only sends every lookup to a dead address first. `install` also strips any
IPv6 record that crept in — dropping just the hostname, so a shared line like `::1 localhost` keeps
working.

Passing `80` additionally loads a pf anchor that redirects port 80 to the app, so the app itself
never needs to run as root — but **pf rules do not survive a reboot**, so re-run it after
restarting, or stick with the port suffix. `status` tells the two apart: an anchor that is
installed but no longer loaded is reported as `redirect MATI`, which is the usual reason
`http://gbm.local` stops answering while `http://gbm.local:4321` still works.

Note that `.local` is reserved for mDNS/Bonjour (RFC 6762). An `/etc/hosts` entry does win on
macOS, but it can slow name lookups and will clash if a Bonjour device ever claims the same name.
`gbm.test` is the conflict-free choice — set `BRANCH_MATRIX_HOST=gbm.test` before running the
script if you would rather avoid it.

Default connection string: `postgres://$USER@localhost:5432/branch_matrix`.
Override with `BRANCH_MATRIX_DB` or `DATABASE_URL`.

## Adding a repo

**+ Repo** → **Browse…**. Folders containing a git repo get a 🌿 icon and a **Select** button.
Once picked, the name, remote, environment branches, and done-environments are filled in from the
repo itself — correct them if a guess is off.

Browsing is confined to a single root, `$HOME` by default. Change it with `BRANCH_MATRIX_ROOT`:

```sh
BRANCH_MATRIX_ROOT=/Users/handiani/projects npm run dev
```

Every control (search, author filter, refresh, add repo) lives in the sticky header, so it stays
reachable on long tables. Press `/` to jump to search, `d` to toggle the theme, and `⌘K` (Ctrl+K)
to jump to any repo, page or ticket. Filters live in the URL, so a filtered view can be bookmarked
or shared.

Repos can sit in one **group** (a section on the overview) and carry any number of **tags**. The
Tag filter shows only repos that have every selected tag; edit both from a repo's Edit dialog or
from Manage repos.

## Running it in the background

```sh
npm run build
./scripts/service.sh install      # starts at login, restarts if it dies
./scripts/service.sh status
./scripts/service.sh logs
./scripts/service.sh restart      # rebuild + restart, after changing code
./scripts/service.sh uninstall
```

This installs a LaunchAgent (`~/Library/LaunchAgents/com.gitbranchmatrix.app.plist`) that runs
`next start` bound to `127.0.0.1` — loopback only, since the dashboard has no authentication and
the machine may sit on a shared network. Logs go to `~/Library/Logs/git-branch-matrix.log`.

`KeepAlive` is on, so if Postgres is not up yet at login the service simply retries until it is.

**After changing code, run `./scripts/service.sh restart`.** Running `npm run dev` in the same
checkout overwrites `.next`, which leaves the production build broken — the symptom is a 500 with
`Cannot find module './vendor-chunks/…'` in the log.

The pf redirect from step "A nicer URL" does **not** survive a reboot on its own:

```sh
sudo ./scripts/service.sh pf      # LaunchDaemon that reloads pf at boot
```

### Known tradeoff with the port-80 redirect

While the pf redirect is loaded, `http://127.0.0.1:4321` stops answering directly — on loopback
the reply packets traverse `lo0` again and hit the redirect's state. `http://gbm.local` keeps
working, which is what you actually use. If you would rather keep direct port access, drop the
redirect and live with the port suffix:

```sh
sudo ./scripts/hostname.sh uninstall
sudo ./scripts/hostname.sh install     # http://gbm.local:4321
```

## When is a ticket "done"?

Per repo, via `done_envs` (default `release, main`). A ticket is done once it has landed in **all**
of those — not in every environment. That way a hotfix merged straight to `release` and `main`,
skipping `development` and `staging`, still counts as shipped.

`done_envs` is intersected with the environments the repo actually has, so a repo without
`release` still behaves sensibly. If none of them exist, it falls back to requiring every
environment. Columns that decide done are shown at full contrast in the table header; the rest are
dimmed — they still show progress, they just do not gate completion.

## Architecture

```
  local clone ──► lib/git.ts ──┐
  (rev-parse, for-each-ref,    ├──► lib/overview.ts ──► app/page.tsx ──► components/matrix/*
   log — READS only)           │         ▲
                               │         │
  Postgres  ──► lib/db.ts ─────┘         └── app/actions.ts (the only WRITES)
  (manual notes)
```

| File              | What it holds                                               |
| ----------------- | ----------------------------------------------------------- |
| `lib/git.ts`      | read-only git layer + `buildModel()`                        |
| `lib/db.ts`       | Postgres queries, pool singleton on `globalThis`            |
| `lib/browse.ts`   | directory listing for the folder picker, confined to a root |
| `lib/overview.ts` | merges git + notes, reads every repo in parallel            |
| `app/actions.ts`  | server actions: add/remove repo, save note                  |
| `db/schema.sql`   | `repo` + `branch_note` tables                               |

### Why it is built this way

- **`READ_ONLY_COMMANDS` in `lib/git.ts`** — an allowlist. Anything outside `rev-parse`,
  `for-each-ref`, `log`, `remote` throws. If someone later adds `git fetch` or `git checkout`,
  it fails loudly instead of quietly touching the repo.
- **`export const dynamic = "force-dynamic"` in `app/page.tsx`** — git state changes on every
  merge. Without it Next caches and you read a stale matrix.
- **Pool stored on `globalThis`** — `next dev` re-evaluates modules on every edit; without this,
  Postgres connections pile up until they are refused.
- **`import "server-only"`** in `lib/git.ts` and `lib/db.ts` — `child_process` and `pg` must never
  reach the client bundle.

## How the data is derived

1. **Containment** — `for-each-ref --merged origin/<env>` tells you which branches already sit
   inside each environment.
2. **Merge commits** — `Merge pull request #N from owner/branch` is parsed for the PR number,
   the merge date, and branches that were **deleted** afterwards. Squash merges (`subject (#N)`)
   are picked up too.
3. **Ticket regex** — over branch names and commit messages. A branch carrying more than one
   ticket is flagged ⧉ combined.
4. **Author** — from the branch tip while the branch exists. Once deleted, it is recovered from
   the merge commit's second parent (the merged branch tip), so you still see **who wrote it**,
   not who clicked merge. Squash merges have no second parent, so those fall back to the merge
   commit author and are labelled "(from merge commit)" in the detail panel.
5. **Postgres** — notes, status, and tickets that appear in no branch name at all.

## Opening a pull request

An environment a ticket has not reached yet shows `·`; hovering turns it into **+ PR**, which
opens the host's compare page in a new tab with the form already expanded:

```
https://github.com/owner/repo/compare/{env}...{branch}?expand=1
```

GitHub, GitLab and Bitbucket URL shapes are all handled; the host is detected from
`git remote get-url`. The detail panel carries the same link per branch per environment, which is
where you go when a ticket spans more than one branch.

No link is shown when there is nothing sensible to point at: the branch is already merged there,
the branch has been deleted, the remote host is not one we know, or the ticket has several live
branches so the head would be ambiguous.

Note `lib/remote.ts` exists purely so this works. Client components need `pullRequestUrl`, and
importing it from `lib/git.ts` would drag `child_process` into the browser bundle — the
`server-only` guard rejects the build if you try.

## Icon

The mark is the app's own matrix: filled cells for environments a ticket has reached, dark cells
for the ones it has not. Sources live in `assets/`; the files Next actually serves are
`app/icon.svg`, `app/apple-icon.png` (180px) and `app/favicon.ico`.

`favicon.ico` carries size-specific art — a simplified 2×2 grid at 16px, the full 3×3 at 32 and
48 — because nine cells turn to mush at 16 physical pixels. Modern browsers prefer `icon.svg`
over the `.ico`, which on a HiDPI screen renders at 32 device pixels and stays crisp. On a
non-HiDPI monitor they will render the 3×3 at 16px and it does get muddy; if that bothers you,
copy `assets/icon-16.svg` over `app/icon.svg`.

To regenerate everything after editing the sources, see the snippet in `assets/README.md`.

## Names that stay as they are

The app is **Git Branch Matrix**, but a few identifiers still read `branch-matrix`, deliberately:

| Identifier                                       | Why                                                   |
| ------------------------------------------------ | ----------------------------------------------------- |
| `branch_matrix` database                         | renaming means dumping and restoring live notes       |
| `branch-matrix` pf anchor + `/etc/pf.conf` entry | root-owned; the uninstall path matches on this name   |
| `# branch-matrix` marker in `/etc/hosts`         | same — `hostname.sh uninstall` finds its line by this |
| the `branch-matrix-next` directory               | the installed LaunchAgent points at this path         |

The LaunchAgent label _was_ migrated (`com.branchmatrix.app` → `com.gitbranchmatrix.app`);
`service.sh install` boots out the old one first, so you never end up with two.

## Limits

- **Not deployable to Vercel or any serverless host.** This reads git clones from disk. Run it on
  your machine, or on a server that holds the clones.
- **Only as fresh as your last `git fetch`.** This app never calls `git fetch` itself.
- A squash merge with no ticket ID in the commit message is invisible — it shows up as `#<PR>`.
- Merge commit scanning is capped by `scan_limit` per repo (default 500).
- Environment guessing only matches common names (`development`, `staging`, `release`, `main`, …).
  A stale branch like `master` can be picked up — check before saving.
- Tables paginate client-side (25 per page by default), sorted by **Updated desc**. Click a column
  header to change it.
- The folder picker is server-side, not an OS dialog. Browsers never hand a web page an absolute
  path, so there is no other way.
