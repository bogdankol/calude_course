import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

// Next.js reloads modules on every edit in dev, which would otherwise open a new
// SQLite handle per reload. Park the singleton on globalThis so it survives HMR.
const globalForDb = globalThis as unknown as { __db?: Database.Database };

export function getDb() {
  if (!globalForDb.__db) {
    const file = path.resolve(process.env.DATABASE_PATH ?? "data/app.db");
    fs.mkdirSync(path.dirname(file), { recursive: true });

    const db = new Database(file);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");

    globalForDb.__db = db;
  }
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
