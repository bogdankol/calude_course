# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

**Keep this file current.** It is the navigation map for the project — when you add a
module, land a route, change a convention, or discover a gotcha, update the relevant
section in the same turn. A stale map is worse than no map.

Whenever working with a library or similar stuff - you have too look up the docs to ensure that you are doing something correctly and in correct way.
use D:\start\MAX_SHVARCMULLER-starting-project\.claude\agents\DocsExplorer.md subagent for efficient documentation lookup.

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
| `app/authenticate/page.tsx` | Server component. Reads `?mode=signup` (anything else = login), redirects a live session to `/dashboard`, renders `AuthForm` + the mode-toggle `Link`. `generateMetadata` retitles per mode. |
| `components/AuthForm.tsx` | Client component. Email+password sign-in / sign-up against `lib/auth-client.ts`, uncontrolled inputs, `router.push("/dashboard")` on success. |
| `app/dashboard/page.tsx` | Server component, **gated in the route itself** (not a layout): `getSession` → `redirect("/authenticate")` when absent. Renders the email and `LogoutButton`. Notes list still a placeholder. |
| `components/LogoutButton.tsx` | Client component. `useTransition` + `signOut()`, then `router.push("/authenticate")` and `router.refresh()`. Absolutely positioned at `top-[50px] right-[200px]`, `size-[100px]`. |
| `scripts/init-db.ts` | Creates the `notes` table + its three indexes. Guards on the `user` table existing first. |
| `next.config.ts` | `serverExternalPackages: ["better-sqlite3"]` — already set. |
| `.gitignore` | `.env*` with a `!.env.example` negation, and `/data/*.db*`. Both fixed. |

`data/app.db` exists and contains all five tables: `account`, `notes`, `session`,
`user`, `verification`. No migration step is needed to start working.

### Stubs — placeholder markup only, no logic

`app/notes/[id]/page.tsx`, `app/p/[slug]/page.tsx`.

`app/page.tsx` is **not** a stub — it is a finished spec §8.1 landing page with working
CTAs to `/authenticate` and `/authenticate?mode=signup`, and the target page now reads
that `mode` param. `app/authenticate/page.tsx` is likewise finished, and
`app/dashboard/page.tsx` has a real auth gate (its notes list is still a placeholder).

The two client components are `components/AuthForm.tsx` and `components/LogoutButton.tsx`
— no other file carries `"use client"`. Between them they consume `signIn` / `signUp` /
`signOut` from `lib/auth-client.ts`; **`useSession` is the last dead export**, with no
call sites. All five tables have 0 rows.

`/authenticate` and `/dashboard` both check the session authoritatively.
**`/notes/[id]` still answers 200 to an anonymous request** — it has no gate yet.

### Not created yet

- **`lib/notes.ts`** — the data layer. Everything else depends on it. Signatures in
  `SPEC.MD` §6.4: `listNotes`, `getNote`, `createNote`, `updateNote`, `deleteNote`,
  `setNotePublic`, `getNoteByPublicSlug`.
- **`app/api/notes/*`** — no route handlers exist.
- **`components/`** — exists, holds `AuthForm.tsx` and `LogoutButton.tsx`. Spec §8.2
  still wants `NoteEditor`, `NoteList`, `ShareToggle`, `PublicNoteViewer`.
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
- **`db:auth` currently invokes the wrong package.** `package.json` runs
  `npx @better-auth/cli@latest migrate`, but that name is superseded — its `latest` is
  frozen at **1.4.21** while the installed `better-auth` core is **1.6.25**. The
  maintained CLI is the bare `auth` package (**1.6.26**), which is what `SPEC.MD` §5.1
  and §12 already prescribe: `npx auth@latest migrate`. It is not vendored, so npx
  re-downloads the stale 1.4.21 on every run. Fix the script before the next migrate.
  The schema it already produced is, however, **fine for email+password** — sign-up,
  duplicate-email rejection, wrong-password rejection, session issue, and the
  authenticated redirect were all exercised against `data/app.db` and behave correctly.
  Treat the version gap as a risk for *future* migrations, not as a broken database.
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
- **Next 16 renamed `middleware.ts` to `proxy.ts`.** `node_modules/next/dist/lib/
  constants.js` defines `PROXY_FILENAME` alongside the legacy `MIDDLEWARE_FILENAME`.
  `middleware.ts` still works but is deprecated, and `proxy.ts` runs on the **Node.js
  runtime, which cannot be configured to edge**. So the old "it's Edge, therefore cookie
  check only" reasoning no longer applies — a full `auth.api.getSession()` is mechanically
  possible there. Keep it to a cookie check anyway, for latency, and **always** re-check
  authoritatively in the server component or route handler: a cookie-existence test is
  forgeable and is not a security boundary.
- **`ignoreScripts` and `trustedDependencies` in `package.json` are bun-only fields.**
  npm ignores both.
- **`@types/better-sqlite3@^9.6.0` against `better-sqlite3@^12.11.1` is NOT a mismatch.**
  `npm view @types/better-sqlite3 dist-tags.latest` → `9.6.0`. DefinitelyTyped does not
  track the library's major. There is no `^12` to bump to — leave it alone.
