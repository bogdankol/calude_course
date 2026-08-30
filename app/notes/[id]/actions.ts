'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import { deleteNote, setNotePublic, updateNote } from '@/lib/notes';
import { parseNoteInput } from '@/lib/note-schema';

/** `error` is null on a successful save; the delete action redirects instead. */
export type NoteActionState = { error: string | null };

/**
 * Saves edits to one of the caller's notes and stays on the page.
 *
 * Unlike create, this does NOT redirect: the user is already looking at the note, so the
 * form just reports success and lets them keep typing.
 *
 * The session is re-checked here rather than inherited from the page — a Server Action is
 * its own endpoint. `updateNote` also scopes by `user_id`, so a foreign note id updates
 * nothing and comes back null.
 */
export async function updateNoteAction(
  noteId: string,
  formData: FormData,
): Promise<NoteActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const parsed = parseNoteInput(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Those changes could not be saved.' };
  }

  let updated;
  try {
    updated = updateNote(session.user.id, noteId, parsed.data);
  } catch (cause) {
    console.error('updateNoteAction: update failed', cause);
    return { error: 'Could not save your changes. Please try again.' };
  }

  if (!updated) return { error: 'That note no longer exists.' };

  // The dashboard shows title + updated_at, and this page shows the timestamp.
  revalidatePath('/dashboard');
  revalidatePath('/notes/' + noteId);
  return { error: null };
}

/**
 * Result of a sharing toggle. On success it reports the stored state back, so the switch
 * reflects what the database actually holds rather than what the client assumed.
 */
export type ShareResult =
  | { ok: false; error: string }
  | { ok: true; isPublic: boolean; publicSlug: string | null };

/**
 * Turns public sharing on or off for one of the caller's notes.
 *
 * Session re-checked here as always — an action is its own endpoint — and `setNotePublic`
 * scopes by `user_id`, so a foreign note id changes nothing and comes back null.
 */
export async function setNoteSharingAction(
  noteId: string,
  isPublic: boolean,
): Promise<ShareResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  let note;
  try {
    note = setNotePublic(session.user.id, noteId, isPublic);
  } catch (cause) {
    console.error('setNoteSharingAction: update failed', cause);
    return { ok: false, error: 'Could not change sharing. Please try again.' };
  }

  if (!note) return { ok: false, error: 'That note no longer exists.' };

  revalidatePath('/dashboard');
  revalidatePath('/notes/' + noteId);
  // The route pattern, not a concrete slug: on unshare the slug is already gone, so there
  // is no specific path left to invalidate.
  revalidatePath('/p/[slug]', 'page');

  return { ok: true, isPublic: note.isPublic, publicSlug: note.publicSlug };
}

/**
 * Deletes one of the caller's notes, then returns them to the dashboard.
 *
 * Both `redirect` calls sit outside any `try` — `redirect` signals by throwing
 * `NEXT_REDIRECT`, and a `catch` around it would swallow the navigation.
 */
export async function deleteNoteAction(noteId: string): Promise<NoteActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  if (!noteId) return { error: 'That note could not be deleted.' };

  let deleted: boolean;
  try {
    deleted = deleteNote(session.user.id, noteId);
  } catch (cause) {
    console.error('deleteNoteAction: delete failed', cause);
    return { error: 'Could not delete the note. Please try again.' };
  }

  if (!deleted) return { error: 'That note no longer exists.' };

  revalidatePath('/dashboard');
  redirect('/dashboard');
}
