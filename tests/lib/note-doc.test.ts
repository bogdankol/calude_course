import { describe, expect, it } from 'vitest';
import { EMPTY_DOC, EMPTY_DOC_JSON, isNoteDocJson, parseNoteDoc } from '@/lib/note-doc';

/**
 * Mock documents shaped the way TipTap actually serialises them, so the parser is
 * exercised against realistic input rather than a hand-simplified stand-in.
 */
const RICH_DOC = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Shopping' }] },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Milk' }] }],
        },
      ],
    },
  ],
};

describe('EMPTY_DOC_JSON', () => {
  it('is EMPTY_DOC serialised, so the two cannot drift apart', () => {
    expect(EMPTY_DOC_JSON).toBe(JSON.stringify(EMPTY_DOC));
  });

  it('is the exact string the notes table stores for a blank note', () => {
    expect(EMPTY_DOC_JSON).toBe('{"type":"doc","content":[{"type":"paragraph"}]}');
  });

  it('round-trips back into a document the parser accepts', () => {
    expect(parseNoteDoc(EMPTY_DOC_JSON)).toEqual(EMPTY_DOC);
  });
});

describe('isNoteDocJson', () => {
  it('accepts a serialised TipTap document', () => {
    expect(isNoteDocJson(JSON.stringify(RICH_DOC))).toBe(true);
  });

  it('rejects a string that is not JSON at all', () => {
    expect(isNoteDocJson('<script>alert(1)</script>')).toBe(false);
  });

  it('rejects JSON whose top-level type is not "doc"', () => {
    expect(isNoteDocJson('{"type":"paragraph"}')).toBe(false);
  });

  it('rejects a JSON null, which typeof still reports as "object"', () => {
    expect(isNoteDocJson('null')).toBe(false);
  });

  it('rejects a JSON array, which has no type property', () => {
    expect(isNoteDocJson('[{"type":"doc"}]')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isNoteDocJson('')).toBe(false);
  });
});

describe('parseNoteDoc', () => {
  it('returns the stored document when it is well formed', () => {
    expect(parseNoteDoc(JSON.stringify(RICH_DOC))).toEqual(RICH_DOC);
  });

  it('falls back to the empty document rather than throwing on malformed JSON', () => {
    expect(parseNoteDoc('{ not json')).toEqual(EMPTY_DOC);
  });

  it('falls back to the empty document when the top-level node is not a doc', () => {
    expect(parseNoteDoc('{"type":"paragraph","content":[]}')).toEqual(EMPTY_DOC);
  });

  it('falls back to the empty document for a JSON null', () => {
    expect(parseNoteDoc('null')).toEqual(EMPTY_DOC);
  });
});