- **`lib/db.ts`'s `query`/`get`/`run` take `unknown[]`, which type-checks values the
  driver rejects at runtime.** better-sqlite3 binds only `number | string | bigint |
  Buffer | null`. Measured against the real schema: `true` throws `TypeError`; a plain
  object is silently reinterpreted as a **named-parameter bag** (`RangeError: Too few
  parameter values`); `undefined` **silently binds NULL**. This bites exactly the payloads
  spec §7.2 specifies — `{"isPublic": true}`, object-valued `contentJson`, and a `Partial`
  update forwarding an absent key. Coerce at the boundary (`isPublic ? 1 : 0`,
  `JSON.stringify(...)`, omit absent keys from the SQL) and narrow the param type before
  writing `lib/notes.ts`. The helpers have **no call sites yet**, so typecheck proves
  nothing here.

- **Do not submit auth forms through a React 19 `<form action={…}>`.** `useActionState`'s
  dispatch wraps the action in `requestFormReset` (`react-dom-client.development.js`
  ~line 8955), so React clears every uncontrolled field once the action settles —
  including when it settles with a validation error. A failed login would blank the email
  the user just typed. `components/AuthForm.tsx` therefore uses a plain `onSubmit` handler
  with `new FormData(event.currentTarget)`, which keeps the inputs uncontrolled *and*
  keeps their values. Controlled inputs would also work; form actions would not.
- **Switching `?mode=` does not remount `AuthForm`.** It is a same-route navigation, so
  React reuses the mounted instance and any error state survives the switch. `AuthForm`
  tags each error with the mode that produced it and renders it only under that mode.
- **Sign-up collects email and password only — by design.** No name, no profile fields.
  better-auth's sign-up body schema still *requires* `name`: omitting it returns
  `400 {"code":"VALIDATION_ERROR","message":"[body.name] Invalid input"}`. An empty
  string is accepted, so `AuthForm` sends `name: ""` and `user.name` is stored empty.
  Both behaviours are verified against the running app. Anything rendering `user.name`
  later must fall back to `user.email`.
- **Password reset is already off and needs no code.** better-auth mounts
  `/api/auth/request-password-reset` whenever `emailAndPassword.enabled` is true, but the
  handler short-circuits when `sendResetPassword` is unconfigured — verified live: it
  returns `400 {"code":"RESET_PASSWORD_DISABLED"}` and never mints a token. There is no
  flag that unmounts the route; leaving `sendResetPassword` unset *is* the documented
  way to disable the feature.
- **better-auth error codes worth mapping** (all confirmed against the running app):
  `INVALID_EMAIL_OR_PASSWORD` (401), `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` (422 — note
  the sign-up route throws this, *not* the bare `USER_ALREADY_EXISTS`), `PASSWORD_TOO_SHORT`
  (400). Default password bounds are 8–128 and `autoSignIn` defaults to **on**, so a
  successful sign-up already carries a session cookie.

- **`/api/auth/sign-out` enforces an `Origin` check; sign-up and sign-in do not.** A
  `curl`/PowerShell probe without an `Origin` header gets `403
  {"code":"MISSING_OR_NULL_ORIGIN"}` and the session survives — this is the *test
  harness* failing, not the app. Browsers always attach `Origin` to a same-origin
  `fetch`, so `signOut()` from a client component works. Send `-H "Origin:
  http://localhost:3000"` when probing it by hand.
- **Route gates go in the page, not a layout.** A layout is not re-rendered on every
  navigation inside its segment, so a session check placed there can go stale while the
  user moves between routes. `app/dashboard/page.tsx` calls `getSession` directly. Adding
  a gate to `/notes/[id]` means repeating the same three lines in that page.
- **Never run an unfiltered `DELETE FROM user` against `data/app.db`.** It is a live dev
  database that the developer signs into by hand — real accounts live there alongside any
  test rows. Scope every cleanup with a `WHERE email LIKE …` matching the exact probe
  addresses you created.

## Auth and schema ownership

better-auth owns `user`, `session`, `account`, and `verification`. Do not hand-write or
hand-alter them — run `npm run db:auth`. Extra user fields go through
`user.additionalFields` in `lib/auth.ts` followed by a re-migrate, never a manual
`ALTER TABLE`.

Credentials live in `account` (`providerId = "credential"`, hashed `password`), never on
`user`.

The `notes` table is application-owned and hand-maintained in `scripts/init-db.ts`. It
references `user(id)` with `ON DELETE CASCADE`, so the auth tables must exist first.
`lib/db.ts` sets `PRAGMA foreign_keys = ON` per connection. Note the usual rationale for
that line is **wrong for this driver**: better-sqlite3 compiles SQLite with
`SQLITE_DEFAULT_FOREIGN_KEYS=1`, so FKs are already enforced — verified via
`PRAGMA compile_options` on the live file, and by a fresh connection that sets no pragmas
reporting `foreign_keys = 1`. Keep the line as cheap insurance against a driver swap
(`node:sqlite` uses the stock default of OFF), but do not treat FK enforcement here as
fragile. The per-connection claim in `SPEC.MD` §5.1 is true of stock SQLite only.

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

Indexed on `user_id`, `public_slug`, `is_public` — but only the first earns its place.
`public_slug TEXT UNIQUE` already creates an implicit unique index, so the hand-written
`idx_notes_public_slug` is a pure duplicate (`index_list` shows both: `origin=c` next to
`origin=u`, same column) and costs write amplification. `idx_notes_is_public` has two
distinct values and no §6.2 function filters on it alone. A composite
`notes(user_id, updated_at DESC)` would serve the dashboard list far better than either.

Note the DB uses `snake_case` while the spec's TypeScript `Note` type (§6.4) uses
`camelCase` — the data layer is responsible for mapping between them.
