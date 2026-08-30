import type { Metadata } from 'next';
import type { JSX } from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getNoteById } from '@/lib/notes';
import { parseNoteDoc } from '@/lib/note-doc';
import { resolveAppOrigin } from '@/lib/share-url';
import { formatTimestamp } from '@/lib/format';
import { Header } from '@/components/Header';
import { LogoutButton } from '@/components/LogoutButton';
import { NoteForm } from '@/components/NoteForm';
import { DeleteNoteButton } from '@/components/DeleteNoteButton';
import { ShareToggle } from '@/components/ShareToggle';

type NotePageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: NotePageProps): Promise<Metadata> {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { title: 'Note' };

  const note = getNoteById(session.user.id, id);
  return { title: note ? note.title : 'Note not found' };
}

export default async function NotePage({ params }: NotePageProps): Promise<JSX.Element> {
  // Next 16: dynamic `params` is a Promise.
  const { id } = await params;

  // This page had no gate at all and answered 200 to anonymous requests.
  const headerList = await headers();
  const session = await auth.api.getSession({ headers: headerList });
  if (!session) redirect('/authenticate');

  // The share link has to be absolute for copy-paste to be useful.
  const origin = resolveAppOrigin(process.env.BETTER_AUTH_URL, headerList.get('host'));

  // Ownership is enforced in the query, so someone else's note id is simply "not found".
  const note = getNoteById(session.user.id, id);
  if (!note) notFound();

  return (
    <>
      <Header actions={<LogoutButton />} />

      <main className='mx-auto w-full max-w-3xl px-6 py-10'>
        <div className='mb-6 flex flex-wrap items-center justify-between gap-3'>
          <Link
            href='/dashboard'
            className='inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-neutral-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400'
          >
            <span aria-hidden>←</span> Back
          </Link>

          <div className='flex items-center gap-3'>
            <DeleteNoteButton noteId={note.id} noteTitle={note.title} />
          </div>
        </div>

        <article>
          <header>
            <h1 className='text-3xl font-semibold tracking-tight text-balance'>{note.title}</h1>
            <p className='mt-2 text-xs text-neutral-500'>
              Updated {formatTimestamp(note.updatedAt)}
              {note.isPublic && (
                <span className='ml-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-300'>
                  Public
                </span>
              )}
            </p>
          </header>

          <div className='mt-6'>
            <ShareToggle
              noteId={note.id}
              initialIsPublic={note.isPublic}
              initialSlug={note.publicSlug}
              origin={origin}
            />
          </div>

          {/*
            SPEC.MD §8.1 makes /notes/[id] the editor, so the body is the editable form.
            The h1 above still shows the stored title — `router.refresh()` after a save
            brings it back in sync.
          */}
          <NoteForm
            noteId={note.id}
            initialTitle={note.title}
            initialDoc={parseNoteDoc(note.contentJson)}
          />
        </article>
      </main>
    </>
  );
}
