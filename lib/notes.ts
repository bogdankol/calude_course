import { nanoid } from 'nanoid';
// Explicit .ts extension so this module can also be imported from `scripts/*.ts`, which
// run through Node's type stripping and will not resolve an extensionless relative path.
// Turbopack and tsc both accept it (`allowImportingTsExtensions` is on, `noEmit` is set).
import { get, query, run, type SqlParam } from './db.ts';
import { EMPTY_DOC_JSON } from './note-doc.ts';
import { buildNoteUpdate, resolveNoteTitle } from './note-fields.ts';

/**
 * Application view of a row in `notes`. The table is snake_case; this is camelCase, and
 * `is_public` (an INTEGER, because SQLite has no boolean) becomes a real boolean. Mapping
 * between the two is this module's job — nothing above it should see a raw row.
 */
export type Note = {
  id: string;
  userId: string;
  title: string;
  /** Stringified TipTap document. Stored as TEXT; never parsed here. */
  contentJson: string;
  isPublic: boolean;
  publicSlug: string | null;
  createdAt: string;
  updatedAt: string;
};

type NoteRow = {
  id: string;
  user_id: string;
  title: string;
  content_json: string;
  is_public: number;
  public_slug: string | null;
  created_at: string;
  updated_at: string;
};

const NOTE_COLUMNS =
  'id, user_id, title, content_json, is_public, public_slug, created_at, updated_at';

function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    contentJson: row.content_json,
    isPublic: row.is_public !== 0,
    publicSlug: row.public_slug,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Inserts a note owned by `userId` and returns it as written.
 *
 * Synchronous, unlike SPEC.MD §6.2's `Promise<Note>`: better-sqlite3 has no async API, so
 * a promise here would only be decoration. `await` on the result still works for callers
 * that want it.
 *
 * `RETURNING` hands back the row the database actually stored, so `created_at` /
 * `updated_at` come from SQLite's clock rather than being guessed at in JS.
 */
export function createNote(
  userId: string,
  data: { title?: string; contentJson?: string } = {},
): Note {
  const title = resolveNoteTitle(data.title);
  const contentJson = data.contentJson ?? EMPTY_DOC_JSON;

  const params: SqlParam[] = [nanoid(), userId, title, contentJson];

  const row = get<NoteRow>(
    `INSERT INTO notes (id, user_id, title, content_json)
     VALUES (?, ?, ?, ?)
     RETURNING ${NOTE_COLUMNS}`,
    params,
  );

  // Unreachable: an INSERT ... RETURNING that inserts a row always yields one, and a
  // failure throws rather than returning nothing. Narrowing the type is the point.
  if (!row) throw new Error('createNote: insert returned no row');

  return toNote(row);
}

/**
 * One note belonging to `userId`, or null.
 *
 * Ownership is enforced in the SQL rather than checked afterwards, so another user's id
 * simply finds nothing — there is no branch that could leak the row by mistake, and no
 * way to distinguish "does not exist" from "not yours".
 */
export function getNoteById(userId: string, noteId: string): Note | null {
  const row = get<NoteRow>(`SELECT ${NOTE_COLUMNS} FROM notes WHERE id = ? AND user_id = ?`, [
    noteId,
    userId,
  ]);

  return row ? toNote(row) : null;
}

/**
 * Every note owned by `userId`, most recently updated first — the order the dashboard
 * lists them in.
 *
 * The `id` tie-break matters: `datetime('now')` has one-second resolution, so notes
 * created in quick succession share an `updated_at` and would otherwise come back in an
 * arbitrary order that could shuffle between requests.
 */
export function getNotesByUser(userId: string): Note[] {
  return query<NoteRow>(
    `SELECT ${NOTE_COLUMNS} FROM notes
      WHERE user_id = ?
      ORDER BY updated_at DESC, id DESC`,
    [userId],
  ).map(toNote);
}

