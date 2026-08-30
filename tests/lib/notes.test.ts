import { beforeEach, describe, expect, it } from 'vitest';
import {
  createNote,
  deleteNote,
  getNoteByPublicSlug,
  getNoteById,
  getNotesByUser,
  setNotePublic,
  updateNote,
} from '@/lib/notes';
import { EMPTY_DOC_JSON } from '@/lib/note-doc';
import { DEFAULT_NOTE_TITLE } from '@/lib/note-fields';
import { countNotes, readNoteRow, resetTestDb, seedNotes } from '../helpers/db.ts';
import { PLAIN_JSON, SEED_NOTES, SHOPPING_JSON, USERS } from '../helpers/fixtures.ts';

beforeEach(() => {
  resetTestDb();
  seedNotes();
});

describe('createNote', () => {
  it('returns the row the database actually stored, in camelCase', () => {
    const note = createNote(USERS.alice.id, { title: 'Weekend plan', contentJson: SHOPPING_JSON });

    expect(note).toMatchObject({
      userId: USERS.alice.id,
      title: 'Weekend plan',
      contentJson: SHOPPING_JSON,
      isPublic: false,
      publicSlug: null,
    });
    expect(note.id).toBeTruthy();
    // SQLite's own clock wrote these, so they exist rather than being guessed in JS.
    expect(note.createdAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(note.updatedAt).toBe(note.createdAt);
  });

  it('stores is_public as the integer 0, not a boolean', () => {
    const note = createNote(USERS.alice.id, { title: 'Weekend plan' });

    expect(readNoteRow(note.id)?.is_public).toBe(0);
    expect(note.isPublic).toBe(false);
  });

  it('trims the title before storing it', () => {
    const note = createNote(USERS.alice.id, { title: '   Weekend plan  ' });

    expect(note.title).toBe('Weekend plan');
    expect(readNoteRow(note.id)?.title).toBe('Weekend plan');
  });

  it('falls back to the default title for a whitespace-only title', () => {
    expect(createNote(USERS.alice.id, { title: '   ' }).title).toBe(DEFAULT_NOTE_TITLE);
  });

  it('stores an empty document when no content is given', () => {
    expect(createNote(USERS.alice.id, {}).contentJson).toBe(EMPTY_DOC_JSON);
  });

  it('works with no data argument at all', () => {
    const note = createNote(USERS.alice.id);

    expect(note.title).toBe(DEFAULT_NOTE_TITLE);
    expect(note.contentJson).toBe(EMPTY_DOC_JSON);
  });

  it('gives each note a distinct id', () => {
    const first = createNote(USERS.alice.id, { title: 'One' });
    const second = createNote(USERS.alice.id, { title: 'Two' });

    expect(first.id).not.toBe(second.id);
  });

  it('refuses a note for a user that does not exist', () => {
    // The foreign key is what stops an orphaned note, so this must throw rather than insert.
    expect(() => createNote('usr_nobody', { title: 'Orphan' })).toThrow(/FOREIGN KEY/i);
  });
});

describe('getNoteById', () => {
  it('returns the note to its owner', () => {
    const note = getNoteById(USERS.alice.id, SEED_NOTES.aliceOldest.id);

    expect(note).toMatchObject({
      id: SEED_NOTES.aliceOldest.id,
      userId: USERS.alice.id,
      title: 'Groceries',
      contentJson: SHOPPING_JSON,
      isPublic: false,
      publicSlug: null,
      updatedAt: '2026-01-01 09:00:00',
    });
  });

  it('maps is_public = 1 to a real boolean', () => {
    expect(getNoteById(USERS.alice.id, SEED_NOTES.aliceShared.id)?.isPublic).toBe(true);
  });

  it('returns null for a note belonging to somebody else', () => {
    // Ownership is a predicate in the SQL, so a foreign id is indistinguishable from a
    // missing one — there is no branch that could leak the row.
    expect(getNoteById(USERS.alice.id, SEED_NOTES.bobPrivate.id)).toBeNull();
  });

  it('returns null for an id that does not exist', () => {
    expect(getNoteById(USERS.alice.id, 'note_nope')).toBeNull();
  });
});

describe('getNotesByUser', () => {
  it('lists most recently updated first, breaking ties by id descending', () => {
    const ids = getNotesByUser(USERS.alice.id).map((note) => note.id);

    expect(ids).toEqual([
      SEED_NOTES.aliceTieHighId.id, // shares a second with the next one; higher id wins
      SEED_NOTES.aliceTieLowId.id,
      SEED_NOTES.aliceMiddle.id,
      SEED_NOTES.aliceShared.id,
      SEED_NOTES.aliceOldest.id,
    ]);
  });

  it('returns only that user own notes', () => {
    const ownerIds = new Set(getNotesByUser(USERS.alice.id).map((note) => note.userId));

    expect([...ownerIds]).toEqual([USERS.alice.id]);
  });

  it('returns an empty array for a user with no notes', () => {
    expect(getNotesByUser('usr_nobody')).toEqual([]);
  });
});

describe('updateNote', () => {
  const noteId = SEED_NOTES.aliceOldest.id;

  it('changes the title and leaves the body untouched', () => {
    const updated = updateNote(USERS.alice.id, noteId, { title: 'Renamed' });

    expect(updated?.title).toBe('Renamed');
    expect(updated?.contentJson).toBe(SHOPPING_JSON);
  });

  it('changes the body and leaves the title untouched', () => {
    const updated = updateNote(USERS.alice.id, noteId, { contentJson: PLAIN_JSON });

    expect(updated?.contentJson).toBe(PLAIN_JSON);
    expect(updated?.title).toBe('Groceries');
  });

  it('does not blank the omitted column in the database', () => {
    // The regression this guards: better-sqlite3 binds `undefined` as NULL, so a fixed
    // SET clause would quietly wipe content_json on a title-only save.
    updateNote(USERS.alice.id, noteId, { title: 'Renamed' });

    expect(readNoteRow(noteId)?.content_json).toBe(SHOPPING_JSON);
  });

  it('changes both fields at once', () => {
    const updated = updateNote(USERS.alice.id, noteId, {
      title: 'Renamed',
      contentJson: PLAIN_JSON,
    });

    expect(updated).toMatchObject({ title: 'Renamed', contentJson: PLAIN_JSON });
  });

  it('bumps updated_at but never created_at', () => {
    const updated = updateNote(USERS.alice.id, noteId, { title: 'Renamed' });

    expect(updated?.updatedAt).not.toBe(SEED_NOTES.aliceOldest.updatedAt);
    expect(updated?.createdAt).toBe(SEED_NOTES.aliceOldest.createdAt);
  });

  it('treats an empty patch as a no-op that does not touch updated_at', () => {
    const updated = updateNote(USERS.alice.id, noteId, {});

    expect(updated?.updatedAt).toBe(SEED_NOTES.aliceOldest.updatedAt);
    expect(readNoteRow(noteId)?.updated_at).toBe(SEED_NOTES.aliceOldest.updatedAt);
  });

  it('returns null for a note owned by somebody else and changes nothing', () => {
    const result = updateNote(USERS.alice.id, SEED_NOTES.bobPrivate.id, { title: 'Hijacked' });

    expect(result).toBeNull();
    expect(readNoteRow(SEED_NOTES.bobPrivate.id)?.title).toBe(SEED_NOTES.bobPrivate.title);
  });

  it('returns null for a note that does not exist', () => {
    expect(updateNote(USERS.alice.id, 'note_nope', { title: 'Renamed' })).toBeNull();
  });
});

describe('setNotePublic', () => {
  const noteId = SEED_NOTES.aliceOldest.id;

  it('mints an unguessable slug when sharing is turned on', () => {
    const shared = setNotePublic(USERS.alice.id, noteId, true);

    expect(shared?.isPublic).toBe(true);
    // SPEC.MD §11 wants 16+ characters so the URL cannot be guessed.
    expect(shared?.publicSlug).toMatch(/^[\w-]{21}$/);
    expect(readNoteRow(noteId)?.is_public).toBe(1);
  });

  it('clears the slug when sharing is turned off, rather than merely hiding it', () => {
    const unshared = setNotePublic(USERS.alice.id, SEED_NOTES.aliceShared.id, false);

    expect(unshared?.isPublic).toBe(false);
    expect(unshared?.publicSlug).toBeNull();
    expect(readNoteRow(SEED_NOTES.aliceShared.id)?.public_slug).toBeNull();
  });

  it('issues a different slug on re-share, so a revoked link stays dead', () => {
    const original = SEED_NOTES.aliceShared.publicSlug as string;
    setNotePublic(USERS.alice.id, SEED_NOTES.aliceShared.id, false);
    const reshared = setNotePublic(USERS.alice.id, SEED_NOTES.aliceShared.id, true);

    expect(reshared?.publicSlug).not.toBe(original);
    expect(getNoteByPublicSlug(original)).toBeNull();
  });

  it('keeps the existing slug when sharing is turned on twice', () => {
    const again = setNotePublic(USERS.alice.id, SEED_NOTES.aliceShared.id, true);

    expect(again?.publicSlug).toBe(SEED_NOTES.aliceShared.publicSlug);
  });

  it('does not bump updated_at, since sharing is not a content edit', () => {
    // Bumping it would jump the note to the top of the dashboard for no visible reason.
    setNotePublic(USERS.alice.id, noteId, true);

    expect(readNoteRow(noteId)?.updated_at).toBe(SEED_NOTES.aliceOldest.updatedAt);
  });

  it('returns null for a note owned by somebody else and shares nothing', () => {
    const result = setNotePublic(USERS.alice.id, SEED_NOTES.bobPrivate.id, true);

    expect(result).toBeNull();
    expect(readNoteRow(SEED_NOTES.bobPrivate.id)).toMatchObject({
      is_public: 0,
      public_slug: null,
    });
  });
});

describe('getNoteByPublicSlug', () => {
  it('finds a shared note without needing a user', () => {
    const note = getNoteByPublicSlug(SEED_NOTES.aliceShared.publicSlug as string);

    expect(note).toMatchObject({ id: SEED_NOTES.aliceShared.id, isPublic: true });
  });

  it('refuses a slug whose note is not actually shared', () => {
    // `AND is_public = 1` in the SQL *is* the authorisation check for anonymous visitors,
    // so a row that somehow kept its slug must stay unreachable.
    expect(getNoteByPublicSlug(SEED_NOTES.bobRevoked.publicSlug as string)).toBeNull();
  });

  it('returns null for an unknown slug', () => {
    expect(getNoteByPublicSlug('not-a-real-slug-00001')).toBeNull();
  });

  it('returns null for an empty slug', () => {
    expect(getNoteByPublicSlug('')).toBeNull();
  });
});

describe('deleteNote', () => {
  it('removes the row and reports that it did', () => {
    const before = countNotes();

    expect(deleteNote(USERS.alice.id, SEED_NOTES.aliceOldest.id)).toBe(true);
    expect(readNoteRow(SEED_NOTES.aliceOldest.id)).toBeUndefined();
    expect(countNotes()).toBe(before - 1);
  });

  it('refuses a note owned by somebody else without erroring', () => {
    expect(deleteNote(USERS.alice.id, SEED_NOTES.bobPrivate.id)).toBe(false);
    expect(readNoteRow(SEED_NOTES.bobPrivate.id)).toBeDefined();
  });

  it('reports false on a second delete of the same note', () => {
    deleteNote(USERS.alice.id, SEED_NOTES.aliceOldest.id);

    expect(deleteNote(USERS.alice.id, SEED_NOTES.aliceOldest.id)).toBe(false);
  });
});
