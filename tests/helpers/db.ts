import { getDb } from '@/lib/db';
import { NOTES_SCHEMA_SQL } from '@/lib/schema';
import { ALL_SEED_NOTES, USERS, type SeedNote } from './fixtures.ts';

/**
 * A throwaway in-memory database for the data-layer suites.
 *
 * The guard is not ceremony: `data/app.db` is a live development database the developer
 * signs into by hand, and `resetTestDb` drops tables. Importing this module against
 * anything other than `:memory:` must fail before a single statement runs.
 */
if (process.env.DATABASE_PATH !== ':memory:') {
  throw new Error(
    'Test database helper loaded with DATABASE_PATH=' +
      JSON.stringify(process.env.DATABASE_PATH) +
      '. It must be ":memory:" — see vitest.config.mts.',
  );
}

/**
 * A minimal stand-in for better-auth's `user` table. Only `id` matters here: it is what
 * `notes.user_id` references, and the FK is what makes the cascade real.
 */
const USER_TABLE_SQL = `
  CREATE TABLE "user" (
    "id"    TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE
  );
`;

const INSERT_NOTE_SQL = `
  INSERT INTO notes
    (id, user_id, title, content_json, is_public, public_slug, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`;

/** Rebuilds both tables from scratch and recreates the fixture users. */
export function resetTestDb(): void {
  const db = getDb();
  db.exec('DROP TABLE IF EXISTS notes');
  db.exec('DROP TABLE IF EXISTS "user"');
  db.exec(USER_TABLE_SQL);
  db.exec(NOTES_SCHEMA_SQL);

  const insertUser = db.prepare('INSERT INTO "user" ("id", "email") VALUES (?, ?)');
  for (const user of Object.values(USERS)) insertUser.run(user.id, user.email);
}

/** Inserts seed rows verbatim, so timestamps and slugs are exactly what the test declared. */
export function seedNotes(notes: readonly SeedNote[] = ALL_SEED_NOTES): void {
  const insert = getDb().prepare(INSERT_NOTE_SQL);
  for (const note of notes) {
    insert.run(
      note.id,
      note.userId,
      note.title,
      note.contentJson,
      // SQLite has no boolean, and better-sqlite3 throws on `true`.
      note.isPublic ? 1 : 0,
      note.publicSlug,
      note.createdAt,
      note.updatedAt,
    );
  }
}

export type RawNoteRow = {
  id: string;
  user_id: string;
  title: string;
  content_json: string;
  is_public: number;
  public_slug: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Reads a row straight from SQLite, bypassing the data layer's mapper — so a test can
 * assert what was really stored rather than what the function under test reported.
 */
export function readNoteRow(id: string): RawNoteRow | undefined {
  return getDb().prepare('SELECT * FROM notes WHERE id = ?').get(id) as RawNoteRow | undefined;
}

export function countNotes(): number {
  return (getDb().prepare('SELECT COUNT(*) AS n FROM notes').get() as { n: number }).n;
}
