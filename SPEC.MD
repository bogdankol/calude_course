# Technical Specification – Note Taking Web App

## 1. Overview

A web application where authenticated users can create, view, edit, delete, and publicly share rich-text notes. Notes are created with TipTap, stored as JSON in a SQLite database, and rendered in the browser with formatting. Specs ar in @SPEC.MD file - refer to it when you do something in code or considering a solution of prompt

also give brief replies

### Core Features

- User authentication (sign up, login, logout) via **better-auth**
- Authenticated note management (CRUD)
- Rich text editor using TipTap with:
  - Bold, Italic
  - Heading levels (H1–H3) + normal text
  - Inline code + code blocks
  - Bullet lists
  - Horizontal rules
- Public sharing of notes via a public URL (toggle on/off)

### Tech

- Next.js (App Router) + **Node.js runtime** (Node 20 LTS or newer)
- TypeScript
- TailwindCSS
- SQLite via [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) with raw SQL

> **Why `better-sqlite3`?** It is a synchronous, raw-SQL SQLite driver for Node.js
> and better-auth's built-in Kysely adapter accepts a `better-sqlite3` `Database`
> instance directly, so the app and the auth library share one connection and one
> database file.

---

## 2. Architecture

### 2.1 High-Level Architecture

- **Frontend & Backend:** Next.js (App Router)
  - Server components for data fetching
  - Client components for TipTap editor and interactive UI
  - Route Handlers (`app/api/.../route.ts`) for JSON APIs
- **Runtime:** Node.js (for dev & production)
  - All route handlers that touch the database must run on the Node.js runtime
    (the App Router default). Do **not** set `export const runtime = "edge"` on
    any route that imports `lib/db.ts` or `lib/auth.ts`.
  - `next.config.ts` must mark the native driver as external:

    ```ts
    // next.config.ts
    import type { NextConfig } from "next";

    const nextConfig: NextConfig = {
      serverExternalPackages: ["better-sqlite3"],
    };

    export default nextConfig;
    ```

- **Database:** Single SQLite file (e.g. `data/app.db`) accessed via `better-sqlite3`
- **Auth:** better-auth integrated into Next.js (middleware + server helpers)

### 2.2 Application Layers

1. **Presentation layer**
   - Next.js pages and components
   - TailwindCSS for styling
   - TipTap editor component
2. **API layer**
   - REST-like JSON endpoints for notes CRUD & sharing
   - better-auth's own catch-all handler for auth endpoints
3. **Data access layer**
   - Raw SQL queries executed via `better-sqlite3`
   - A small helper module for DB access

---

## 3. Functional Requirements

### 3.1 Authentication

Users can:

- Register (email + password, minimum validation)
- Log in / log out

Authentication state is accessible on the server (for SSR) and on the client (for protected UI).

Unauthenticated users:

- Can access public shared note URLs (read-only)
- Cannot access dashboard or personal notes

### 3.2 Notes Management (Authenticated)

- **Create a new note:**
  - Default title: `"Untitled note"`
  - Default empty TipTap document
- **View a list of own notes:**
  - Show title, last updated at, shared status
- **View a single note:**
  - Load editor with stored TipTap JSON document
- **Update note:**
  - Change title
  - Change content (TipTap JSON)
  - Auto-update `updated_at`
- **Delete note:**
  - Hard delete

### 3.3 Note Sharing

Users can toggle note "public sharing":

- **When enabled:**
  - Note gets a unique public slug (e.g. `abcdef1234`)
  - Accessible via `/p/{slug}` for anonymous users
- **When disabled:**
  - Public URL returns 404 / "Note not found"

Public page rendering:

- Reads note from DB by `public_slug`
- Shows title and content in read-only mode
- No editing or owner information necessary

---

## 4. Non-Functional Requirements

- **Performance** — Notes list & note view should load under ~300 ms for typical DB sizes
- **Security**
  - All note operations are scoped to the authenticated user's `user_id`
  - Public notes are read-only; no leaked private data in API responses
- **Reliability** — Graceful handling of DB errors
- **Maintainability**
  - Type-safe APIs and DB types
  - Modularized DB and auth helpers
- **UX** — Simple, minimal UI with keyboard-friendly editor

---

## 5. Data Model & Database Schema (SQLite)

### 5.1 Tables

#### better-auth Core Tables

