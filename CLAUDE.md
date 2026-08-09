# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

**Keep this file current.** It is the navigation map for the project — when you add a
module, land a route, change a convention, or discover a gotcha, update the relevant
section in the same turn. A stale map is worse than no map.

## What this repo is

A note-taking web app: better-auth email/password auth, raw-SQL SQLite storage,
a TipTap rich-text editor, and public note sharing via slug.

`SPEC.MD` is the source of truth for intended design, schema, and API shape — read it
before feature work, but follow the repo over the spec where "Where SPEC.MD is out of
date" below says so. `SPEC.MD` is tracked in git.

## Current state

**The backend foundation is complete and the database is live.** What remains is the
data layer for notes, the API routes, and all of the UI.

### Built and working

| Path | What it does |
| --- | --- |
| `lib/db.ts` | `better-sqlite3` singleton parked on `globalThis` (survives dev HMR). WAL mode, `foreign_keys = ON`. Exports `getDb()` plus `query<T>` / `get<T>` / `run` helpers. |
| `lib/auth.ts` | better-auth instance — email+password enabled, `nextCookies()` plugin **last** in the plugin array. |
| `lib/auth-client.ts` | React client; re-exports `signIn`, `signUp`, `signOut`, `useSession`. |
| `app/api/auth/[...all]/route.ts` | better-auth handler via `toNextJsHandler`. |
| `scripts/init-db.ts` | Creates the `notes` table + its three indexes. Guards on the `user` table existing first. |
| `next.config.ts` | `serverExternalPackages: ["better-sqlite3"]` — already set. |
| `.gitignore` | `.env*` with a `!.env.example` negation, and `/data/*.db*`. Both fixed. |

`data/app.db` exists and contains all five tables: `account`, `notes`, `session`,
`user`, `verification`. No migration step is needed to start working.

### Stubs — placeholder markup only, no logic

`app/page.tsx` (still the scaffold demo), `app/authenticate/page.tsx`,
`app/dashboard/page.tsx`, `app/notes/[id]/page.tsx`, `app/p/[slug]/page.tsx`.

### Not created yet

- **`lib/notes.ts`** — the data layer. Everything else depends on it. Signatures in
  `SPEC.MD` §6.4: `listNotes`, `getNote`, `createNote`, `updateNote`, `deleteNote`,
  `setNotePublic`, `getNoteByPublicSlug`.
- **`app/api/notes/*`** — no route handlers exist.
- **`components/`** — directory does not exist. Spec §8.2 wants `NoteEditor`,
  `NoteList`, `ShareToggle`, `PublicNoteViewer`.
- **`middleware.ts`** — no optimistic cookie gate yet.

## Commands

Use **npm**. Both `bun.lock` and `package-lock.json` are committed, but the project
targets the Node.js runtime — treat `bun.lock` as stale. (`.claude/settings.local.json`
still allowlists `bun run …` from earlier sessions; that is history, not guidance.)

| Task | Command |
| --- | --- |
| Dev server | `npm run dev` |
| Production build | `npm run build` |
| Serve the build | `npm start` |
| Lint | `npm run lint` |
| Type check | `npm run typecheck` |
| Create auth tables | `npm run db:auth` |
| Create `notes` table | `npm run db:init` |

- `npm run lint` invokes bare `eslint`, not `next lint` — Next.js 16 removed `next lint`.
- `db:auth` must run before `db:init`; `notes.user_id` references `user(id)`.
- **No test framework.** `npm run typecheck` is the only automated gate. If you add
  tests, wire the runner into `package.json` yourself.

## Environment

`.env` and `.env.example` are both present and agree with the spec on all three names:

- `BETTER_AUTH_SECRET` — 32+ chars
- `BETTER_AUTH_URL` — `http://localhost:3000` in dev
- `DATABASE_PATH` — `data/app.db`, resolved from the project root

`scripts/init-db.ts` reads these via `node --env-file=.env`; Next loads them itself.

## Where SPEC.MD is out of date

The spec was written against older tooling. Follow the repo, not the spec, here:

- **§10 "configure Tailwind in `tailwind.config.ts`"** — wrong. This is Tailwind v4,
  CSS-first. No `tailwind.config.ts` exists and adding one will not be read. Theme
  tokens live in `app/globals.css` under `@import "tailwindcss"` + `@theme inline`.
- **§9.1 TipTap extension list** — wrong for the installed version. `@tiptap/starter-kit`
  v3 already bundles `Code`, `CodeBlock`, `Link`, `Underline`, and the list extensions.
  Passing them alongside `StarterKit` registers them twice and TipTap warns about
  duplicates. Configure via `StarterKit.configure({...})`, or disable the bundled one
  before adding a replacement (e.g. `CodeBlockLowlight`).
- **§6.3 env var names** — already reconciled; the spec's names are what's in use.
- **§12 steps 1–8** — scaffold, deps, DB, and auth wiring are done.

## Conventions and gotchas

- **`@/*` resolves to the repo root**, not `src/`. There is no `src/` — the App Router
  lives at `app/`.
- **Next 16 async params.** Dynamic route `params` is a `Promise` and must be awaited:
  `const { slug } = await params`. Both existing dynamic pages already do this.
- **`allowImportingTsExtensions` is on** so `scripts/*.ts` can run through Node's type
  stripping — relative imports in `scripts/` need the explicit `.ts` extension
  (`import { getDb } from "../lib/db.ts"`). Safe because `noEmit` is set.
- **No route importing the DB may declare `runtime = "edge"`.** `better-sqlite3` is a
  native module.
- **`middleware.ts` runs on Edge**, so it can only do an optimistic cookie check. The
  authoritative `auth.api.getSession()` call belongs in the server component or route
  handler.
- **`ignoreScripts` and `trustedDependencies` in `package.json` are bun-only fields.**
  npm ignores both.
- **`@types/better-sqlite3` is `^9.6.0` against `better-sqlite3` `^12.11.1`** — three
  majors stale. Bump to `^12` when convenient.

## Auth and schema ownership

better-auth owns `user`, `session`, `account`, and `verification`. Do not hand-write or
hand-alter them — run `npm run db:auth`. Extra user fields go through
`user.additionalFields` in `lib/auth.ts` followed by a re-migrate, never a manual
`ALTER TABLE`.

Credentials live in `account` (`providerId = "credential"`, hashed `password`), never on
`user`.

The `notes` table is application-owned and hand-maintained in `scripts/init-db.ts`. It
references `user(id)` with `ON DELETE CASCADE`, so the auth tables must exist first.
SQLite does not enforce foreign keys unless `PRAGMA foreign_keys = ON` is set per
connection — `lib/db.ts` does this.

### `notes` schema

```sql
id           TEXT    NOT NULL PRIMARY KEY,
user_id      TEXT    NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
title        TEXT    NOT NULL,
content_json TEXT    NOT NULL,   -- TipTap JSON, stringified
is_public    INTEGER NOT NULL DEFAULT 0,
public_slug  TEXT    UNIQUE,     -- nanoid, NULL when unshared
created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
```

Indexed on `user_id`, `public_slug`, `is_public`.

Note the DB uses `snake_case` while the spec's TypeScript `Note` type (§6.4) uses
`camelCase` — the data layer is responsible for mapping between them.
