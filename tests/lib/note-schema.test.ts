import { describe, expect, it } from 'vitest';
import { MAX_TITLE_LENGTH, parseNoteInput } from '@/lib/note-schema';
import { SHOPPING_JSON } from '../helpers/fixtures.ts';

/** Builds the FormData a submitted note form produces. Omitted keys are genuinely absent. */
function noteForm(fields: { title?: string; contentJson?: string }): FormData {
  const formData = new FormData();
  if (fields.title !== undefined) formData.set('title', fields.title);
  if (fields.contentJson !== undefined) formData.set('contentJson', fields.contentJson);
  return formData;
}

/** The first message is what both actions surface to the user. */
function firstError(result: ReturnType<typeof parseNoteInput>): string | undefined {
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe('parseNoteInput', () => {
  it('accepts a well-formed note', () => {
    const result = parseNoteInput(noteForm({ title: 'Groceries', contentJson: SHOPPING_JSON }));

    expect(result.success).toBe(true);
    expect(result.success && result.data).toEqual({
      title: 'Groceries',
      contentJson: SHOPPING_JSON,
    });
  });

  it('trims the title, so the trimmed value is what reaches the database', () => {
    const result = parseNoteInput(
      noteForm({ title: '  Groceries \n', contentJson: SHOPPING_JSON }),
    );

    expect(result.success && result.data.title).toBe('Groceries');
  });

  it('rejects a whitespace-only title', () => {
    // The `required` attribute stops an empty field in the browser, but an action is its
    // own endpoint — whitespace reaches the server and must be rejected here.
    const result = parseNoteInput(noteForm({ title: '   ', contentJson: SHOPPING_JSON }));

    expect(result.success).toBe(false);
    expect(firstError(result)).toBe('Give your note a title.');
  });

  it('rejects a missing title field', () => {
    expect(parseNoteInput(noteForm({ contentJson: SHOPPING_JSON })).success).toBe(false);
  });

  it('accepts a title of exactly the maximum length', () => {
    const title = 'a'.repeat(MAX_TITLE_LENGTH);

    expect(parseNoteInput(noteForm({ title, contentJson: SHOPPING_JSON })).success).toBe(true);
  });

  it('rejects a title one character over the maximum', () => {
    const title = 'a'.repeat(MAX_TITLE_LENGTH + 1);
    const result = parseNoteInput(noteForm({ title, contentJson: SHOPPING_JSON }));

    expect(result.success).toBe(false);
    expect(firstError(result)).toBe('Title must be 200 characters or fewer.');
  });

  it('measures the title length after trimming', () => {
    const title = '  ' + 'a'.repeat(MAX_TITLE_LENGTH) + '  ';

    expect(parseNoteInput(noteForm({ title, contentJson: SHOPPING_JSON })).success).toBe(true);
  });

  it('rejects content that is not a TipTap document', () => {
    const result = parseNoteInput(noteForm({ title: 'Groceries', contentJson: '{"type":"span"}' }));

    expect(result.success).toBe(false);
    expect(firstError(result)).toBe('The editor content was not in the expected format.');
  });

  it('rejects content that is not JSON at all', () => {
    const result = parseNoteInput(
      noteForm({ title: 'Groceries', contentJson: '<img src=x onerror=alert(1)>' }),
    );

    expect(result.success).toBe(false);
  });

  it('rejects empty content with a message about the editor', () => {
    const result = parseNoteInput(noteForm({ title: 'Groceries', contentJson: '' }));

    expect(result.success).toBe(false);
    expect(firstError(result)).toBe('The editor did not send any content.');
  });

  it('rejects a missing content field', () => {
    expect(parseNoteInput(noteForm({ title: 'Groceries' })).success).toBe(false);
  });

  it('ignores extra fields rather than passing them through to the database', () => {
    const formData = noteForm({ title: 'Groceries', contentJson: SHOPPING_JSON });
    formData.set('userId', 'usr_someone_else');
    formData.set('isPublic', 'true');

    const result = parseNoteInput(formData);

    expect(result.success && result.data).toEqual({
      title: 'Groceries',
      contentJson: SHOPPING_JSON,
    });
  });
});