better-auth owns and manages its own tables. **These tables are not hand-maintained.**
Generate and migrate them with the better-auth CLI:

```bash
# inspect the DB and create/alter the required auth tables
npx auth@latest migrate

# or emit the SQL and apply it yourself
npx auth@latest generate
```

The SQL below documents the schema the CLI produces for SQLite. It is reproduced here
for reference (and so `scripts/init-db.ts` can create a fresh DB in one shot), but the
CLI remains the source of truth — re-run `migrate` after adding any better-auth plugin,
since plugins add their own tables and columns.

Notes on SQLite type mapping:

- `boolean` fields are stored as `INTEGER` (`0` / `1`)
- `Date` fields are stored with a `DATE` column type (SQLite has no native date type;
  better-auth reads/writes them as JS `Date` objects)
- IDs are `TEXT` — better-auth generates them by default
  (configurable via `advanced.database.generateId`)

##### `user`

```sql
CREATE TABLE "user" (
  "id"            TEXT    NOT NULL PRIMARY KEY,
  "name"          TEXT    NOT NULL,
  "email"         TEXT    NOT NULL UNIQUE,
  "emailVerified" INTEGER NOT NULL DEFAULT 0,
  "image"         TEXT,
  "createdAt"     DATE    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     DATE    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | yes (PK) | Unique identifier for each user |
| `name` | `string` | yes | User's chosen display name |
| `email` | `string` | yes (unique) | User's email address for communication and login |
| `emailVerified` | `boolean` | yes | Whether the user's email is verified |
| `image` | `string` | optional | User's image URL |
| `createdAt` | `Date` | yes | Timestamp of when the user account was created |
| `updatedAt` | `Date` | yes | Timestamp of the last update to the user's information |

##### `session`

```sql
CREATE TABLE "session" (
  "id"        TEXT NOT NULL PRIMARY KEY,
  "userId"    TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "token"     TEXT NOT NULL UNIQUE,
  "expiresAt" DATE NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | yes (PK) | Unique identifier for each session |
| `userId` | `string` | yes (FK → `user.id`, cascade) | The ID of the user |
| `token` | `string` | yes (unique) | The unique session token |
| `expiresAt` | `Date` | yes | The time when the session expires |
| `ipAddress` | `string` | optional | The IP address of the device |
| `userAgent` | `string` | optional | The user agent information of the device |
| `createdAt` | `Date` | yes | Timestamp of when the session was created |
| `updatedAt` | `Date` | yes | Timestamp of when the session was updated |

##### `account`

```sql
CREATE TABLE "account" (
  "id"                    TEXT NOT NULL PRIMARY KEY,
  "userId"                TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "accountId"             TEXT NOT NULL,
  "providerId"            TEXT NOT NULL,
  "accessToken"           TEXT,
  "refreshToken"          TEXT,
  "accessTokenExpiresAt"  DATE,
  "refreshTokenExpiresAt" DATE,
  "scope"                 TEXT,
  "idToken"               TEXT,
  "password"              TEXT,
  "createdAt"             DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             DATE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | yes (PK) | Unique identifier for each account |
| `userId` | `string` | yes (FK → `user.id`, cascade) | The ID of the user |
| `accountId` | `string` | yes | The ID of the account as provided by the SSO provider, or equal to `userId` for credential accounts |
| `providerId` | `string` | yes | The ID of the provider (e.g. `"credential"`, `"google"`, `"github"`) |
| `accessToken` | `string` | optional | The access token of the account, returned by the provider |
| `refreshToken` | `string` | optional | The refresh token of the account, returned by the provider |
| `accessTokenExpiresAt` | `Date` | optional | The time when the access token expires |
| `refreshTokenExpiresAt` | `Date` | optional | The time when the refresh token expires |
| `scope` | `string` | optional | The scope of the account, returned by the provider |
| `idToken` | `string` | optional | The ID token returned from the provider |
| `password` | `string` | optional | The hashed password — used for email/password authentication |
| `createdAt` | `Date` | yes | Timestamp of when the account was created |
| `updatedAt` | `Date` | yes | Timestamp of when the account was updated |

> Email/password credentials live in `account` (`providerId = "credential"`,
> `password` = the hash), **not** on `user`. Never add a password column to `user`.

##### `verification`

```sql
CREATE TABLE "verification" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value"      TEXT NOT NULL,
  "expiresAt"  DATE NOT NULL,
  "createdAt"  DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  DATE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `string` | yes (PK) | Unique identifier for each verification |
| `identifier` | `string` | yes | The identifier for the verification request |
| `value` | `string` | yes | The value to be verified |
| `expiresAt` | `Date` | yes | The time when the verification request expires |
| `createdAt` | `Date` | yes | Timestamp of when the verification request was created |
| `updatedAt` | `Date` | yes | Timestamp of when the verification request was updated |

##### Extending the auth schema

If the app later needs extra user fields (e.g. a display preference), do **not** add
the column by hand. Declare it in the auth config so the CLI migrates it and the type
inference picks it up:

```ts
export const auth = betterAuth({
  user: {
    additionalFields: {
      lang: { type: "string", required: false, defaultValue: "en" },
    },
  },
});
```

Then re-run `npx auth@latest migrate`.

#### `notes` (application-owned)

```sql
CREATE TABLE notes (
  id           TEXT    NOT NULL PRIMARY KEY,
  user_id      TEXT    NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  title        TEXT    NOT NULL,
  content_json TEXT    NOT NULL,
  is_public    INTEGER NOT NULL DEFAULT 0,
  public_slug  TEXT    UNIQUE,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | `TEXT` | Unique identifier for the note (primary key) |
| `user_id` | `TEXT` | Owner — FK → `user.id`, deleted with the user |
| `title` | `TEXT` | Note title, defaults to `"Untitled note"` |
| `content_json` | `TEXT` | Stringified TipTap JSON document |
| `is_public` | `INTEGER` | `0` / `1` — whether public sharing is enabled |
| `public_slug` | `TEXT` | Unique random slug, `NULL` when not shared |
| `created_at` | `TEXT` | Creation timestamp |
| `updated_at` | `TEXT` | Last update timestamp |

> `notes` is application-owned and hand-maintained in `scripts/init-db.ts`, but it
> references the better-auth `user` table. Create the auth tables **before** `notes`,
> and enable `PRAGMA foreign_keys = ON` on every connection or the FK is not enforced.

### 5.2 Indexes

```sql
CREATE INDEX idx_notes_user_id     ON notes(user_id);
CREATE INDEX idx_notes_public_slug ON notes(public_slug);
CREATE INDEX idx_notes_is_public   ON notes(is_public);
```

---

## 6. Backend: DB & API Layer

### 6.1 Database Access Module

**File:** `lib/db.ts`

- Initialize a `better-sqlite3` client with the DB file (`data/app.db`)
- Apply pragmas once per connection: `journal_mode = WAL`, `foreign_keys = ON`
- Export helper functions:
  - `getDb()` – returns singleton DB connection
  - Utility wrappers:
    - `query<T>(sql, params?): T[]`
    - `get<T>(sql, params?): T | undefined`
    - `run(sql, params?)`

```ts
// lib/db.ts
import Database from "better-sqlite3";

let db: Database.Database | undefined;

export function getDb() {
  if (!db) {
    db = new Database(process.env.DATABASE_PATH ?? "data/app.db");
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  }
  return db;
}

export const query = <T>(sql: string, params: unknown[] = []) =>
  getDb().prepare(sql).all(...params) as T[];

export const get = <T>(sql: string, params: unknown[] = []) =>
  getDb().prepare(sql).get(...params) as T | undefined;

export const run = (sql: string, params: unknown[] = []) =>
  getDb().prepare(sql).run(...params);
```

> `better-sqlite3` is synchronous, so these helpers do not return promises. The
> repository functions below keep `Promise` return types so the data layer can be
> swapped for an async driver without touching call sites.

### 6.2 Note Repository Functions

**File:** `lib/notes.ts`

TypeScript types:

```ts
export type Note = {
  id: string;
  userId: string;
  title: string;
  contentJson: string; // stringified TipTap doc
  isPublic: boolean;
  publicSlug: string | null;
  createdAt: string;
  updatedAt: string;
};
```

Repository functions:

```ts
createNote(userId: string, data: { title?: string; contentJson?: string }): Promise<Note>
getNoteById(userId: string, noteId: string): Promise<Note | null>
getNotesByUser(userId: string): Promise<Note[]>
updateNote(userId: string, noteId: string, data: Partial<{ title: string; contentJson: string }>): Promise<Note | null>
deleteNote(userId: string, noteId: string): Promise<void>
setNotePublic(userId: string, noteId: string, isPublic: boolean): Promise<Note | null>
getNoteByPublicSlug(slug: string): Promise<Note | null>
```

Each function enforces `user_id = ?` in SQL where applicable, to avoid cross-user access.

### 6.3 Auth Module

**File:** `lib/auth.ts` — server instance, shares the app's SQLite connection.

```ts
// lib/auth.ts
import { betterAuth } from "better-auth";
import { getDb } from "./db";

export const auth = betterAuth({
  database: getDb(),
  emailAndPassword: { enabled: true },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
});
```

**File:** `app/api/auth/[...all]/route.ts` — mounts every better-auth endpoint.

```ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

**File:** `lib/auth-client.ts` — client helpers for the login/register UI
(`signIn`, `signUp`, `signOut`, `useSession`).

```ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();
```

Required environment variables:

| Variable | Purpose |
| --- | --- |
| `BETTER_AUTH_SECRET` | Signing secret for sessions/tokens |
| `BETTER_AUTH_URL` | Base URL of the app (e.g. `http://localhost:3000`) |
| `DATABASE_PATH` | Path to the SQLite file (defaults to `data/app.db`) |

---

## 7. API Design (Next.js Route Handlers)

Base path under `/api/notes`. Auth endpoints are served by better-auth under `/api/auth/*`.

### 7.1 Authentication Access

Read the session on the server with better-auth's API:

```ts
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

const session = await auth.api.getSession({ headers: await headers() });
// session?.user.id
```

All `/api/notes` handlers (except public read) must:

- Check auth
- Return `401` if not authenticated

Middleware (`middleware.ts`) runs on the Edge runtime, so it must only do an optimistic
cookie check to redirect unauthenticated visitors away from `/dashboard` and `/notes/*`.
The authoritative session check happens in the server component / route handler.

### 7.2 Endpoints

#### `GET /api/notes`

List notes for the current user.

**Response `200`:**

```json
[
  {
    "id": "note-id",
    "title": "My Note",
    "isPublic": true,
    "updatedAt": "2025-01-01T12:00:00Z"
  }
]
```

Optionally omit `contentJson` from the list for performance.

#### `POST /api/notes`

Create a new note.

**Request body:**

```json
{
  "title": "Optional title",
  "contentJson": { "type": "doc" }
}
```

**Behavior:**

- Default `title` = `"Untitled note"` if missing
- Default `contentJson` = empty TipTap document if missing

**Response `201`:** created `Note` (or minimal subset)

#### `GET /api/notes/:id`

Get a single note owned by the current user.

**Response:**

- `200` with full note including `contentJson`
- `404` if not found or not owned by user

#### `PUT /api/notes/:id`

Update note title/content.

**Request body:**

```json
{
  "title": "New title",
  "contentJson": {}
}
```

**Response:**

- `200` with updated note
- `404` if not found

#### `DELETE /api/notes/:id`

Delete note.

**Response:**

- `204` on success
- `404` if not found

#### `POST /api/notes/:id/share`

Toggle public sharing.

**Request body:**

```json
{ "isPublic": true }
```

**Behavior:**

- If `isPublic = true` and note has no `public_slug`, generate a new slug (`nanoid()`)
- If `isPublic = false`, set `is_public = 0` and `public_slug = NULL`

**Response `200`:**

```json
{
  "id": "note-id",
  "isPublic": true,
  "publicSlug": "abcdef1234"
}
```

### 7.3 Public Note Endpoint

#### `GET /api/public-notes/:slug`

Read-only access to public notes.

**Response `200`:**

```json
{
  "title": "Public note",
  "contentJson": {}
}
```

`404` if slug not found or `is_public = 0`.

> Or skip this API and resolve directly in the `/p/[slug]` route using server components.

---

## 8. Frontend – Pages & Components

### 8.1 Routes

Next.js App Router structure:

| Route | Access | Contents |
| --- | --- | --- |
| `/` | public | Landing page — marketing / "Log in / Sign up" CTA |
| `/dashboard` | authenticated | List of user notes, "Create note" button |
| `/notes/[id]` | authenticated | Note editor page — TipTap editor, title field, share toggle, delete button |
| `/p/[slug]` | public | Read-only note content, no nav to user-specific area for anonymous viewers |

### 8.2 Layout & Navigation

- Global layout: `app/layout.tsx`
- Header with app name, login/logout/account & theme
- `app/(auth)/login`, `app/(auth)/register` (better-auth ships no UI — build these
  against `authClient.signIn.email()` / `authClient.signUp.email()`)

### 8.3 Components

- **`components/NoteList.tsx`**
  - Props: `notes: { id, title, updatedAt, isPublic }[]`
  - Renders list with links to `/notes/[id]`
- **`components/NoteEditor.tsx`**
  - TipTap-based editor
  - Controlled by parent (`onChange` updates state, eventual API call)
- **`components/ShareToggle.tsx`**
  - Switch/checkbox for `isPublic`
  - Shows public URL when enabled
- **`components/DeleteNoteButton.tsx`**
  - Confirms and calls `DELETE` API
- **`components/PublicNoteViewer.tsx`**
  - Renders TipTap content in read-only mode (or `EditorContent` with `editable: false`)

---

## 9. TipTap Integration

### 9.1 Extensions

Enable at minimum:

- `StarterKit` (paragraphs, headings, bold, italic, bullet lists, horizontal rule, etc.)
- `Code` (inline code)
- `CodeBlockLowlight` or `CodeBlock` (code snippets)

Example editor config:

```ts
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Code from "@tiptap/extension-code";
import CodeBlock from "@tiptap/extension-code-block";

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
    }),
    Code,
    CodeBlock,
  ],
  content: initialContentJson, // TipTap JSON
  onUpdate: ({ editor }) => {
    const json = editor.getJSON();
    onChange(json);
  },
});
```

Content is always stored in the DB as `JSON.stringify(json)`; when loading, `JSON.parse`
and pass as `content`.

### 9.2 Toolbar

Buttons:

- Bold, Italic
- H1, H2, H3, paragraph
- Bullet list
- Inline code
- Code block
- Horizontal rule

Each button calls the relevant TipTap chain, e.g. `editor.chain().focus().toggleBold().run()`.

---

## 10. Styling (TailwindCSS)

- Configure Tailwind in `tailwind.config.ts`
- Use a minimal design:
  - Neutral background, card-like note container
  - Utility classes on components
- Consider a `prose` style for read-only content (using `@tailwindcss/typography`)

---

## 11. Security Considerations

- **Auth enforcement**
  - All `/dashboard` and `/notes/[id]` routes check auth on the server via
    `auth.api.getSession()`
  - API routes verify the user and take `userId` from the session — never from the
    request body
- **Authorization**
  - Every note query in the auth context filters by `user_id`
- **Public notes**
  - Slug should be sufficiently random to prevent guessing (e.g. 16+ chars)
- **Secrets**
  - `BETTER_AUTH_SECRET` must be a strong random value and never committed
- **XSS**
  - Primary data is TipTap JSON, not raw HTML
  - When rendering to HTML, only use TipTap's rendering (no arbitrary
    `dangerouslySetInnerHTML` with unsanitized data)
