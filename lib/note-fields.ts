import type { SqlParam } from './db.ts';

/**
 * Field-level rules for a note, split out of `lib/notes.ts` so they can be tested without
 * a database. Both are small but carry the two easiest mistakes in the data layer: what an
 * absent title means, and what an absent field means in a partial update.
 */

/** What a note is called when the caller supplies nothing usable. */
export const DEFAULT_NOTE_TITLE = 'Untitled note';

/** Trims a submitted title, falling back to the default when nothing is left. */
export function resolveNoteTitle(title: string | undefined): string {
  return title?.trim() || DEFAULT_NOTE_TITLE;
}

export type NoteUpdate = { setClause: string; params: SqlParam[] };

/**
 * Builds the SET clause for a partial note update, or null when there is nothing to write.
 *
 * Only keys actually present reach the SQL, and that is load-bearing rather than tidy:
 * better-sqlite3 binds `undefined` as NULL, so a fixed `SET title = ?, content_json = ?`
 * would blank whichever field the caller omitted — loudly for `title` (NOT NULL) and
 * **silently** for `content_json`.
 *
 * Returning null for the empty patch is what lets `updateNote` report the note unchanged
 * without touching `updated_at`, so a no-op save cannot shuffle the dashboard order.
 */
export function buildNoteUpdate(
  data: Partial<{ title: string; contentJson: string }>,
): NoteUpdate | null {
  const assignments: string[] = [];
  const params: SqlParam[] = [];

  if (data.title !== undefined) {
    assignments.push('title = ?');
    params.push(data.title);
  }
  if (data.contentJson !== undefined) {
    assignments.push('content_json = ?');
    params.push(data.contentJson);
  }

  if (assignments.length === 0) return null;

  assignments.push("updated_at = datetime('now')");
  return { setClause: assignments.join(', '), params };
}
