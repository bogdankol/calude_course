import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RedirectSignal, captureRedirect } from '../helpers/next-mocks.ts';
import { SEED_NOTES, SHOPPING_JSON, USERS } from '../helpers/fixtures.ts';

const mocks = vi.hoisted(async () => {
  const { RedirectSignal: Signal } = await import('../helpers/next-mocks.ts');
  return {
    getSession: vi.fn(),
    updateNote: vi.fn(),
    setNotePublic: vi.fn(),
    deleteNote: vi.fn(),
    revalidatePath: vi.fn(),
    redirect: vi.fn((url: string): never => {
      throw new Signal(url);
    }),
  };
});

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock('next/navigation', async () => ({ redirect: (await mocks).redirect }));
vi.mock('next/cache', async () => ({ revalidatePath: (await mocks).revalidatePath }));
vi.mock('@/lib/auth', async () => ({ auth: { api: { getSession: (await mocks).getSession } } }));
vi.mock('@/lib/notes', async () => {
  const resolved = await mocks;
  return {
    updateNote: resolved.updateNote,
    setNotePublic: resolved.setNotePublic,
    deleteNote: resolved.deleteNote,
  };
});

const { updateNoteAction, setNoteSharingAction, deleteNoteAction } =
  await import('@/app/notes/[id]/actions');
const { getSession, updateNote, setNotePublic, deleteNote, revalidatePath, redirect } = await mocks;

const SESSION = { user: { id: USERS.alice.id, email: USERS.alice.email } };
const NOTE_ID = SEED_NOTES.aliceOldest.id;

const STORED_NOTE = {
  id: NOTE_ID,
  userId: USERS.alice.id,
  title: 'Groceries',
  contentJson: SHOPPING_JSON,
  isPublic: false,
  publicSlug: null as string | null,
  createdAt: '2026-01-01 09:00:00',
  updatedAt: '2026-08-30 12:00:00',
};

