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

export const query = <T>(sql: string, params: unknown[] = []) =>
  getDb()
    .prepare(sql)
    .all(...params) as T[];

export const get = <T>(sql: string, params: unknown[] = []) =>
  getDb()
    .prepare(sql)
    .get(...params) as T | undefined;

export const run = (sql: string, params: unknown[] = []) =>
  getDb()
    .prepare(sql)
    .run(...params);
