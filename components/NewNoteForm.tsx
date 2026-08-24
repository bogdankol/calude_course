"use client";

import { useCallback, useRef, useState, type FormEvent, type JSX } from "react";
import Link from "next/link";
import type { JSONContent } from "@tiptap/react";
import { NoteEditor } from "@/components/NoteEditor";
import { createNoteAction } from "@/app/notes/new/actions";

/** What TipTap reports for an untouched document. */
const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

const CONTENT_LABEL_ID = "note-content-label";
const MAX_TITLE_LENGTH = 200;

export function NewNoteForm(): JSX.Element {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A ref, not state: the editor reports every keystroke, and none of it changes what
  // this component renders. Holding it in state would re-render the form per character.
  const docRef = useRef<JSONContent>(EMPTY_DOC);

  // Stable identity so the editor isn't handed a fresh callback on every render.
  const handleEditorChange = useCallback((doc: JSONContent) => {
    docRef.current = doc;
  }, []);

  /**
   * A plain `onSubmit` rather than `<form action={createNoteAction}>`, for two reasons:
   * the editor is a contenteditable and contributes nothing to `FormData` on its own, so
   * the document has to be attached by hand; and React 19 wraps action dispatches in
   * `requestFormReset`, which would blank the title the user typed whenever the action
   * comes back with a validation error. Same approach as `AuthForm.tsx`.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (pending) return;

    const formData = new FormData(event.currentTarget);
    formData.set("contentJson", JSON.stringify(docRef.current));

    setPending(true);
    setError(null);

    const result = await createNoteAction(formData);

    // Only reached when the note was rejected — a successful save redirects to the note
    // and never returns. `pending` deliberately stays true while that navigation runs,
    // so the form can't be submitted twice.
    if (result?.error) {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
      <fieldset disabled={pending} className="flex min-w-0 flex-col gap-6">
        <legend className="sr-only">Note</legend>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="title" className="text-sm font-medium text-neutral-300">
            Title
          </label>
          <input
            id="title"
            name="title"
            required
            maxLength={MAX_TITLE_LENGTH}
            autoComplete="off"
            placeholder="Untitled note"
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2.5 text-base text-neutral-100 transition-colors placeholder:text-neutral-600 focus-visible:border-slate-400 focus-visible:outline-2 focus-visible:outline-slate-400 disabled:opacity-60"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span id={CONTENT_LABEL_ID} className="text-sm font-medium text-neutral-300">
            Content
          </span>
          <NoteEditor
            onChange={handleEditorChange}
            labelledBy={CONTENT_LABEL_ID}
            disabled={pending}
          />
          <p className="text-xs text-neutral-500">
            Rich text — use the toolbar, or markdown shortcuts like <code>##</code>,{" "}
            <code>-</code> and <code>&gt;</code> as you type.
          </p>
        </div>
      </fieldset>

      {/* Always rendered so the live region exists before a message lands in it. */}
      <div role="alert" aria-live="polite">
        {error && (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save note"}
        </button>

        <Link
          href="/dashboard"
          className="rounded-md px-3 py-2.5 text-sm font-medium text-neutral-400 transition-colors hover:text-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
