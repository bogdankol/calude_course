'use client';

import type { JSX } from 'react';
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react';
import { noteExtensions } from '@/lib/tiptap';

/**
 * Read-only render of a stored TipTap document.
 *
 * Uses a non-editable editor rather than `generateHTML` + `dangerouslySetInnerHTML`:
 * `generateHTML` needs a DOM and throws `window is not defined` under the Node runtime
 * (verified), so it would mean pulling in jsdom. Going through TipTap keeps the schema as
 * the only thing that can produce markup, so stored content cannot inject anything the
 * editor's own extensions do not allow.
 *
 * Extensions come from `lib/tiptap.ts`, the same list the editor uses. That shared config
 * is load-bearing: a schema mismatch would silently drop nodes the document actually
 * contains — an H1 written in the editor would simply vanish here.
 */
export function NoteContent({ doc }: { doc: JSONContent }): JSX.Element {
  const editor = useEditor({
    extensions: noteExtensions(),
    content: doc,
    editable: false,
    // Required under the App Router — see NoteEditor. Leaves `editor` null until hydration.
    immediatelyRender: false,
    editorProps: {
      attributes: { class: 'tiptap-content' },
    },
  });

  if (!editor) {
    return <div className='tiptap-content text-neutral-600'>Loading content…</div>;
  }

  return <EditorContent editor={editor} />;
}
