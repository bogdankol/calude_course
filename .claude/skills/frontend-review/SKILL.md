---
name: frontend-review
description: Review changed React/Next.js/Tailwind code against this project's practice skills (React components, accessible HTML/JSX, modern Tailwind, clean TypeScript), then delete every unused import and dead binding found. Use when asked to "review my changes", "do a code review", "check the UI code", or before committing frontend work.
---

# Frontend code review

Reviews changed code against the practice skills already installed in this repo, then
**applies** two classes of fix: unused imports/dead bindings (always removed) and anything
the user approves from the findings list.

This is a *review that edits*, not a report. Do not stop at describing problems.

---

## Step 1 — Load the practice skills first (mandatory)

Before reading a single line of the diff, invoke these with the Skill tool. They are the
rubric; reviewing from memory produces vague, unciteable findings.

| Skill | Load when |
| --- | --- |
| `modern-best-practice-react-components` | any `.tsx` changed — **always** for components |
| `modern-accessible-html-jsx` | any JSX markup changed — **always** for components |
| `modern-tailwind` | any `className` or `.css` changed |
| `clean-typescript` | any `.ts`/`.tsx` changed — **always** |
| `modern-best-practice-nextjs` | anything under `app/` changed |
| `web-security` | auth, DB queries, user-supplied content, or `dangerouslySetInnerHTML` |
| `modern-browser-apis` | hand-rolled behaviour a browser API already provides (dialogs, popovers, clipboard, view transitions) |

Load them in one message (parallel tool calls). Cite the skill by name in each finding so
the reasoning is checkable — a finding no skill or file backs up should be dropped.

## Step 2 — Establish scope

Default scope is uncommitted work. With an argument, scope to that instead (a path, a
branch to diff against, or a PR number).

```bash
git status --short
git diff                 # tracked, unstaged
git diff --staged        # staged
git diff main...HEAD     # whole branch, when reviewing a branch
```

Untracked files do **not** appear in `git diff` — list them from `git status --short` (`??`)
and read them in full. New components are exactly where review matters most, so never skip
them.

Read every changed file completely before judging it. A diff hunk hides the surrounding
context that decides whether something is actually wrong.

## Step 3 — Remove unused imports and dead bindings

**Do this without asking.** It is the one category this skill always fixes outright.

`npm run lint` does **not** catch these in this repo: `@typescript-eslint/no-unused-vars`
is configured as a *warning* by `eslint-config-next`, and `npm run lint` runs bare
`eslint`, so it **exits 0 with unused imports present**. Verified. Force a real signal:

```bash
npx eslint . --max-warnings=0        # now unused imports fail the run
npx eslint . 2>&1 | grep no-unused-vars   # just the list
```

`eslint --fix` will **not** remove them — `no-unused-vars` is not auto-fixable and no
`unused-imports` plugin is installed. Every removal is a manual edit.

What to remove:

- unused `import` specifiers — and the whole `import` statement if it empties out
- unused local variables, constants, function params (prefix with `_` only when a
  signature genuinely requires the slot)
- unreachable code, and functions/exports with no call sites anywhere in the repo

Before deleting an *export*, prove it is dead. `grep` the whole repo, not just the diff:

```bash
grep -rn "theSymbolName" --include=*.ts --include=*.tsx . | grep -v node_modules
```

A single definition site and zero uses means dead. If it is public API, or a barrel
re-export, say so and leave it — note it as a finding instead of deleting it.

Type-only imports that are genuinely used as types are **not** unused. Prefer
`import type { X }` for them; do not delete them.

## Step 4 — Review against the rubric

Findings must be concrete: file, line, what breaks, and which skill or repo convention it
violates. Rank by severity. Skip anything you cannot back up.

**React** (per `modern-best-practice-react-components`)
- `useEffect` doing work that belongs in render, an event handler, or a derived value
- state that could be derived, or duplicated in two places
- state holding data that never affects the render — that belongs in a ref
- missing/incorrect `key`, or index-as-key on a reorderable list
- unstable callback/object identity handed to a memoised or effect-dependent child
- a client component that does not need to be one — could it be a server component?

**Accessibility** (per `modern-accessible-html-jsx`)
- `<div onClick>` where a `<button>` belongs
- controls with no accessible name — icon-only buttons need `aria-label`
- form inputs with no associated `<label>` (`htmlFor`/`id`)
- toggle state not exposed (`aria-pressed`, `aria-expanded`, `aria-current`)
- non-native widgets missing `role` and keyboard handling
- error/status text not in a live region (`role="alert"`, `aria-live`)
- focus styling removed without a `focus-visible` replacement
- heading order, and **more than one `h1` on a page**

