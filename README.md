# Git Branch Matrix

Track tickets against environments (`development` / `staging` / `release` / `main`) straight from
your local git clones. Multi-repo.

**Git is read-only.** Every write goes to Postgres.

## Setup

```sh
npm install
cp .env.example .env.local   # every key is optional; set BRANCH_MATRIX_DB for your Postgres
npm run db:init          # createdb branch_matrix + apply db/schema.sql
npm run dev              # http://localhost:4321
```

Override the port with `PORT=5000 npm run dev`.

`db/schema.sql` is idempotent and carries its own migrations — after pulling, run `npm run db:init`
again (or pipe the file into `psql` for a Postgres in Docker).

### Docker

Meant for any Docker runtime — Docker Desktop, OrbStack, or Docker Engine on Linux.

```sh
cp .env.example .env.docker   # set BRANCH_MATRIX_DB with host.docker.internal instead of localhost
npm run docker:up             # build + (re)start → http://localhost:4321
```

`npm run docker:up` is `docker compose --env-file .env.docker up -d --build`, so `.env.docker` is
the one file to edit: it fills `docker-compose.yml` (`BRANCH_MATRIX_ROOT`, `PORT`,
`NEXT_PUBLIC_TIME_ZONE`) and becomes the container's environment (`BRANCH_MATRIX_DB`, `TZ`).

`BRANCH_MATRIX_ROOT` (default `~/projects`) is mounted read-only at the same path, so repo paths
stay valid both natively and in the container.

The container runs a production build baked into the image — it does not see your source. **After
changing code, run `npm run docker:up` again**, or the old build keeps being served. Don't run it
alongside `scripts/service.sh` — both want port 4321.

Per runtime:

- **OrbStack** also serves it at `http://gbm.orb.local` (a label every other runtime ignores).
- **Docker Engine on Linux** reaches the host through the docker0 bridge, not loopback. Postgres
  and the fetch helper must listen there too — e.g. `FETCH_HELPER_HOST=172.17.0.1` for the helper
  and `listen_addresses` / `pg_hba.conf` for Postgres. `docker-compose.yml` already maps
  `host.docker.internal` to the host with `host-gateway`.

### Fetching

The app never writes to git, so the refresh button's `git fetch --prune` runs in a small helper on
the host instead — as you, with your own SSH keys, listening on `127.0.0.1:4329` only:

```sh
npm run fetch-helper                # foreground, any OS
./scripts/fetch-helper.sh install   # macOS: auto-start at login; also status, logs, uninstall
```

Without it the button still re-reads, it just can't fetch first. The app reaches it through
`FETCH_HELPER_URL` (`http://host.docker.internal:4329` in Docker). The helper is confined to
`BRANCH_MATRIX_ROOT` (default `~/projects`) and only fetches — it never touches a working tree.
It does not read `.env` files; set `FETCH_HELPER_PORT` / `FETCH_HELPER_HOST` / `BRANCH_MATRIX_ROOT`
in the shell that starts it.

