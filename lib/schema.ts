/**
 * DDL for the application-owned tables.
 *
 * Lives here rather than inline in `scripts/init-db.ts` so the migration script and the
 * test suite build the *same* `notes` table. A schema that only exists inside a script
 * cannot be asserted against, which is how a table and the code that maps it drift apart.
 *
 * better-auth owns `user`, `session`, `account` and `verification` — those come from
 * `npm run db:auth` and must never be hand-written here.
 */
export const NOTES_SCHEMA_SQL = `
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
`;