**Tailwind** (per `modern-tailwind`)
- long `className` strings that should be extracted or shared
- arbitrary values (`top-[50px]`, `size-[100px]`) where a scale token exists
- absolute positioning that a flex/grid parent would handle — this repo already hit a
  bug where an absolutely-positioned button collided with the sticky header
- hardcoded colours instead of the theme tokens in `app/globals.css`
- duplicated variant chains, or `dark:` classes in a design that is already dark-only
- **This is Tailwind v4, CSS-first.** There is no `tailwind.config.ts` and adding one
  does nothing. Theme tokens live in `app/globals.css` under `@theme inline`.

**TypeScript** (per `clean-typescript`)
- `any`, unchecked casts, or non-null `!` hiding a real branch
- types wide enough to permit values that fail at runtime (see the `SqlParam` note below)
- missing return types on exported functions

## Step 5 — Project-specific traps

These have all cost real debugging time in this repo. Check them explicitly; `CLAUDE.md`
holds the full list and the evidence.

- **Toolbar/formatting buttons inside a `<form>` must carry `type="button"`.** A bare
  `<button>` defaults to `type="submit"` and posts the form on every click.
- **TipTap needs `immediatelyRender: false`** under the App Router, which makes `useEditor`
  return `Editor | null` — every consumer needs a null branch.
- **TipTap extension config must come from `lib/tiptap.ts`.** A component configuring
  `StarterKit` inline is a bug even if it works today: editor and viewer schemas drifting
  apart silently drops stored nodes.
- **Every heading level needs an explicit CSS rule.** Tailwind Preflight flattens
  `h1`–`h6` to `font-size: inherit`, so a heading with no rule renders at body size and
  looks like the feature is broken.
- **`redirect()` must not sit inside a `try`.** It signals by throwing `NEXT_REDIRECT`; a
  `catch` swallows the navigation and reports success as failure.
- **Server Actions re-check the session themselves.** An action is its own endpoint and
  does not inherit the page's gate.
- **Route gates belong in the page, not a layout** — layouts are not re-rendered on every
  navigation within their segment.
- **Every note query filters by `user_id` in the SQL**, so a foreign id returns 404 rather
  than someone else's row.
- **`lib/db.ts` helpers take `SqlParam[]`.** Coerce at the boundary: `isPublic ? 1 : 0`,
  `JSON.stringify(doc)`, and build the `SET` clause from the keys actually present —
  `undefined` silently binds NULL.
- **Relative imports reachable from `scripts/*.ts` need the explicit `.ts` extension**, or
  Node's type stripping throws `ERR_MODULE_NOT_FOUND`.

## Step 6 — Verify

After every edit, in this order. All three must pass before reporting done.

```bash
npm run typecheck
npx eslint . --max-warnings=0    # NOT `npm run lint` — that exits 0 on warnings
npm run build
```

If a style change appears not to apply, suspect the Turbopack CSS cache before the code:

```bash
grep -rn "tiptap-content h" .next/dev/static/chunks/*.css
npm run build && grep -o "\.tiptap-content h[0-9][^{]*{[^}]*}" .next/static/chunks/*.css
```

Disagreement means the source is fine and the dev cache is poisoned. `rm -rf .next` and
restart the dev server — **a plain Ctrl+C restart does not clear it.** Dev CSS is
unminified, so rules span lines; a single-line `grep -o` matches nothing there and reads
as "rule absent" when it is merely wrapped.

## Step 7 — Report

```
## Removed (applied)
- path/file.tsx:12 — dropped unused `useEffect`, `Link` imports

## Findings
1. [high] path/file.tsx:48 — <div onClick> is not keyboard reachable
   → modern-accessible-html-jsx: use <button>
   Fix: …

## Verified
typecheck ✅  eslint --max-warnings=0 ✅  build ✅
```

Rules for the report:

- State what was **changed** separately from what is only **proposed**.
- If a check fails, paste the output. Never report a passing gate you did not run.
- "No findings" is a valid result. Do not invent problems to look thorough.
- Offer to apply the remaining findings; do not apply them unasked. Unused imports are the
  exception — those are already gone.
- Update `CLAUDE.md` in the same turn if the review changes a convention or uncovers a new
  gotcha. That file is the project's map and a stale map is worse than none.