### A nicer URL (macOS)

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
BRANCH_MATRIX_ROOT=~/projects npm run dev
```

Every page is fixed to the viewport: the header with every control (search, author and tag
filters, refresh, add repo) never scrolls away, and only the list itself scrolls — the table on
the overview, a repo and Tickets, the sections on Manage repos — with its column headings pinned.
**Back** returns you to the list where you left it, filters and scroll position included.

Press `/` to jump to search, `d` to toggle the theme, and `⌘K` (Ctrl+K) to jump to any repo, page
or ticket. Filters live in the URL, so a filtered view can be bookmarked or shared.

Repos can sit in one **group** (a section on the overview) and carry any number of **tags**. The
Tag filter shows only repos that have every selected tag; edit both from a repo's Edit dialog or
from Manage repos.

## Running it in the background (macOS)

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

## Other platforms

The app, `npm run fetch-helper` and Docker run anywhere Node 22 and git do. Only the convenience
scripts are macOS-only and refuse to run elsewhere:

| Script                    | Uses                            | Elsewhere                                                                              |
| ------------------------- | ------------------------------- | -------------------------------------------------------------------------------------- |
| `scripts/service.sh`      | launchd LaunchAgent, pf         | `npm run docker:up` (`restart: unless-stopped`), or a systemd unit running `npm start` |
| `scripts/fetch-helper.sh` | launchd LaunchAgent             | a systemd user unit / Task Scheduler running `npm run fetch-helper`                    |
| `scripts/hostname.sh`     | `/etc/hosts`, pf, `dscacheutil` | add `127.0.0.1 gbm.test` to your hosts file by hand                                    |

`npm run db:init` needs the Postgres client tools (`createdb`, `psql`) on your PATH; with Postgres
in Docker, pipe `db/schema.sql` into `psql` inside that container instead.

Dates render in `NEXT_PUBLIC_TIME_ZONE` (default UTC) on the server and switch to the browser's
own zone after hydration — set it to yours to avoid the brief jump.

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

| File                       | What it holds                                                                  |
| -------------------------- | ------------------------------------------------------------------------------ |
| `lib/git.ts`               | read-only git layer + `buildModel()`                                           |
| `lib/db.ts`                | Postgres queries, pool singleton on `globalThis`                               |
| `lib/browse.ts`            | folder picker listing and the `~/projects` scan, confined to a root            |
| `lib/overview.ts`          | merges git + notes, reads every repo in parallel                               |
| `lib/remote.ts`            | pull-request URLs per host — client-safe, no node APIs                         |
| `lib/tags.ts`              | tag normalising and the AND match                                              |
| `lib/time.ts`              | dates in the viewer's timezone (`NEXT_PUBLIC_TIME_ZONE` is the SSR fallback)   |
| `app/actions.ts`           | server actions: add/edit/archive/reorder repos, notes, browse, scan, fetch     |
| `hooks/use-scroll-memory`  | puts a list back where it was on Back, since the page itself never scrolls     |
| `hooks/use-back-to`        | Back goes back in history when we came from inside the app, else to a fallback |
| `scripts/fetch-helper.mjs` | the one process that runs `git fetch`, on the host, loopback only              |
| `db/schema.sql`            | `repo` + `branch_note` tables, with idempotent migrations                      |

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

## Development

```sh
npm run lint        # must be 0 errors
npm run typecheck
npm run format
```

A Husky pre-commit hook (installed by `npm install` via `prepare`) runs Prettier + `eslint --fix`
on the staged files through lint-staged, then `tsc --noEmit`. An ESLint error blocks the commit.

**Complexity limits are errors**, as in service-inventory-frontend:

- `complexity` ≤ 15 — counts every `?.`, `??`, `&&`, `||` and ternary.
- `sonarjs/cognitive-complexity` ≤ 15 — weighs nesting.

Fix a function that crosses either by extracting named helpers **in the same file** —
`buildModel()` in `lib/git.ts` is the worked example — never with `eslint-disable`.
`components/ui/**` is exempt: those are shadcn components published through `registry.json` /
`public/r`, kept close to upstream.

## Limits

- **Not deployable to Vercel or any serverless host.** This reads git clones from disk. Run it on
  your machine, or on a server that holds the clones.
- **Only as fresh as your last `git fetch`.** The app itself never fetches; the refresh button does,
  through the fetch helper, when it is installed.
- A squash merge with no ticket ID in the commit message is invisible — it shows up as `#<PR>`.
- Merge commit scanning is capped by `scan_limit` per repo (default 500).
- Environment guessing only matches common names (`development`, `staging`, `release`, `main`, …).
  A stale branch like `master` can be picked up — check before saving.
- A repo's table paginates client-side (25 per page by default), sorted by **Last commit**, newest
  first. Click a column header to change it. The page you are on is not in the URL, so Back
  returns to page 1.
- The folder picker is server-side, not an OS dialog. Browsers never hand a web page an absolute
  path, so there is no other way.
