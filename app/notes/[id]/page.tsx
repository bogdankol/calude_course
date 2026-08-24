import type { Metadata } from 'next';
import type { JSX } from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import type { JSONContent } from '@tiptap/core';
import { auth } from '@/lib/auth';
import { getNoteById } from '@/lib/notes';
import { EMPTY_DOC } from '@/lib/tiptap';
import { formatTimestamp } from '@/lib/format';
import { Header } from '@/components/Header';
import { LogoutButton } from '@/components/LogoutButton';
import { NoteForm } from '@/components/NoteForm';
import { DeleteNoteButton } from '@/components/DeleteNoteButton';

type NotePageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: NotePageProps): Promise<Metadata> {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { title: 'Note · NextNotes' };

  const note = getNoteById(session.user.id, id);
  return { title: note ? `${note.title} · NextNotes` : 'Note not found · NextNotes' };
}

export default async function NotePage({ params }: NotePageProps): Promise<JSX.Element> {
  // Next 16: dynamic `params` is a Promise.
  const { id } = await params;

  // This page had no gate at all and answered 200 to anonymous requests.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  // Ownership is enforced in the query, so someone else's note id is simply "not found".
  const note = getNoteById(session.user.id, id);
  if (!note) notFound();

  return (
    <>
      <Header actions={<LogoutButton />} />

      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-neutral-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
          >
            <span aria-hidden>←</span> Back
          </Link>

          <div className="flex items-center gap-3">
            <DeleteNoteButton noteId={note.id} noteTitle={note.title} />
          </div>
        </div>

        <article>
          <header>
            <h1 className="text-3xl font-semibold tracking-tight text-balance">
              {note.title}
            </h1>
            <p className="mt-2 text-xs text-neutral-500">
              Updated {formatTimestamp(note.updatedAt)}
              {note.isPublic && (
                <span className="ml-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
                  Public
                </span>
              )}
            </p>
          </header>

          {/*
            SPEC.MD §8.1 makes /notes/[id] the editor, so the body is the editable form.
            The h1 above still shows the stored title — `router.refresh()` after a save
            brings it back in sync.
          */}
          <NoteForm
            noteId={note.id}
            initialTitle={note.title}
            initialDoc={parseDoc(note.contentJson)}
          />
        </article>
      </main>
    </>
  );
}

/**
 * `content_json` is TEXT, so nothing at the database level guarantees it parses. A note
 * that somehow stored garbage should still render its title rather than crash the page.
 */
function parseDoc(contentJson: string): JSONContent {
  try {
    const parsed: unknown = JSON.parse(contentJson);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as { type?: unknown }).type === 'doc'
    ) {
      return parsed as JSONContent;
    }
  } catch {
    // fall through to the empty document
  }
  return EMPTY_DOC;
}
