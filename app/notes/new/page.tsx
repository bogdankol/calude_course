import type { Metadata } from 'next';
import type { JSX } from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Header } from '@/components/Header';
import { LogoutButton } from '@/components/LogoutButton';
import { NoteForm } from '@/components/NoteForm';

export const metadata: Metadata = {
  title: 'New note · NextNotes',
};

/**
 * `/notes/new` sits alongside the `/notes/[id]` dynamic segment. Next resolves static
 * segments first, so "new" is never mistaken for a note id.
 */
export default async function NewNotePage(): Promise<JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  return (
    <>
      <Header actions={<LogoutButton />} />

      <main className='mx-auto w-full max-w-3xl px-6 py-10'>
        <nav className='mb-6'>
          <Link
            href='/dashboard'
            className='-mx-1.5 rounded px-1.5 py-1 text-sm text-neutral-400 transition-colors hover:text-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400'
          >
            ← Back to notes
          </Link>
        </nav>

        <h1 className='text-2xl font-semibold tracking-tight'>New note</h1>
        <p className='mt-1 text-sm text-neutral-400'>Give it a title, write something, and save.</p>

        <NoteForm />
      </main>
    </>
  );
}
