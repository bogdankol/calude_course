/**
 * Creates the application-owned tables. Run AFTER the better-auth CLI has created
 * the auth tables (`npm run db:auth`), because `notes.user_id` references `user(id)`.
 *
 *   npm run db:init
 */
import { getDb } from '../lib/db.ts';

const db = getDb();

const authTableExists = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'user'")
  .get();

if (!authTableExists) {
  console.error(
    'Missing the better-auth "user" table. Run `npm run db:auth` first — ' +
      'notes.user_id references user(id).',
  );
  process.exit(1);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id           TEXT    NOT NULL PRIMARY KEY,
    user_id      TEXT    NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
    title        TEXT    NOT NULL,
    content_json TEXT    NOT NULL,
    is_public    INTEGER NOT NULL DEFAULT 0,
    public_slug  TEXT    UNIQUE,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_notes_user_id     ON notes(user_id);
  CREATE INDEX IF NOT EXISTS idx_notes_public_slug ON notes(public_slug);
  CREATE INDEX IF NOT EXISTS idx_notes_is_public   ON notes(is_public);
`);

const tables = db
  .prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table'
       AND name NOT LIKE 'sqlite_%' ORDER BY name`,
  )
  .all()
  .map((row) => (row as { name: string }).name);

console.log('journal_mode:', db.pragma('journal_mode', { simple: true }));
console.log('foreign_keys:', db.pragma('foreign_keys', { simple: true }));
console.log('tables:', tables.join(', '));
