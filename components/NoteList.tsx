import Link from 'next/link';
import type { JSX } from 'react';
import { formatTimestamp } from '@/lib/format';

/**
 * Only the fields the list renders, per SPEC.MD §8.3 — deliberately narrower than `Note`
 * so a full note (with its `contentJson`) is never required just to draw a row.
 */
export type NoteListItem = {
  id: string;
  title: string;
  updatedAt: string;
  isPublic: boolean;
};

/** Renders the notes as links to their viewing page. Assumes the caller sorted them. */
export function NoteList({ notes }: { notes: NoteListItem[] }): JSX.Element {
  return (
    <ul className='mt-6 flex flex-col gap-2'>
      {notes.map((note) => (
        <li key={note.id}>
          <Link
            href={`/notes/${note.id}`}
            className='flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 transition-colors hover:border-white/20 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400'
          >
            {/* min-w-0 lets the truncate below actually take effect inside the flex row. */}
            <span className='min-w-0'>
              <span className='block truncate font-medium text-neutral-100'>{note.title}</span>
              <span className='mt-0.5 block text-xs text-neutral-500'>
                Updated {formatTimestamp(note.updatedAt)}
              </span>
            </span>

            {note.isPublic && (
              <span className='shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300'>
                Public
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
