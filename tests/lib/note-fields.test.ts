import { describe, expect, it } from 'vitest';
import { DEFAULT_NOTE_TITLE, buildNoteUpdate, resolveNoteTitle } from '@/lib/note-fields';

describe('resolveNoteTitle', () => {
  it('keeps a real title', () => {
    expect(resolveNoteTitle('Shopping list')).toBe('Shopping list');
  });

  it('trims surrounding whitespace', () => {
    expect(resolveNoteTitle('  Shopping list \n')).toBe('Shopping list');
  });

  it('falls back to the default when the title is only whitespace', () => {
    expect(resolveNoteTitle('   ')).toBe(DEFAULT_NOTE_TITLE);
  });

  it('falls back to the default when the title is empty', () => {
    expect(resolveNoteTitle('')).toBe(DEFAULT_NOTE_TITLE);
  });

  it('falls back to the default when no title is given at all', () => {
    expect(resolveNoteTitle(undefined)).toBe(DEFAULT_NOTE_TITLE);
  });
});

describe('buildNoteUpdate', () => {
  it('returns null for an empty patch so the caller can skip the write entirely', () => {
    expect(buildNoteUpdate({})).toBeNull();
  });

  it('treats an explicitly undefined field as absent', () => {
    // Not cosmetic: better-sqlite3 binds `undefined` as NULL, so letting it reach the SQL
    // would blank content_json silently and violate title's NOT NULL loudly.
    expect(buildNoteUpdate({ title: undefined, contentJson: undefined })).toBeNull();
  });

  it('sets only the title when only the title is given', () => {
    expect(buildNoteUpdate({ title: 'Renamed' })).toEqual({
      setClause: "title = ?, updated_at = datetime('now')",
      params: ['Renamed'],
    });
  });

  it('sets only the body when only the body is given', () => {
    expect(buildNoteUpdate({ contentJson: '{"type":"doc"}' })).toEqual({
      setClause: "content_json = ?, updated_at = datetime('now')",
      params: ['{"type":"doc"}'],
    });
  });

  it('sets both fields in the order their placeholders appear', () => {
    expect(buildNoteUpdate({ title: 'Renamed', contentJson: '{"type":"doc"}' })).toEqual({
      setClause: "title = ?, content_json = ?, updated_at = datetime('now')",
      params: ['Renamed', '{"type":"doc"}'],
    });
  });

  it('always bumps updated_at when something actually changes', () => {
    const built = buildNoteUpdate({ title: 'Renamed' });
    expect(built?.setClause).toContain("updated_at = datetime('now')");
  });

  it('keeps an empty-string title, which is a real edit rather than an absent field', () => {
    expect(buildNoteUpdate({ title: '' })?.params).toEqual(['']);
  });
});
