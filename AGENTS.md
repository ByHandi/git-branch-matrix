<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

# Git Branch Matrix

Next.js 15 (App Router) dashboard that reads local git clones and tracks tickets across environment
branches. README.md has the full architecture; this is what to keep in mind while changing code.

`node_modules/next/dist/docs/` is not shipped with the installed Next 15.5 — check the official
docs for the 15.x line instead.

## Run & verify

```bash
npm run dev          # http://localhost:4321 (needs Postgres, see README)
npm run lint         # must be 0 errors
npm run typecheck
npm run docker:up    # rebuild the OrbStack container — it serves a baked build, not your source
```

There are no tests. The pre-commit hook (Husky + lint-staged) runs Prettier + `eslint --fix` on
staged files, then `tsc --noEmit`; ESLint errors block the commit.

## Lint limits are errors

- `complexity` ≤ 15 and `sonarjs/cognitive-complexity` ≤ 15.
- Fix by extracting a named helper in the same file (see `buildModel()` in `lib/git.ts`). Never
  `eslint-disable`. `components/ui/**` (shadcn registry, published via `public/r`) is exempt.

## Conventions

- **Git is read-only.** `lib/git.ts` only runs commands in `READ_ONLY_COMMANDS`; the only process
  that fetches is `scripts/fetch-helper.mjs`. Every write goes to Postgres via `app/actions.ts`.
- **Pages read on the server** (`force-dynamic` Server Components, one `<Suspense>` per repo on the
  overview). Client components call server actions for writes and the few on-demand reads (folder
  picker, scan, ⌘K); mutations `revalidatePath("/", "layout")`.
- **`server-only`** guards `lib/git.ts`, `lib/db.ts`, `lib/browse.ts`. Anything a client component
  needs from them lives in a node-free module (`lib/remote.ts`, `lib/tags.ts`, `lib/time.ts`).
- **Fixed viewport.** `body` is `h-dvh overflow-hidden`; a page is `flex min-h-0 flex-1 flex-col`,
  and only its list scrolls (`<Table containerClassName="min-h-0 overflow-auto">` with
  `<TableHeader sticky>`). Give that scroller `useScrollMemory()` so Back restores its position.
- **Browser storage** (`localStorage` / `sessionStorage`) is for per-browser conveniences only and
  every access is wrapped in `try/catch`.
