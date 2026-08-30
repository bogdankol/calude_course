/**
 * Creates the application-owned tables. Run AFTER the better-auth CLI has created
 * the auth tables (`npm run db:auth`), because `notes.user_id` references `user(id)`.
 *
 *   npm run db:init
 */
import { getDb } from '../lib/db.ts';
import { NOTES_SCHEMA_SQL } from '../lib/schema.ts';

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

db.exec(NOTES_SCHEMA_SQL);

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
