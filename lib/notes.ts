import { nanoid } from "nanoid";
// Explicit .ts extension so this module can also be imported from `scripts/*.ts`, which
// run through Node's type stripping and will not resolve an extensionless relative path.
// Turbopack and tsc both accept it (`allowImportingTsExtensions` is on, `noEmit` is set).
import { get, type SqlParam } from "./db.ts";

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
  "id, user_id, title, content_json, is_public, public_slug, created_at, updated_at";

/** What TipTap produces for an untouched editor, and what an empty note stores. */
export const EMPTY_DOC_JSON = '{"type":"doc","content":[{"type":"paragraph"}]}';

const DEFAULT_TITLE = "Untitled note";

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
  const title = data.title?.trim() || DEFAULT_TITLE;
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
  if (!row) throw new Error("createNote: insert returned no row");

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
  const row = get<NoteRow>(
    `SELECT ${NOTE_COLUMNS} FROM notes WHERE id = ? AND user_id = ?`,
    [noteId, userId],
  );

  return row ? toNote(row) : null;
}
