import StarterKit from '@tiptap/starter-kit';
import type { JSONContent } from '@tiptap/core';

/**
 * Heading levels the app allows, per SPEC.MD §1 ("Heading levels (H1–H3) + normal text")
 * and the §9.2 toolbar list.
 */
export const HEADING_LEVELS = [1, 2, 3] as const;

/** What TipTap reports for an untouched document. */
export const EMPTY_DOC: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };

/**
 * The one extension list for notes — used by the editor *and* the read-only viewer.
 *
 * Shared on purpose: if the two configs disagree, the reader silently drops nodes the
 * stored document actually contains (an H1 written with `levels: [1,2,3]` disappears in a
 * viewer built with `[2,3]`). Keeping it here makes that impossible.
 *
 * `StarterKit` alone is correct for v3 — it already bundles Code, CodeBlock, Link,
 * Underline, HorizontalRule and the list extensions, so importing any of those separately
 * would register them twice and TipTap would warn about duplicates.
 */
export function noteExtensions() {
  return [StarterKit.configure({ heading: { levels: [...HEADING_LEVELS] } })];
}
