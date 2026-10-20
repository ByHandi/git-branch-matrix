# Roadmap

UX work for when the dashboard tracks many repos. It started with every repo rendered as a full card
with its whole table, stacked vertically — fine for 2–3 repos, heavy past 10.

## Phase 1 — Scale to many repos ✅

- [x] **Overview page + per-repo drill-down.** `/` becomes a compact table, one row per repo: open
      tickets, tickets per env (e.g. "5 stuck in staging"), last updated. Clicking a row opens the
      full table at `/repo/[id]`.
- [x] **Stream repos instead of waiting for the slowest.** `loadOverview()` in `lib/overview.ts`
      uses `Promise.all`, so nothing renders until every repo has been read. Wrap each repo in its
      own `<Suspense>` so fast repos show immediately.
- [x] **Hide empty repos while filtering.** With a search / author / "Open only" filter active,
      repos with no matches currently still render a "nothing matches" card. Collapse them into a
      single "N repos hidden" line instead.
- [x] **Search matches repo names.** Typing a repo's name shows that repo with all its tickets,
      instead of hunting for tickets whose id or branch happens to contain the text.

## Phase 2 — Onboarding and freshness ✅

- [x] **Bulk add.** A "Scan `~/projects`" action lists every git repo not yet tracked, with
      checkboxes. Envs are guessed per repo the way `probeRepoAction` already does, saved in one go.
- [x] **Stale-data indicator.** The app never runs `git fetch` (by design), and in Docker the repos
      are mounted read-only, so a repo you forgot to fetch silently goes stale. Read the mtime of
      `.git/FETCH_HEAD` (no write needed) and show a badge: yellow > 1 day, red > 1 week.
- [x] **Follow-up: smarter env guessing.** Scanning `~/projects` showed repos guessed as
      `development › dev › main` — both `dev` and `development` exist and both are taken as envs.
      Prefer one name per stage when several aliases are present. Done: true synonyms
      (`dev`/`develop`/`development`, `staging`/`stage`, `main`/`master`, `production`/`prod`)
      collapse to whichever saw the latest commit; distinct stages like main → production stay.

## Phase 3 — Organising repos ✅

- [x] **Cross-repo view by ticket.** One Jira ticket often spans FE + BE + services. A "By ticket"
      view shows `ABC-123` with its env status in every repo on one row.
- [x] **Groups / tags and pinning.** Group related repos (e.g. all `telescope-*` services) into a
      collapsible section; pin frequently used repos to the top. Drag-to-reorder backed by the
      existing, currently unused `repo.sort_order` column.
- [x] **Archive instead of only Remove.** `repo.archived` and `listRepos(includeArchived)` already
      exist. Archiving hides a repo but keeps its branch notes; Remove deletes them.
- [x] **Edit repo config.** Only Add and Remove exist today, so changing envs or the ticket pattern
      means remove + re-add, which drops the branch notes.
- [x] **Tags.** Any number of free-form tags per repo (`frontend`, `client-x`…), next to the
      single group. Edited as chips in the edit dialog and on Manage repos; a Tag filter in the header
      (AND: a repo needs every selected tag, `?tag=` in the URL) narrows the overview and the
      Tickets view; clicking a tag chip toggles it; ⌘K finds repos by tag.

## Quick wins ✅

- [x] **Filters in the URL** (`?q=…&author=…&open=1`) so they survive a refresh and can be
      bookmarked or shared.
- [x] **⌘K palette** to jump to a repo or ticket.
- [x] **Highlight stuck tickets**, e.g. sitting in staging for more than 7 days without reaching
      release.

## Phase 4 — Daily use ✅

- [x] **Fetch from the dashboard.** The refresh button runs `git fetch --prune` on the repos on
      screen through `scripts/fetch-helper.mjs`, a loopback-only helper on the Mac that uses your
      own SSH keys — the app and its read-only Docker mount still never write to git.
- [x] **Dates in the viewer's timezone.** Git keeps each author's offset and the container runs
      in UTC; absolute dates are now converted to the browser's zone after hydration.
- [x] **Back that keeps your place.** Back from a repo or Manage returns to where you came from
      with its filters intact, and falls back to the overview when the page was opened directly.
- [x] **Fixed viewport.** Pages no longer scroll — only their list does, with column headings
      pinned and the header, toolbars and pagination always in view. Scroll position is restored
      on Back.

## Housekeeping ✅

- [x] **Complexity gate.** `complexity` and `sonarjs/cognitive-complexity` at 15, enforced by a
      Husky + lint-staged pre-commit hook that also typechecks. `buildModel()`, `findRepos()` and
      the cross-repo ticket grouping were split into named helpers to get under it.
- [x] **`npm run docker:up`** rebuilds and restarts the OrbStack container in one step.
