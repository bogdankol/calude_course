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

| Path                              | What it does                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/db.ts`                       | `better-sqlite3` singleton parked on `globalThis` (survives dev HMR). WAL mode, `foreign_keys = ON`. Exports `getDb()` plus `query<T>` / `get<T>` / `run` helpers.                                                                                                                                                                                        |
| `lib/auth.ts`                     | better-auth instance — email+password enabled, `nextCookies()` plugin **last** in the plugin array.                                                                                                                                                                                                                                                       |
| `lib/auth-client.ts`              | React client; re-exports `signIn`, `signUp`, `signOut`, `useSession`.                                                                                                                                                                                                                                                                                     |
| `app/api/auth/[...all]/route.ts`  | better-auth handler via `toNextJsHandler`.                                                                                                                                                                                                                                                                                                                |
| `app/authenticate/page.tsx`       | Server component. Reads `?mode=signup` (anything else = login), redirects a live session to `/dashboard`, renders `AuthForm` + the mode-toggle `Link`. `generateMetadata` retitles per mode.                                                                                                                                                              |
| `components/AuthForm.tsx`         | Client component. Email+password sign-in / sign-up against `lib/auth-client.ts`, uncontrolled inputs, `router.push("/dashboard")` on success.                                                                                                                                                                                                             |
| `app/dashboard/page.tsx`          | Server component, **gated in the route itself** (not a layout): `getSession` → `redirect("/authenticate")` when absent. Renders `Header` (with `LogoutButton` in its actions slot), the note count + email, a **"New Note"** link, and the notes list via `NoteList` — or an empty state with a "Create your first note" CTA.                             |
| `components/LogoutButton.tsx`     | Client component. `useTransition` + `signOut()`, then `router.push("/authenticate")` and `router.refresh()`. Now an inline pill so it can sit in `Header`'s `actions` slot — the old `absolute top-[50px] right-[200px] size-[100px]` box collided with the sticky header.                                                                                |
| `components/Header.tsx`           | Server component. "NextNotes" wordmark linking to `/dashboard` via `next/link`, plus an optional `actions` slot for page-owned controls. Deliberately **not** mounted in `app/layout.tsx` — see the gotcha below.                                                                                                                                         |
| `app/notes/new/page.tsx`          | Server component, session-gated exactly like the dashboard. Renders `Header`, a back link, and `NoteForm` (create mode).                                                                                                                                                                                                                                  |
| `app/notes/new/actions.ts`        | `"use server"`. `createNoteAction(formData)` — re-checks the session, zod-validates the title and the TipTap JSON, calls `createNote`, `revalidatePath("/dashboard")`, then `redirect("/notes/<id>")`. Returns `{ error }` only when it declines to save.                                                                                                 |
| `lib/tiptap.ts`                   | **Single source of truth for the note schema.** `HEADING_LEVELS` (`[1,2,3]`), `EMPTY_DOC`, and `noteExtensions()`. Both the editor and the read-only viewer call it, so their schemas cannot drift.                                                                                                                                                       |
| `components/NoteEditor.tsx`       | Client component. TipTap v3 `useEditor` + `EditorContent`, plus the full **SPEC.MD §9.2 toolbar**: a Normal/H1/H2/H3 segmented group, then Bold, Italic, inline code, bullet list, code block, horizontal rule, undo, redo. Active state comes from `useEditorState`; every button carries its keyboard shortcut in `title` _and_ `aria-label`.           |
| `app/notes/[id]/page.tsx`         | Server component, session-gated. **This is the editor**, per SPEC §8.1 — renders `Header`, a **Back** link to `/dashboard`, `DeleteNoteButton`, the note title as the `h1`, the UTC `updated_at`, and an editable `NoteForm` seeded with the stored title and document. `generateMetadata` retitles the tab. `notFound()` when the id is not this user's. |
| `app/notes/[id]/actions.ts`       | `"use server"`. `updateNoteAction(noteId, formData)` — validates, calls `updateNote`, revalidates both paths, and **returns without redirecting** so the user stays in the editor. `deleteNoteAction(noteId)` — calls `deleteNote`, then `redirect("/dashboard")`. Both re-check the session.                                                             |
| `lib/note-schema.ts`              | Shared zod validation (`NoteInputSchema`, `parseNoteInput`, `MAX_TITLE_LENGTH`) used by **both** the create and update actions so they cannot drift. Imports zod, so it is server-only — `NoteForm` keeps its own title-length constant rather than pulling zod into the client bundle.                                                                   |
| `components/NoteForm.tsx`         | Client component. **One form for both create and edit** — `noteId` present means edit. Uncontrolled title + `NoteEditor`; a plain `onSubmit` attaches the editor JSON to `FormData`. Creating redirects; editing shows "Saved" and calls `router.refresh()` so the `h1` and timestamp resync. Replaced `NewNoteForm.tsx`, which is deleted.               |
| `components/NoteContent.tsx`      | Client component. Read-only TipTap (`editable: false`) for a stored document. **Currently has no call sites** — `/notes/[id]` became the editor. Kept deliberately for `/p/[slug]` (spec §8.3 `PublicNoteViewer`): it encodes the fact that `generateHTML` cannot run server-side here. Do not "clean it up".                                             |
| `components/NoteList.tsx`         | Server component. SPEC §8.3 shape (`{ id, title, updatedAt, isPublic }[]`) — a `ul`/`li` of `Link`s to `/notes/[id]`, with the timestamp and a "Public" badge.                                                                                                                                                                                            |
| `components/DeleteNoteButton.tsx` | Client component. Confirms via a native `<dialog>` + `showModal()` (focus trap, Esc, inert background for free), then calls `deleteNoteAction`.                                                                                                                                                                                                           |
| `lib/format.ts`                   | `formatTimestamp` — SQLite's `datetime('now')` is UTC with a space separator, so it needs `T`/`Z` before `Date` parses it as UTC. Locale and zone are pinned so server environment cannot change the output. Shared by the note page and the list.                                                                                                        |
| `lib/notes.ts`                    | Data layer. `Note` type, the snake_case→camelCase row mapper, `EMPTY_DOC_JSON`, `createNote`, `getNoteById`, `getNotesByUser`, `updateNote`, `deleteNote`. All verified against the live DB (insert, trim, defaults, ordering, ownership, partial update, empty patch, double-delete, cleanup).                                                           |
| `scripts/init-db.ts`              | Creates the `notes` table + its three indexes. Guards on the `user` table existing first.                                                                                                                                                                                                                                                                 |
| `next.config.ts`                  | `serverExternalPackages: ["better-sqlite3"]` — already set.                                                                                                                                                                                                                                                                                               |
| `.gitignore`                      | `.env*` with a `!.env.example` negation, and `/data/*.db*`. Both fixed.                                                                                                                                                                                                                                                                                   |

`data/app.db` exists and contains all five tables: `account`, `notes`, `session`,
`user`, `verification`. No migration step is needed to start working.

### Stubs — placeholder markup only, no logic

`app/p/[slug]/page.tsx` — the last one.

`app/page.tsx` is **not** a stub — it is a finished spec §8.1 landing page with working
CTAs to `/authenticate` and `/authenticate?mode=signup`, and the target page now reads
that `mode` param. `app/authenticate/page.tsx` is likewise finished, and
`app/dashboard/page.tsx` has a real auth gate (its notes list is still a placeholder).

The six client components are `AuthForm.tsx`, `LogoutButton.tsx`, `NoteForm.tsx`,
`NoteEditor.tsx`, `NoteContent.tsx`, and `DeleteNoteButton.tsx` — no other file carries
`"use client"`. `Header.tsx` and `NoteList.tsx` are server components (a `Link` needs no
client boundary). The auth pair
consume `signIn` / `signUp` / `signOut` from `lib/auth-client.ts`; **`useSession` is the
last dead export**, with no call sites.

`/authenticate`, `/dashboard`, `/notes/new`, and `/notes/[id]` all check the session
authoritatively — and `createNoteAction` re-checks it too, since a Server Action is its
own endpoint and is reachable without the page ever rendering. `/notes/[id]` additionally
scopes its lookup by `user_id`, so another user's note id returns **404**, not the note.
Verified live against the running app, along with the anonymous redirect.

**The header is only on the authenticated pages** — `/dashboard`, `/notes/new`,
`/notes/[id]`. `/`, `/authenticate`, and `/p/[slug]` do not render it. That is deliberate
for `/p/[slug]` (§8.1); for the first two it is simply a choice, easily changed.

### Not created yet

- **The rest of `lib/notes.ts`.** `createNote`, `getNoteById`, `getNotesByUser`,
  `updateNote` and `deleteNote` are written; still missing are `setNotePublic` and
  `getNoteByPublicSlug` — i.e. only public sharing is left. The signatures are in
  `SPEC.MD` **§6.2** (not §6.4 — an earlier
  version of this file cited the wrong section _and_ the wrong names: the spec says
  `getNotesByUser` / `getNoteById`, never `listNotes` / `getNote`). Follow the spec's
  names. Note the spec types them `Promise<Note>`; `createNote` is deliberately
  **synchronous**, because better-sqlite3 has no async API and a promise would be pure
  decoration — `await` on the result still works. Match that for the rest.
- **`app/api/notes/*`** — no route handlers exist. The new-note flow goes through a
  Server Action instead, so the API surface in spec §7.2 is still entirely unbuilt.
- **`components/`** — holds `AuthForm`, `LogoutButton`, `Header`, `NoteForm`,
  `NoteEditor`, `NoteContent`, `NoteList`, `DeleteNoteButton`. Of spec §8.3 only
  `ShareToggle` is left; `PublicNoteViewer` is essentially `NoteContent` already.
- **`middleware.ts`** — no optimistic cookie gate yet.
- **Real content on `/p/[slug]`.** The dashboard list is **built** (`NoteList` +
  `getNotesByUser`), so this is the last page still showing placeholder markup.
- **Public sharing.** `ShareToggle`, `setNotePublic`, `getNoteByPublicSlug`, and real
  content on `/p/[slug]` — the last unbuilt feature from spec §3.3.

## Commands

Use **npm**. Both `bun.lock` and `package-lock.json` are committed, but the project
targets the Node.js runtime — treat `bun.lock` as stale. (`.claude/settings.local.json`
still allowlists `bun run …` from earlier sessions; that is history, not guidance.)

| Task                 | Command             |
| -------------------- | ------------------- |
| Dev server           | `npm run dev`       |
| Production build     | `npm run build`     |
| Serve the build      | `npm start`         |
| Lint                 | `npm run lint`      |
| Type check           | `npm run typecheck` |
| Create auth tables   | `npm run db:auth`   |
| Create `notes` table | `npm run db:init`   |

- `npm run lint` invokes bare `eslint`, not `next lint` — Next.js 16 removed `next lint`.
- **`npm run lint` exits 0 with unused imports present.** `eslint-config-next` sets
  `@typescript-eslint/no-unused-vars` to _warn_, and bare `eslint` only fails on errors —
  measured: a file with three unused imports reports 4 warnings and still exits **0**. Use
  `npx eslint . --max-warnings=0` (exits **1**) when unused code must actually fail.
  `eslint --fix` will **not** remove them either: the rule is not auto-fixable and no
  `unused-imports` plugin is installed, so every removal is a manual edit.
- **Quote style is enforced by a hook, not by convention.** **Single quotes for JS/TS
  string literals; double quotes stay in JSX attributes.** The whole repo was converted in
  one pass (291 violations across 16 files), so the gates are green — do not "fix" a file
  back to double quotes.
  - `eslint.config.mjs` carries `quotes: ['error', 'single', { avoidEscape: true }]`, so it
    is a lint **error** and part of every gate. Two behaviours to know: JSX attributes are
    governed by `jsx-quotes`, not this rule, so `className="…"` correctly stays double; and
    `avoidEscape` leaves `"it's fine"` and `"updated_at = datetime('now')"` on double
    quotes rather than escaping them. Both verified.
  - `.claude/settings.json` registers a **`PostToolUse` hook** on `Write|Edit` running
    `.claude/hooks/enforce-single-quotes.mjs`, which autofixes the single file just
    written. It fixes rather than nags, and **exits 2 when it changed something** — for
    `PostToolUse` that is not a rollback, it just feeds the message back so Claude knows
    its copy of the file is stale. Exits 0 silently for non-JS extensions and no-ops.
  - The core `quotes` rule is deprecated in ESLint 9 in favour of
    `@stylistic/eslint-plugin`, but it works and needs no new dependency. Revisit if
    ESLint 10 drops it.
  - **Two traps when testing a hook by hand on Windows**, both of which produced
    convincing false negatives here: `$(pwd)` in Git Bash yields an MSYS path
    (`/d/start/…`) that **Node on Windows cannot resolve**, so `existsSync` is false and
    the hook bails silently — use `D:/start/…`; and **ESLint ignores dot-prefixed
    directories by default**, so a probe file in `.tmp/` is never linted and nothing gets
    fixed — put probes in a non-dot directory.
- **`/frontend-review`** (`.claude/skills/frontend-review/`) runs a review against the
  React / accessibility / Tailwind / TypeScript practice skills in `.claude/skills/`,
  removes unused imports and dead bindings outright, and gates on the three commands
  above. Prefer it over an ad-hoc review so the practice skills actually get loaded.
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
  Treat the version gap as a risk for _future_ migrations, not as a broken database.
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
- **§9.1 TipTap extension list** — wrong for the installed version, now **verified
  against `@tiptap/starter-kit@3.29.2`'s own `.d.ts`**. StarterKit v3 already bundles all
  of: `blockquote`, `bold`, `bulletList`, `code`, `codeBlock`, `document`, `dropcursor`,
  `gapcursor`, `hardBreak`, `heading`, `horizontalRule`, `italic`, `link`, `listItem`,
  `listKeymap`, `orderedList`, `paragraph`, `strike`, `text`, `trailingNode`,
  `underline`, `undoRedo`. (`Link`, `Underline`, `ListKeymap` and `TrailingNode` are new
  in v3.) Passing any of them alongside `StarterKit` registers them twice and TipTap warns
  about duplicates — `lib/tiptap.ts` therefore passes `StarterKit` alone. The spec's
  `heading: { levels: [1, 2, 3] }` **is** honoured (§1 wants H1–H3), so a note body can
  contain an `h1` alongside the page's own title `h1`. Slightly odd for a document
  outline; it is what the spec asks for.
  Those names are also the `StarterKit.configure({...})` keys; set one to `false` to drop
  it before adding a replacement (e.g. `codeBlock: false` + `CodeBlockLowlight`).
- **§8.2 "Header with app name … in the global layout"** — the header exists as
  `components/Header.tsx` but is **not** in `app/layout.tsx`, because its wordmark links to
  `/dashboard` and §8.1 wants no route into user-specific areas from the public
  `/p/[slug]` page. Authenticated pages mount it themselves.
- **§8.2 `app/(auth)/login` + `app/(auth)/register`** — never built that way; there is a
  single `/authenticate` route switched by `?mode=`.
- **§6.3 env var names** — already reconciled; the spec's names are what's in use.
- **§12 steps 1–8** — scaffold, deps, DB, and auth wiring are done.

## Conventions and gotchas

- **`@/*` resolves to the repo root**, not `src/`. There is no `src/` — the App Router
  lives at `app/`.
- **Next 16 async params.** Dynamic route `params` is a `Promise` and must be awaited:
  `const { slug } = await params`. Both existing dynamic pages already do this.
- **`/notes/new` is a static segment sitting beside `/notes/[id]`.** Next resolves static
  segments before dynamic ones, so `new` is never matched as a note id. Confirmed in the
  build output — both routes are listed separately.
- **`redirect()` must not be called inside a `try`.** It signals by throwing an internal
  `NEXT_REDIRECT`, so a surrounding `catch` swallows the navigation and reports a
  successful save as a failure. `createNoteAction` keeps both `redirect` calls outside its
  `try`. Inside a Server Action the redirect status is **303**, not the usual 307.
- **A Server Action is its own endpoint.** It is POST-able directly and does not inherit
  the page's session check, so re-run `auth.api.getSession` inside the action even when
  the page that renders the form is already gated.
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
- **`lib/db.ts`'s `query`/`get`/`run` now take `SqlParam[]`, not `unknown[]`** —
  `number | string | bigint | Buffer | null`, the only things better-sqlite3 binds
  positionally. `unknown[]` used to type-check values the driver rejects at runtime:
  measured against the real schema, `true` throws `TypeError`; a plain object is silently
  reinterpreted as a **named-parameter bag** (`RangeError: Too few parameter values`);
  `undefined` **silently binds NULL**. That bites exactly the payloads spec §7.2
  specifies. Still coerce at the boundary — `isPublic ? 1 : 0`, `JSON.stringify(...)`, and
  build the `SET` clause from only the keys actually present rather than passing
  `undefined` for absent ones. `updateNote` does exactly that, and it is not theoretical:
  a fixed `SET title = ?, content_json = ?` would blank whichever field the caller
  omitted — loudly for `title` (`NOT NULL`) and **silently** for `content_json`. Both
  partial-update paths are covered by a probe, including the empty-patch case, which must
  be a no-op that does not even touch `updated_at`.
- **SQLite orders TEXT by `BINARY` collation; JS `localeCompare` does not.** Cost a false
  test failure while verifying `getNotesByUser`: `ORDER BY updated_at DESC, id DESC` was
  correct, but the assertion re-sorted with `localeCompare`, which is locale-aware and
  disagrees with byte order on the mixed-case nanoid ids. Compare with `<`/`>` (UTF-16
  code units, equivalent to `BINARY` for ASCII) when asserting SQL ordering in JS.
  The `id` tie-break itself is load-bearing: `datetime('now')` has one-second resolution,
  so notes created in quick succession share `updated_at` and would otherwise come back in
  an order that can shuffle between requests.
- **A Server Action can live in a bracketed route folder and be imported normally.**
  `import { deleteNoteAction } from "@/app/notes/[id]/actions"` resolves under both `tsc`
  and Turbopack — the `[id]` segment in the path is not a problem. Verified.
- **`lib/notes.ts` imports `./db.ts` _with_ the extension, on purpose.** Extensionless
  relative imports resolve under Turbopack but **not** under Node's type stripping, so an
  extensionless `./db` makes the whole module unimportable from `scripts/*.ts` — that is a
  real `ERR_MODULE_NOT_FOUND`, hit while verifying `createNote`. Keep the extension on
  relative imports in anything a script might reach. (`lib/auth.ts` still uses `./db`; it
  is only ever loaded by Next, so it works — but prefer the extension in new code.)

- **Do not submit auth forms through a React 19 `<form action={…}>`.** `useActionState`'s
  dispatch wraps the action in `requestFormReset` (`react-dom-client.development.js`
  ~line 8955), so React clears every uncontrolled field once the action settles —
  including when it settles with a validation error. A failed login would blank the email
  the user just typed. `components/AuthForm.tsx` therefore uses a plain `onSubmit` handler
  with `new FormData(event.currentTarget)`, which keeps the inputs uncontrolled _and_
  keeps their values. Controlled inputs would also work; form actions would not.
- **Switching `?mode=` does not remount `AuthForm`.** It is a same-route navigation, so
  React reuses the mounted instance and any error state survives the switch. `AuthForm`
  tags each error with the mode that produced it and renders it only under that mode.
- **Sign-up collects email and password only — by design.** No name, no profile fields.
  better-auth's sign-up body schema still _requires_ `name`: omitting it returns
  `400 {"code":"VALIDATION_ERROR","message":"[body.name] Invalid input"}`. An empty
  string is accepted, so `AuthForm` sends `name: ""` and `user.name` is stored empty.
  Both behaviours are verified against the running app. Anything rendering `user.name`
  later must fall back to `user.email`.
- **Password reset is already off and needs no code.** better-auth mounts
  `/api/auth/request-password-reset` whenever `emailAndPassword.enabled` is true, but the
  handler short-circuits when `sendResetPassword` is unconfigured — verified live: it
  returns `400 {"code":"RESET_PASSWORD_DISABLED"}` and never mints a token. There is no
  flag that unmounts the route; leaving `sendResetPassword` unset _is_ the documented
  way to disable the feature.
- **better-auth error codes worth mapping** (all confirmed against the running app):
  `INVALID_EMAIL_OR_PASSWORD` (401), `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` (422 — note
  the sign-up route throws this, _not_ the bare `USER_ALREADY_EXISTS`), `PASSWORD_TOO_SHORT`
  (400). Default password bounds are 8–128 and `autoSignIn` defaults to **on**, so a
  successful sign-up already carries a session cookie.

- **`/api/auth/sign-out` enforces an `Origin` check; sign-up and sign-in do not.** A
  `curl`/PowerShell probe without an `Origin` header gets `403
{"code":"MISSING_OR_NULL_ORIGIN"}` and the session survives — this is the _test
  harness_ failing, not the app. Browsers always attach `Origin` to a same-origin
  `fetch`, so `signOut()` from a client component works. Send `-H "Origin:
http://localhost:3000"` when probing it by hand.
- **TipTap v3 needs `immediatelyRender: false` under the App Router.** v3 defaults it to
  `true`, and a client component calling `useEditor` that gets server-rendered on the
  first pass throws `Tiptap Error: SSR has been detected, please set immediatelyRender
explicitly to false to avoid hydration mismatches.` Setting it also flips the `useEditor`
  overload — the hook then returns **`Editor | null`**, so every consumer needs a null
  branch. `NoteEditor.tsx` renders a same-height placeholder there so hydration doesn't
  shift the page.
- **v3 defaults `shouldRerenderOnTransaction` to `false`** (v2 re-rendered on every
  transaction). A toolbar that calls `editor.isActive("bold")` directly in JSX therefore
  renders once and then **never updates** as the caret moves — it looks broken and the
  cause is not obvious. Read through `useEditorState({ editor, selector })` instead, which
  is what `NoteEditor.tsx` does.
- **A TipTap editor contributes nothing to `FormData`.** It is a contenteditable, not a
  form control, so there is no `name` for the browser to serialise and a `<form action>`
  would post the title alone. `NoteForm.tsx` holds the latest document in a **ref**
  (not state — the editor fires on every keystroke and none of it changes what renders)
  and does `formData.set("contentJson", JSON.stringify(doc))` inside `onSubmit`.
- **Toolbar buttons must carry `type="button"`.** Inside a `<form>` a bare `<button>`
  defaults to `type="submit"`, so every bold/italic click would submit the note.
- **TipTap ships no theme, and `@tailwindcss/typography` is not installed** — there is no
  `prose` class to reach for. Editor content styling is hand-written in `app/globals.css`
  under `.tiptap-content`, the class applied via `editorProps.attributes.class`. Both
  `NoteEditor` and `NoteContent` use that class, so stored notes look the same being
  written and being read.
- **Tailwind v4 Preflight flattens every heading** — it emits
  `h1,h2,h3,h4,h5,h6 { font-size: inherit; font-weight: inherit }`. So a heading with no
  explicit rule renders at _body text size_ and looks like the command did nothing. Every
  level in `HEADING_LEVELS` needs a matching `.tiptap-content hN` rule in
  `app/globals.css`, or that toolbar button appears broken while working correctly.
- **Turbopack dev can serve stale CSS while happily hot-reloading the JS, and a plain
  restart does NOT clear it.** Hit for real: a new `.tiptap-content h1` rule was on disk
  and correct in the production build, but the dev chunk emitted
  `.tiptap-content h2, .tiptap-content h3 { … }` — `h1` stripped from the group and its
  standalone block missing, i.e. byte-for-byte the _pre-edit_ source. Because Tailwind
  Preflight flattens headings, H1 then looked completely dead in the editor while H2/H3
  worked. Diagnosis recipe:

  ```bash
  # what dev serves vs what the source really compiles to
  grep -rn "tiptap-content h" .next/dev/static/chunks/*.css
  npm run build && grep -o "\.tiptap-content h[0-9][^{]*{[^}]*}" .next/static/chunks/*.css
  ```

  If they disagree, the source is fine and the cache is poisoned. **Ctrl+C then
  `npm run dev` is not enough** — the cache lives in `.next/`, so delete it:
  `rm -rf .next` (or at minimum `.next/dev`) and start the dev server again.
  Note the dev CSS is unminified, so rules span lines — a single-line
  `grep -o '…{[^}]*}'` silently matches nothing there and looks like the rule is absent
  when it is merely wrapped.

- **`generateHTML` from `@tiptap/core` does NOT work server-side here.** It goes through
  ProseMirror's `DOMSerializer` and throws `ReferenceError: window is not defined` under
  the Node runtime — verified directly. Rendering stored notes to HTML on the server would
  mean adding jsdom, so `NoteContent.tsx` uses a read-only editor (`editable: false`)
  instead. That also keeps `dangerouslySetInnerHTML` out of the codebase: markup can only
  come from the schema, so a stored document cannot inject anything the extensions do not
  allow. Keep it that way if `/p/[slug]` gets built — it renders untrusted content to
  anonymous visitors.
- **Read-only and editable views must share the same extension config**, which is why
  `lib/tiptap.ts` exists and why `NoteEditor` and `NoteContent` both call
  `noteExtensions()` instead of configuring StarterKit themselves. A mismatch silently
  drops nodes the stored document actually contains — an H1 written under
  `levels: [1,2,3]` simply vanishes in a viewer built with `[2,3]`. Never inline a
  StarterKit config in a component again.
- **`heading.levels` is an _input_ restriction, not a validation boundary.** Measured
  against the real schema: with `levels: [1,2,3]`, a stored document containing
  `heading` level **4 still parses** via `Node.fromJSON` — the config governs which
  commands and keyboard shortcuts exist and what HTML parsing accepts, but ProseMirror's
  `level` attribute is unconstrained. So do not rely on it to reject anything; the
  toolbar and the zod check in the Server Action are what actually bound what gets in.
- **Content is not in the server-rendered HTML.** `immediatelyRender: false` means the
  read-only view renders a "Loading content…" placeholder server-side and fills in after
  hydration. The document JSON _is_ in the RSC payload, so nothing extra is fetched, but
  the text is not present for a non-JS client. Matters if `/p/[slug]` ever needs SEO —
  that would be the one place worth adding jsdom for a real server render.
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
