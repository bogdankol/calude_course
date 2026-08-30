import type { JSONContent } from '@tiptap/core';

/**
 * The stored-document layer: what an empty note looks like, and how to get a usable
 * document back out of `notes.content_json`.
 *
 * Deliberately free of runtime dependencies — the `JSONContent` import is type-only, so
 * this module pulls in neither TipTap nor zod. That is what lets the editor, the read-only
 * viewer, the public page and the server-side validator all share one definition of
 * "is this a note document?" without dragging StarterKit into each of them.
 */

/** What TipTap reports for an untouched document. */
export const EMPTY_DOC: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };

/**
 * The same document as it is written to `notes.content_json`.
 *
 * Derived from `EMPTY_DOC` rather than written out again: the two used to be separate
 * literals in `lib/tiptap.ts` and `lib/notes.ts`, which is a silent-drift hazard for no
 * benefit.
 */
export const EMPTY_DOC_JSON = JSON.stringify(EMPTY_DOC);

/**
 * Whether a parsed value is a TipTap document node.
 *
 * Only the top level is checked. TipTap validates the rest against the schema in
 * `lib/tiptap.ts` when it loads the content, and duplicating that here would be a second
 * schema to keep in step.
 */
function isNoteDoc(value: unknown): value is JSONContent {
  // `typeof null` is 'object', so the null check is doing real work here.
  return (
    typeof value === 'object' && value !== null && (value as { type?: unknown }).type === 'doc'
  );
}

/** Whether a string parses as a TipTap document. Used by the server-side zod schema. */
export function isNoteDocJson(value: string): boolean {
  try {
    return isNoteDoc(JSON.parse(value));
  } catch {
    return false;
  }
}

/**
 * Reads a stored document, falling back to an empty one.
 *
 * `content_json` is TEXT, so nothing at the database level guarantees it parses. A note
 * that somehow stored garbage should still render its title rather than crash the page.
 */
export function parseNoteDoc(contentJson: string): JSONContent {
  try {
    const parsed: unknown = JSON.parse(contentJson);
    if (isNoteDoc(parsed)) return parsed;
  } catch {
    // fall through to the empty document
  }
  return EMPTY_DOC;
}
