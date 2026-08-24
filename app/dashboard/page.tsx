import type { Metadata } from 'next';
import type { JSX } from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getNotesByUser } from '@/lib/notes';
import { Header } from '@/components/Header';
import { LogoutButton } from '@/components/LogoutButton';
import { NoteList } from '@/components/NoteList';

export const metadata: Metadata = {
  title: 'Dashboard · Notes',
};

export default async function DashboardPage(): Promise<JSX.Element> {
  // Gate lives in the route, not a layout: a layout is not re-rendered on every
  // navigation within its segment, so its session check can go stale. Doing it here
  // means every request for this page is checked against the real session.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  // Synchronous by design — better-sqlite3 has no async API, so there is nothing to await.
  const notes = getNotesByUser(session.user.id);

  return (
    <>
      <Header actions={<LogoutButton />} />

      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Your notes</h1>
            {/* `user.name` is always empty — sign-up collects email and password only. */}
            <p className="mt-1 text-sm text-neutral-400">
              {notes.length === 0
                ? `Signed in as ${session.user.email}.`
                : `${notes.length} ${notes.length === 1 ? 'note' : 'notes'} · ${session.user.email}`}
            </p>
          </div>

          <Link
            href="/notes/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-700 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
          >
            <span aria-hidden className="text-base leading-none">
              +
            </span>
            New Note
          </Link>
        </div>

        {notes.length === 0 ? (
          <div className="mt-10 rounded-lg border border-dashed border-white/10 px-6 py-12 text-center">
            <p className="text-sm text-neutral-400">You have no notes yet.</p>
            <Link
              href="/notes/new"
              className="mt-4 inline-block rounded-md border border-white/10 bg-white/5 px-3.5 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
            >
              Create your first note
            </Link>
          </div>
        ) : (
          <NoteList notes={notes} />
        )}
      </main>
    </>
  );
}
