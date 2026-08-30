import type { Metadata } from 'next';
import type { JSX } from 'react';
import { notFound } from 'next/navigation';
import { getNoteByPublicSlug } from '@/lib/notes';
import { parseNoteDoc } from '@/lib/note-doc';
import { formatTimestamp } from '@/lib/format';
import { NoteContent } from '@/components/NoteContent';

type PublicNoteProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PublicNoteProps): Promise<Metadata> {
  const { slug } = await params;
  const note = getNoteByPublicSlug(slug);

  return {
    title: { absolute: note ? note.title : 'Note not found' },
    // Shared-by-link notes rely on an unguessable slug (SPEC.MD §11). Letting a crawler
    // index the page would defeat exactly that, so keep it out of search results.
    robots: { index: false, follow: false },
  };
}

/**
 * Public, read-only view of a shared note — SPEC.MD §3.3 and §8.1.
 *
 * Deliberately renders **no `Header`** and nothing about the owner: §8.1 wants no route
 * into user-specific areas for anonymous viewers, and §3.3 says owner information is not
 * needed here.
 *
 * `getNoteByPublicSlug` filters on `is_public = 1`, so unsharing a note makes this 404
 * even for someone holding the old link.
 *
 * The body goes through `NoteContent`, a schema-constrained TipTap renderer. That matters
 * more here than anywhere else in the app: this is untrusted stored content being served
 * to anonymous visitors, and the schema is the only thing that can emit markup — there is
 * no `dangerouslySetInnerHTML` anywhere in this path.
 */
export default async function PublicNotePage({ params }: PublicNoteProps): Promise<JSX.Element> {
  const { slug } = await params;

  const note = getNoteByPublicSlug(slug);
  if (!note) notFound();

  return (
    <main className='mx-auto w-full max-w-3xl px-6 py-12'>
      <article>
        <header className='border-b border-white/10 pb-6'>
          <h1 className='text-3xl font-semibold tracking-tight text-balance'>{note.title}</h1>
          <p className='mt-2 text-xs text-neutral-500'>
            Shared note · updated {formatTimestamp(note.updatedAt)}
          </p>
        </header>

        <div className='mt-6'>
          <NoteContent doc={parseNoteDoc(note.contentJson)} />
        </div>
      </article>
    </main>
  );
}
