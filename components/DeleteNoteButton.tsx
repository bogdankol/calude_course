'use client';

import { useRef, useState, useTransition, type JSX } from 'react';
import { deleteNoteAction } from '@/app/notes/[id]/actions';

/**
 * Deleting a note is irreversible (SPEC.MD §3.2 calls for a hard delete), so it goes
 * through a confirmation step.
 *
 * The confirmation is a native `<dialog>` opened with `showModal()`: that gives a focus
 * trap, Esc-to-dismiss, and inert background content for free, none of which a
 * hand-rolled overlay would have without a lot more code.
 */
export function DeleteNoteButton({
  noteId,
  noteTitle,
}: {
  noteId: string;
  noteTitle: string;
}): JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleOpen(): void {
    setError(null);
    dialogRef.current?.showModal();
  }

  function handleCancel(): void {
    dialogRef.current?.close();
  }

  function handleConfirm(): void {
    startTransition(async () => {
      const result = await deleteNoteAction(noteId);

      // Only reached when the delete was refused — success redirects to the dashboard and
      // never returns, so there is no success branch to write here.
      if (result?.error) {
        setError(result.error);
        dialogRef.current?.close();
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-300 transition-colors hover:border-red-500/50 hover:bg-red-500/20 hover:text-red-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400"
      >
        Delete
      </button>

      {/* Announced outside the dialog, since the dialog is closed before this is set. */}
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby="delete-note-heading"
        className="max-w-sm rounded-xl border border-white/10 bg-neutral-900 p-6 text-neutral-100 shadow-2xl backdrop:bg-black/60 open:m-auto"
      >
        <h2 id="delete-note-heading" className="text-base font-semibold">
          Delete this note?
        </h2>

        <p className="mt-2 text-sm text-neutral-400">
          <span className="font-medium text-neutral-200">{noteTitle}</span> will be
          permanently deleted. This cannot be undone.
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={pending}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-neutral-300 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={pending}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Deleting…' : 'Delete note'}
          </button>
        </div>
      </dialog>
    </>
  );
}
