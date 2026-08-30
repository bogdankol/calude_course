'use client';

import { useCallback, useRef, useState, type FormEvent, type JSX } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { JSONContent } from '@tiptap/react';
import { NoteEditor } from '@/components/NoteEditor';
import { EMPTY_DOC } from '@/lib/note-doc';
import { createNoteAction } from '@/app/notes/new/actions';
import { updateNoteAction } from '@/app/notes/[id]/actions';

/**
 * Mirrors `MAX_TITLE_LENGTH` in `lib/note-schema.ts`. Duplicated on purpose: importing
 * that module here would pull zod into the client bundle for the sake of one number. The
 * schema is what actually enforces the limit; this is only the input hint.
 */
const MAX_TITLE_LENGTH = 200;

const CONTENT_LABEL_ID = 'note-content-label';

type NoteFormProps = {
  /** Present when editing an existing note, omitted when creating one. */
  noteId?: string;
  initialTitle?: string;
  initialDoc?: JSONContent;
};

/**
 * The note editor form, used for both creating and editing.
 *
 * One component rather than two so the title field, the editor wiring and the error
 * handling cannot drift apart between the two flows. Creating redirects to the new note;
 * editing stays on the page and reports that it saved.
 */
export function NoteForm({ noteId, initialTitle, initialDoc }: NoteFormProps): JSX.Element {
  const router = useRouter();
  const isEdit = noteId !== undefined;

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // A ref, not state: the editor reports every keystroke, and none of it changes what this
  // component renders. Holding it in state would re-render the form per character.
  const docRef = useRef<JSONContent>(initialDoc ?? EMPTY_DOC);

  // Stable identity so the editor is not handed a fresh callback on every render.
  const handleEditorChange = useCallback((doc: JSONContent) => {
    docRef.current = doc;
    // Returning the previous value makes React bail out, so typing only triggers a
    // re-render on the first keystroke after a save — when there is a badge to clear.
    setSaved((wasSaved) => (wasSaved ? false : wasSaved));
  }, []);

  function handleTitleChange(): void {
    setSaved((wasSaved) => (wasSaved ? false : wasSaved));
  }

  /**
   * A plain `onSubmit` rather than `<form action={…}>`, for two reasons: the editor is a
   * contenteditable and contributes nothing to `FormData` on its own, so the document has
   * to be attached by hand; and React 19 wraps action dispatches in `requestFormReset`,
   * which would blank the title the user typed whenever the action returns a validation
   * error. Same approach as `AuthForm.tsx`.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;

    const formData = new FormData(event.currentTarget);
    formData.set('contentJson', JSON.stringify(docRef.current));

    setPending(true);
    setError(null);
    setSaved(false);

    // Checked against `undefined` inline rather than via `isEdit` so TypeScript narrows
    // `noteId` to a string for the update call.
    const result =
      noteId === undefined
        ? await createNoteAction(formData)
        : await updateNoteAction(noteId, formData);

    if (result?.error) {
      setError(result.error);
      setPending(false);
      return;
    }

    // Creating redirects and never reaches here. Editing stays put, so report the save and
    // refresh the server component to pick up the new `updated_at`.
    setSaved(true);
    setPending(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className='mt-8 flex flex-col gap-6'>
      <fieldset disabled={pending} className='flex min-w-0 flex-col gap-6'>
        <legend className='sr-only'>{isEdit ? 'Edit note' : 'New note'}</legend>

        <div className='flex flex-col gap-1.5'>
          <label htmlFor='title' className='text-sm font-medium text-neutral-300'>
            Title
          </label>
          <input
            id='title'
            name='title'
            required
            defaultValue={initialTitle}
            onChange={handleTitleChange}
            maxLength={MAX_TITLE_LENGTH}
            autoComplete='off'
            placeholder='Untitled note'
            className='w-full rounded-md border border-white/10 bg-white/5 px-3 py-2.5 text-base text-neutral-100 transition-colors placeholder:text-neutral-600 focus-visible:border-slate-400 focus-visible:outline-2 focus-visible:outline-slate-400 disabled:opacity-60'
          />
        </div>

        <div className='flex flex-col gap-1.5'>
          <span id={CONTENT_LABEL_ID} className='text-sm font-medium text-neutral-300'>
            Content
          </span>
          <NoteEditor
            onChange={handleEditorChange}
            labelledBy={CONTENT_LABEL_ID}
            initialDoc={initialDoc}
            disabled={pending}
          />
          <p className='text-xs text-neutral-500'>
            Use the toolbar, its keyboard shortcuts, or type markdown as you go — <code>#</code> for
            a heading, <code>-</code> for a bullet, <code>```</code> for a code block,{' '}
            <code>---</code> for a divider.
          </p>
        </div>
      </fieldset>

      {/* Always rendered so the live region exists before a message lands in it. */}
      <div role='alert' aria-live='polite'>
        {error && (
          <p className='rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300'>
            {error}
          </p>
        )}
      </div>

      <div className='flex items-center gap-3'>
        <button
          type='submit'
          disabled={pending}
          className='rounded-md bg-slate-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:cursor-not-allowed disabled:opacity-60'
        >
          {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Save note'}
        </button>

        {!isEdit && (
          <Link
            href='/dashboard'
            className='rounded-md px-3 py-2.5 text-sm font-medium text-neutral-400 transition-colors hover:text-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400'
          >
            Cancel
          </Link>
        )}

        {/* Separate from the error region so a save cannot be announced as an alert. */}
        <span aria-live='polite' className='text-sm text-emerald-400'>
          {saved ? 'Saved' : ''}
        </span>
      </div>
    </form>
  );
}
