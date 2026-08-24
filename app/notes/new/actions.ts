'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { createNote } from '@/lib/notes';
import { parseNoteInput } from '@/lib/note-schema';

/** `error` is null only on paths that do not return at all (the redirect below). */
export type NewNoteState = { error: string | null };

/**
 * Creates a note for the signed-in user, then sends them to its editor.
 *
 * Called straight from the form onSubmit, not through `useActionState`, so it takes
 * `FormData` alone. On success it never returns — `redirect` navigates instead.
 *
 * Both `redirect` calls sit outside any `try`: `redirect` signals by throwing an internal
 * `NEXT_REDIRECT`, and a `catch` around it would swallow the navigation and report the
 * successful save as a failure.
 */
export async function createNoteAction(formData: FormData): Promise<NewNoteState> {
  // Re-checked here rather than inherited from the page: a Server Action is its own
  // endpoint and is reachable without ever rendering that page.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const parsed = parseNoteInput(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'That note could not be saved.' };
  }

  let noteId: string;
  try {
    noteId = createNote(session.user.id, parsed.data).id;
  } catch (cause) {
    console.error('createNoteAction: insert failed', cause);
    return { error: 'Could not save the note. Please try again.' };
  }

  // So the dashboard list picks the note up instead of serving a cached payload.
  revalidatePath('/dashboard');
  redirect('/notes/' + noteId);
}