/**
 * Updates the title and/or body of one of `userId`'s notes and returns the stored row,
 * or null when the note is not theirs.
 *
 * Only the keys actually present in `data` reach the SQL. That matters more than it
 * looks: better-sqlite3 binds `undefined` as NULL, so a fixed
 * `SET title = ?, content_json = ?` would blank whichever field the caller omitted —
 * and `title` is `NOT NULL`, so it would fail loudly while `content_json` fails quietly.
 */
export function updateNote(
  userId: string,
  noteId: string,
  data: Partial<{ title: string; contentJson: string }>,
): Note | null {
  const update = buildNoteUpdate(data);

  // Nothing to change — report the note as-is rather than touching `updated_at`.
  if (!update) return getNoteById(userId, noteId);

  const row = get<NoteRow>(
    `UPDATE notes SET ${update.setClause}
      WHERE id = ? AND user_id = ?
      RETURNING ${NOTE_COLUMNS}`,
    [...update.params, noteId, userId],
  );

  return row ? toNote(row) : null;
}

/**
 * Length of a generated public slug. SPEC.MD §11 wants "16+ chars" so the URL cannot be
 * guessed; nanoid's alphabet is 64 symbols, so 21 chars is ~126 bits of entropy.
 */
const PUBLIC_SLUG_LENGTH = 21;

/**
 * Turns public sharing on or off for one of `userId`'s notes.
 *
 * Enabling mints a slug; disabling sets `public_slug = NULL` as SPEC.MD §7.2 requires,
 * which is what makes `/p/<slug>` 404 afterwards — the slug is not merely hidden, it is
 * gone. Because unsharing clears it, re-sharing always issues a **new** slug and the
 * revoked URL stays dead. The `?? nanoid(...)` fallback below therefore only guards the
 * is_public=0-with-slug state that nothing in the app produces; it is not a promise that
 * a link survives being switched off.
 *
 * Deliberately does NOT touch `updated_at`: sharing is not a content edit, and bumping it
 * would jump the note to the top of the dashboard list for no reason the user can see.
 */
export function setNotePublic(userId: string, noteId: string, isPublic: boolean): Note | null {
  const existing = getNoteById(userId, noteId);
  if (!existing) return null;

  const slug = isPublic ? (existing.publicSlug ?? nanoid(PUBLIC_SLUG_LENGTH)) : null;

  const row = get<NoteRow>(
    `UPDATE notes SET is_public = ?, public_slug = ?
      WHERE id = ? AND user_id = ?
      RETURNING ${NOTE_COLUMNS}`,
    // `isPublic ? 1 : 0` because SQLite has no boolean and better-sqlite3 throws on `true`.
    [isPublic ? 1 : 0, slug, noteId, userId],
  );

  return row ? toNote(row) : null;
}

/**
 * Looks up a note by its public slug, for anonymous visitors to `/p/<slug>`.
 *
 * Not scoped to a user — that is the point — so the `is_public = 1` predicate is the
 * whole authorisation check and must stay in the SQL. It is belt-and-braces alongside
 * nulling the slug on unshare: even a row that somehow kept its slug stays unreachable
 * once the flag is off.
 */
export function getNoteByPublicSlug(slug: string): Note | null {
  const row = get<NoteRow>(
    `SELECT ${NOTE_COLUMNS} FROM notes WHERE public_slug = ? AND is_public = 1`,
    [slug],
  );

  return row ? toNote(row) : null;
}

/**
 * Hard-deletes a note, scoped to its owner — another user's id deletes nothing rather
 * than erroring, so the ownership check cannot be forgotten at a call site.
 *
 * Returns whether a row actually went away. SPEC.MD §6.2 types this `void`, but a bare
 * void would force callers into a second query just to tell "deleted" from "not yours".
 */
export function deleteNote(userId: string, noteId: string): boolean {
  return run('DELETE FROM notes WHERE id = ? AND user_id = ?', [noteId, userId]).changes > 0;
}