function noteForm(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

const VALID_FORM = () => noteForm({ title: 'Groceries', contentJson: SHOPPING_JSON });

/** Silences the action's operator logging and lets a test assert what was logged. */
function captureConsoleError() {
  return vi.spyOn(console, 'error').mockImplementation(() => {});
}

beforeEach(() => {
  vi.clearAllMocks();
  redirect.mockImplementation((url: string): never => {
    throw new RedirectSignal(url);
  });
  getSession.mockResolvedValue(SESSION);
  updateNote.mockReturnValue(STORED_NOTE);
  setNotePublic.mockReturnValue(STORED_NOTE);
  deleteNote.mockReturnValue(true);
});

describe('updateNoteAction', () => {
  it('sends an anonymous caller to the authenticate page', async () => {
    getSession.mockResolvedValue(null);

    await expect(captureRedirect(() => updateNoteAction(NOTE_ID, VALID_FORM()))).resolves.toBe(
      '/authenticate',
    );
  });

  it('writes nothing for an anonymous caller', async () => {
    getSession.mockResolvedValue(null);

    await captureRedirect(() => updateNoteAction(NOTE_ID, VALID_FORM()));

    expect(updateNote).not.toHaveBeenCalled();
  });

  it('rejects an empty title before touching the database', async () => {
    const result = await updateNoteAction(
      NOTE_ID,
      noteForm({ title: '  ', contentJson: SHOPPING_JSON }),
    );

    expect(result).toEqual({ error: 'Give your note a title.' });
    expect(updateNote).not.toHaveBeenCalled();
  });

  it('saves under the signed-in user rather than any id in the form', async () => {
    const formData = VALID_FORM();
    formData.set('userId', USERS.bob.id);

    await updateNoteAction(NOTE_ID, formData);

    expect(updateNote).toHaveBeenCalledWith(USERS.alice.id, NOTE_ID, {
      title: 'Groceries',
      contentJson: SHOPPING_JSON,
    });
  });

  it('reports success with no error', async () => {
    await expect(updateNoteAction(NOTE_ID, VALID_FORM())).resolves.toEqual({ error: null });
  });

  it('stays on the page instead of redirecting', async () => {
    // Unlike create: the user is already looking at the note and keeps typing.
    await updateNoteAction(NOTE_ID, VALID_FORM());

    expect(redirect).not.toHaveBeenCalled();
  });

  it('revalidates the dashboard and the note page', async () => {
    await updateNoteAction(NOTE_ID, VALID_FORM());

    expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
    expect(revalidatePath).toHaveBeenCalledWith('/notes/' + NOTE_ID);
  });

  it('reports a missing note when the update matched nothing', async () => {
    // `updateNote` scopes by user_id, so this is also what a foreign note id produces.
    updateNote.mockReturnValue(null);

    await expect(updateNoteAction(NOTE_ID, VALID_FORM())).resolves.toEqual({
      error: 'That note no longer exists.',
    });
  });

  it('does not revalidate when the update matched nothing', async () => {
    updateNote.mockReturnValue(null);

    await updateNoteAction(NOTE_ID, VALID_FORM());

    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('reports a retryable message when the write throws', async () => {
    const logged = captureConsoleError();
    updateNote.mockImplementation(() => {
      throw new Error('SQLITE_BUSY: database is locked');
    });

    const result = await updateNoteAction(NOTE_ID, VALID_FORM());

    expect(result).toEqual({ error: 'Could not save your changes. Please try again.' });
    expect(logged).toHaveBeenCalledWith('updateNoteAction: update failed', expect.any(Error));
    logged.mockRestore();
  });
});

describe('setNoteSharingAction', () => {
  it('sends an anonymous caller to the authenticate page', async () => {
    getSession.mockResolvedValue(null);

    await expect(captureRedirect(() => setNoteSharingAction(NOTE_ID, true))).resolves.toBe(
      '/authenticate',
    );
  });

  it('changes nothing for an anonymous caller', async () => {
    getSession.mockResolvedValue(null);

    await captureRedirect(() => setNoteSharingAction(NOTE_ID, true));

    expect(setNotePublic).not.toHaveBeenCalled();
  });

  it('flips sharing for the signed-in user’s note', async () => {
    await setNoteSharingAction(NOTE_ID, true);

    expect(setNotePublic).toHaveBeenCalledWith(USERS.alice.id, NOTE_ID, true);
  });

  it('returns the slug the database minted', async () => {
    setNotePublic.mockReturnValue({
      ...STORED_NOTE,
      isPublic: true,
      publicSlug: 'aliceSharedSlug000001',
    });

    await expect(setNoteSharingAction(NOTE_ID, true)).resolves.toEqual({
      ok: true,
      isPublic: true,
      publicSlug: 'aliceSharedSlug000001',
    });
  });

  it('reports what was stored, not what the click asked for', async () => {
    // The switch has to show the database's state; assuming the request succeeded would
    // leave it lying after a concurrent change.
    setNotePublic.mockReturnValue({ ...STORED_NOTE, isPublic: false, publicSlug: null });

    await expect(setNoteSharingAction(NOTE_ID, true)).resolves.toEqual({
      ok: true,
      isPublic: false,
      publicSlug: null,
    });
  });

  it('revalidates the public route pattern as well as the private pages', async () => {
    await setNoteSharingAction(NOTE_ID, true);

    expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
    expect(revalidatePath).toHaveBeenCalledWith('/notes/' + NOTE_ID);
    // The pattern, not a concrete slug: on unshare the slug is already gone.
    expect(revalidatePath).toHaveBeenCalledWith('/p/[slug]', 'page');
  });

  it('reports a missing note when the update matched nothing', async () => {
    setNotePublic.mockReturnValue(null);

    await expect(setNoteSharingAction(NOTE_ID, true)).resolves.toEqual({
      ok: false,
      error: 'That note no longer exists.',
    });
  });

  it('reports a retryable message when the write throws', async () => {
    const logged = captureConsoleError();
    setNotePublic.mockImplementation(() => {
      throw new Error('SQLITE_BUSY: database is locked');
    });

    const result = await setNoteSharingAction(NOTE_ID, true);

    expect(result).toEqual({ ok: false, error: 'Could not change sharing. Please try again.' });
    expect(logged).toHaveBeenCalledWith('setNoteSharingAction: update failed', expect.any(Error));
    logged.mockRestore();
  });
});

describe('deleteNoteAction', () => {
  it('sends an anonymous caller to the authenticate page', async () => {
    getSession.mockResolvedValue(null);

    await expect(captureRedirect(() => deleteNoteAction(NOTE_ID))).resolves.toBe('/authenticate');
  });

  it('deletes nothing for an anonymous caller', async () => {
    getSession.mockResolvedValue(null);

    await captureRedirect(() => deleteNoteAction(NOTE_ID));

    expect(deleteNote).not.toHaveBeenCalled();
  });

  it('refuses an empty note id without touching the database', async () => {
    await expect(deleteNoteAction('')).resolves.toEqual({
      error: 'That note could not be deleted.',
    });
    expect(deleteNote).not.toHaveBeenCalled();
  });

  it('deletes scoped to the signed-in user', async () => {
    await captureRedirect(() => deleteNoteAction(NOTE_ID));

    expect(deleteNote).toHaveBeenCalledWith(USERS.alice.id, NOTE_ID);
  });

  it('returns the user to the dashboard', async () => {
    await expect(captureRedirect(() => deleteNoteAction(NOTE_ID))).resolves.toBe('/dashboard');
  });

  it('revalidates the dashboard so the deleted note disappears from the list', async () => {
    await captureRedirect(() => deleteNoteAction(NOTE_ID));

    expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
  });

  it('reports a missing note when nothing was deleted', async () => {
    // Also the foreign-note case: `deleteNote` is scoped by user_id and simply matches
    // no rows rather than erroring.
    deleteNote.mockReturnValue(false);

    await expect(deleteNoteAction(NOTE_ID)).resolves.toEqual({
      error: 'That note no longer exists.',
    });
  });

  it('does not navigate when nothing was deleted', async () => {
    deleteNote.mockReturnValue(false);

    await deleteNoteAction(NOTE_ID);

    expect(redirect).not.toHaveBeenCalled();
  });

  it('reports a retryable message when the delete throws', async () => {
    const logged = captureConsoleError();
    deleteNote.mockImplementation(() => {
      throw new Error('SQLITE_BUSY: database is locked');
    });

    const result = await deleteNoteAction(NOTE_ID);

    expect(result).toEqual({ error: 'Could not delete the note. Please try again.' });
    expect(logged).toHaveBeenCalledWith('deleteNoteAction: delete failed', expect.any(Error));
    logged.mockRestore();
  });
});
