import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { openDatabase, resolveDatabaseFile } from '@/lib/db';
import { NOTES_SCHEMA_SQL } from '@/lib/schema';

describe('resolveDatabaseFile', () => {
  it('leaves SQLite\u2019s in-memory name alone instead of resolving it to a path', () => {
    // path.resolve(':memory:') yields a filename containing a colon, which Windows
    // rejects outright — so this is the difference between working and not on win32.
    expect(resolveDatabaseFile(':memory:')).toBe(':memory:');
  });

  it('resolves a relative path to an absolute one', () => {
    expect(resolveDatabaseFile('data/app.db')).toBe(path.resolve('data/app.db'));
  });

  it('defaults to data/app.db when nothing is configured', () => {
    expect(resolveDatabaseFile(undefined)).toBe(path.resolve('data/app.db'));
  });
});

describe('openDatabase', () => {
  it('enforces foreign keys, which notes.user_id depends on', () => {
    const db = openDatabase(':memory:');
    try {
      expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    } finally {
      db.close();
    }
  });
});

describe('NOTES_SCHEMA_SQL', () => {
  it('creates the notes table with the columns the data layer maps', () => {
    const db = openDatabase(':memory:');
    try {
      db.exec('CREATE TABLE "user" ("id" TEXT PRIMARY KEY)');
      db.exec(NOTES_SCHEMA_SQL);

      const columns = db
        .prepare('SELECT name, type, "notnull", dflt_value FROM pragma_table_info(?)')
        .all('notes') as {
        name: string;
        type: string;
        notnull: number;
        dflt_value: string | null;
      }[];
      const byName = Object.fromEntries(columns.map((column) => [column.name, column]));

      expect(Object.keys(byName).sort()).toEqual([
        'content_json',
        'created_at',
        'id',
        'is_public',
        'public_slug',
        'title',
        'updated_at',
        'user_id',
      ]);
      // NOT NULL on title is what makes an omitted title fail loudly rather than blank out.
      expect(byName.title.notnull).toBe(1);
      expect(byName.content_json.notnull).toBe(1);
      // SQLite has no boolean; is_public is an INTEGER defaulting to "not shared".
      expect(byName.is_public.type).toBe('INTEGER');
      expect(byName.is_public.dflt_value).toBe('0');
      // Nullable — unsharing clears the slug rather than merely hiding it.
      expect(byName.public_slug.notnull).toBe(0);
    } finally {
      db.close();
    }
  });

  it('makes public_slug unique so two notes cannot share a public URL', () => {
    const db = openDatabase(':memory:');
    try {
      db.exec('CREATE TABLE "user" ("id" TEXT PRIMARY KEY)');
      db.exec(NOTES_SCHEMA_SQL);
      db.prepare('INSERT INTO "user" ("id") VALUES (?)').run('u1');

      const insert = db.prepare(
        'INSERT INTO notes (id, user_id, title, content_json, is_public, public_slug) VALUES (?, ?, ?, ?, 1, ?)',
      );
      insert.run('n1', 'u1', 'One', '{}', 'shared-slug');

      expect(() => insert.run('n2', 'u1', 'Two', '{}', 'shared-slug')).toThrow(/UNIQUE/i);
    } finally {
      db.close();
    }
  });

  it('cascades a deleted user\u2019s notes away', () => {
    const db = openDatabase(':memory:');
    try {
      db.exec('CREATE TABLE "user" ("id" TEXT PRIMARY KEY)');
      db.exec(NOTES_SCHEMA_SQL);
      db.prepare('INSERT INTO "user" ("id") VALUES (?)').run('u1');
      db.prepare('INSERT INTO notes (id, user_id, title, content_json) VALUES (?, ?, ?, ?)').run(
        'n1',
        'u1',
        'One',
        '{}',
      );

      db.prepare('DELETE FROM "user" WHERE "id" = ?').run('u1');

      expect(db.prepare('SELECT COUNT(*) AS n FROM notes').get()).toEqual({ n: 0 });
    } finally {
      db.close();
    }
  });
});
