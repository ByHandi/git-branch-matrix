# Roadmap

UX work for when the dashboard tracks many repos. Today every repo renders as a full card with its
whole table, stacked vertically — fine for 2–3 repos, heavy past 10.

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

## Phase 2 — Onboarding and freshness

- [ ] **Bulk add.** A "Scan `~/projects`" action lists every git repo not yet tracked, with
      checkboxes. Envs are guessed per repo the way `probeRepoAction` already does, saved in one go.
- [ ] **Stale-data indicator.** The app never runs `git fetch` (by design), and in Docker the repos
      are mounted read-only, so a repo you forgot to fetch silently goes stale. Read the mtime of
      `.git/FETCH_HEAD` (no write needed) and show a badge: yellow > 1 day, red > 1 week.

## Phase 3 — Organising repos

- [ ] **Cross-repo view by ticket.** One Jira ticket often spans FE + BE + services. A "By ticket"
      view shows `ABC-123` with its env status in every repo on one row.
- [ ] **Groups / tags and pinning.** Group related repos (e.g. all `telescope-*` services) into a
      collapsible section; pin frequently used repos to the top. Drag-to-reorder backed by the
      existing, currently unused `repo.sort_order` column.
- [ ] **Archive instead of only Remove.** `repo.archived` and `listRepos(includeArchived)` already
      exist. Archiving hides a repo but keeps its branch notes; Remove deletes them.
- [ ] **Edit repo config.** Only Add and Remove exist today, so changing envs or the ticket pattern
      means remove + re-add, which drops the branch notes.

## Quick wins

- [ ] **Filters in the URL** (`?q=…&author=…&open=1`) so they survive a refresh and can be
      bookmarked or shared.
- [ ] **⌘K palette** to jump to a repo or ticket.
- [ ] **Highlight stuck tickets**, e.g. sitting in staging for more than 7 days without reaching
      release.