- **Rate limiting** (optional enhancement)
  - Apply per-IP or per-user rate limiting to API routes if exposed publicly

---

## 12. Development Workflow

1. Initialize the Next.js app with TypeScript on Node.js:
   `npx create-next-app@latest --ts`
2. Set up TailwindCSS
3. Install runtime deps: `npm i better-auth better-sqlite3 nanoid` and
   `npm i -D @types/better-sqlite3`
4. Add `serverExternalPackages: ["better-sqlite3"]` to `next.config.ts`
5. Create `lib/db.ts` and the `data/` directory; add `data/*.db*` to `.gitignore`
6. Integrate better-auth (`lib/auth.ts`, `app/api/auth/[...all]/route.ts`,
   `lib/auth-client.ts`) and set `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` in `.env`
7. Create the auth tables: `npx auth@latest migrate`
8. Create the app tables (`notes` + indexes) via `scripts/init-db.ts`, run with
   `node --experimental-strip-types scripts/init-db.ts` (Node 22+) or `tsx`
9. Build DB helpers and the note repository
10. Implement `/api/notes` and sharing APIs
11. Build dashboard and note editor pages
12. Integrate the TipTap editor and toolbar
13. Implement public note pages `/p/[slug]`
14. Add polish (loading states, toast messages, error handling)

**Scripts** (`package.json`):

```json
{
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "db:auth": "auth migrate",
    "db:init": "tsx scripts/init-db.ts"
  }
}
```
