import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

/** SQLite's special in-memory database. A name, not a path — it must not be resolved. */
const IN_MEMORY = ':memory:';

const DEFAULT_DATABASE_PATH = 'data/app.db';

/**
 * Where the database lives, as better-sqlite3 wants it.
 *
 * `:memory:` is passed through untouched: `path.resolve(':memory:')` produces a filename
 * containing a colon, which Windows rejects outright.
 *
 * Takes the configured value as an argument rather than reading `process.env` itself, so
 * it is a pure function and "no path configured" is expressible in a test.
 */
export function resolveDatabaseFile(databasePath: string | undefined): string {
  const configured = databasePath || DEFAULT_DATABASE_PATH;
  return configured === IN_MEMORY ? IN_MEMORY : path.resolve(configured);
}

/**
 * Opens a connection with the pragmas this app expects.
 *
 * `foreign_keys = ON` is cheap insurance rather than a fix: better-sqlite3 is compiled with
 * `SQLITE_DEFAULT_FOREIGN_KEYS=1`, so FKs are already enforced here. It matters if the
 * driver is ever swapped for one using SQLite's stock default of OFF.
 */
export function openDatabase(file: string): Database.Database {
  if (file !== IN_MEMORY) fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

// Next.js reloads modules on every edit in dev, which would otherwise open a new
// SQLite handle per reload. Park the singleton on globalThis so it survives HMR.
const globalForDb = globalThis as unknown as { __db?: Database.Database };

export function getDb() {
  globalForDb.__db ??= openDatabase(resolveDatabaseFile(process.env.DATABASE_PATH));
  return globalForDb.__db;
}

/**
 * The only value types better-sqlite3 will bind positionally. Everything else fails at
 * runtime, and `unknown[]` here would let all of it through the type checker:
 * `true` throws a TypeError, a plain object is silently reinterpreted as a
 * named-parameter bag, and `undefined` quietly binds NULL. Callers coerce at the
 * boundary — `isPublic ? 1 : 0`, `JSON.stringify(doc)`, and omit absent keys from the
 * SQL rather than passing `undefined`.
 */
export type SqlParam = number | string | bigint | Buffer | null;

export const query = <T>(sql: string, params: SqlParam[] = []) =>
  getDb()
    .prepare(sql)
    .all(...params) as T[];

export const get = <T>(sql: string, params: SqlParam[] = []) =>
  getDb()
    .prepare(sql)
    .get(...params) as T | undefined;

export const run = (sql: string, params: SqlParam[] = []) =>
  getDb()
    .prepare(sql)
    .run(...params);
