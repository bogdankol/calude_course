# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo currently is

A `create-next-app` scaffold with a single unrelated demo page (`app/page.tsx` — a "Hello world" card with a popup). **Almost nothing described in `SPEC.MD` is implemented yet.** `app/` contains only `layout.tsx`, `page.tsx`, and `globals.css`.

`SPEC.MD` is the specification for the target application: a note-taking web app with better-auth authentication, raw-SQL SQLite storage, a TipTap rich-text editor, and public note sharing via slug. Read it before starting feature work — it is the source of truth for intended design, schema, and API shape, except where noted under "Where `SPEC.MD` is out of date" below.

Do not go hunting for a data layer or auth wiring. None of `lib/`, `components/`, `scripts/`, `data/`, or `app/api/` exists; the whole backend is still to be built from the spec.

`SPEC.MD` is currently **untracked** (`git status` shows `?? SPEC.MD`). Commit it if spec changes should be shared.

### Dependency state

Installed and ready: `better-auth` 1.6.25, `@tiptap/react` + `@tiptap/starter-kit` + `@tiptap/pm` 3.29.x, `zod` 4.

Still missing from the spec's dependency list:

- `better-sqlite3` and `@types/better-sqlite3` — nothing DB-related can be built until these are added.
- `nanoid` is present in `node_modules` **only as a transitive dependency** and is absent from `package.json`. Add it explicitly (`npm i nanoid`) before importing it for slug generation; do not rely on the hoisted copy.
- `@tailwindcss/typography`, if the `prose` styling in `SPEC.MD` §10 is wanted.

## Commands

Use **npm**. Both `bun.lock` and `package-lock.json` are committed, but the spec targets the Node.js runtime — treat `bun.lock` as stale. (`.claude/settings.local.json` still allowlists `bun run …` from earlier sessions; that is history, not guidance.)

| Task | Command |
| --- | --- |
| Dev server | `npm run dev` |
| Production build | `npm run build` |
| Serve the build | `npm start` |
| Lint | `npm run lint` |
| Type check | `npx tsc --noEmit` |

- `npm run lint` invokes bare `eslint`, not `next lint` — Next.js 16 removed the `next lint` command.
- There is **no type-check script and no test framework**. `tsc --noEmit` is the only type gate; if you add tests, wire the runner into `package.json` yourself rather than assuming one exists.

## Where `SPEC.MD` is out of date

The spec was written against older tooling than what is installed. Follow the repo, not the spec, on these points:

- **§10 "configure Tailwind in `tailwind.config.ts`"** — wrong. This is Tailwind v4, CSS-first. There is no `tailwind.config.ts` and adding one will not be read. Theme tokens live in `app/globals.css` under `@import "tailwindcss"` + `@theme inline`.
- **§9.1 TipTap extension list** — wrong for the installed version. `@tiptap/starter-kit` v3 already bundles `Code`, `CodeBlock`, `Link`, `Underline`, and the list extensions. Passing `Code` / `CodeBlock` alongside `StarterKit` (as the spec's example does) registers them twice and TipTap warns about duplicate extensions. Configure them through `StarterKit.configure({...})` instead, or disable the bundled one before adding a replacement (e.g. `CodeBlockLowlight`).
- **§12 step 1–2** — already done; the app is scaffolded.

## Conventions and gotchas

- **`@/*` resolves to the repo root**, not `src/`. There is no `src/` directory — the App Router lives at `app/`.
- **`.env.example` is gitignored.** `.gitignore:34` has a blanket `.env*` rule that swallows it, so the example file never reaches the remote. Fix with a `!.env.example` negation if the template should be shared.
- **`.env.example` is incomplete and inconsistent with the spec.** It defines `BETTER_AUTH_SECRET` and `DB_PATH`; `SPEC.MD` §6.3 calls the latter `DATABASE_PATH` and also requires `BETTER_AUTH_URL`, which the example omits entirely. Reconcile all three names before writing `lib/db.ts` and `lib/auth.ts`.
- **`data/` is not gitignored.** The spec puts the SQLite file at `data/app.db`; add an ignore entry (`data/*.db*`) before creating it or the database gets committed.
- **`ignoreScripts` and `trustedDependencies` in `package.json` are bun-only fields.** npm ignores both. They matter once `better-sqlite3` is added — it is a native module with a postinstall build step that npm will run normally.
- When adding `better-sqlite3`, `next.config.ts` needs `serverExternalPackages: ["better-sqlite3"]` (it is currently the untouched default), and no route importing the DB may declare `runtime = "edge"`. See `SPEC.MD` §2.1.
- `middleware.ts` runs on the Edge runtime, so it can only do an optimistic cookie check. The authoritative `auth.api.getSession()` call belongs in the server component or route handler.

## Auth and schema ownership

better-auth owns the `user`, `session`, `account`, and `verification` tables. Do not hand-write or hand-alter them — run `npx auth@latest migrate` (or `generate`). Extra user fields go through `user.additionalFields` in the auth config followed by a re-migrate, never a manual `ALTER TABLE`.

Credentials live in `account` (`providerId = "credential"`, hashed `password`), never on `user`.

The application-owned `notes` table is hand-maintained and references `user(id)`, so the auth tables must exist first. SQLite does not enforce foreign keys unless `PRAGMA foreign_keys = ON` is set on every connection.
