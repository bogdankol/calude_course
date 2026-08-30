import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RedirectSignal, captureRedirect } from '../helpers/next-mocks.ts';
import { SHOPPING_JSON, USERS } from '../helpers/fixtures.ts';

const mocks = vi.hoisted(async () => {
  const { RedirectSignal: Signal } = await import('../helpers/next-mocks.ts');
  return {
    getSession: vi.fn(),
    createNote: vi.fn(),
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
vi.mock('@/lib/notes', async () => ({ createNote: (await mocks).createNote }));

const { createNoteAction } = await import('@/app/notes/new/actions');
const { getSession, createNote, revalidatePath, redirect } = await mocks;

const SESSION = { user: { id: USERS.alice.id, email: USERS.alice.email } };

const CREATED_NOTE = {
  id: 'note_created',
  userId: USERS.alice.id,
  title: 'Groceries',
  contentJson: SHOPPING_JSON,
  isPublic: false,
  publicSlug: null,
  createdAt: '2026-08-30 12:00:00',
  updatedAt: '2026-08-30 12:00:00',
};

function noteForm(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

const VALID_FORM = () => noteForm({ title: 'Groceries', contentJson: SHOPPING_JSON });

beforeEach(() => {
  vi.clearAllMocks();
  redirect.mockImplementation((url: string): never => {
    throw new RedirectSignal(url);
  });
  getSession.mockResolvedValue(SESSION);
  createNote.mockReturnValue(CREATED_NOTE);
});

describe('createNoteAction — signed out', () => {
  beforeEach(() => {
    getSession.mockResolvedValue(null);
  });

  it('sends an anonymous caller to the authenticate page', async () => {
    // A Server Action is its own endpoint: it is POST-able without the page that renders
    // the form ever being requested, so the gate has to live here too.
    await expect(captureRedirect(() => createNoteAction(VALID_FORM()))).resolves.toBe(
      '/authenticate',
    );
  });

  it('writes nothing for an anonymous caller', async () => {
    await captureRedirect(() => createNoteAction(VALID_FORM()));

    expect(createNote).not.toHaveBeenCalled();
  });
});

describe('createNoteAction — invalid input', () => {
  it('rejects a whitespace-only title with the schema’s message', async () => {
    const result = await createNoteAction(noteForm({ title: '   ', contentJson: SHOPPING_JSON }));

    expect(result).toEqual({ error: 'Give your note a title.' });
  });

  it('stores nothing when the title is rejected', async () => {
    await createNoteAction(noteForm({ title: '   ', contentJson: SHOPPING_JSON }));

    expect(createNote).not.toHaveBeenCalled();
  });

  it('rejects content that is not a TipTap document', async () => {
    const result = await createNoteAction(
      noteForm({ title: 'Groceries', contentJson: 'not json at all' }),
    );

    expect(result).toEqual({ error: 'The editor content was not in the expected format.' });
  });
});

describe('createNoteAction — success', () => {
  it('creates the note under the signed-in user', async () => {
    await captureRedirect(() => createNoteAction(VALID_FORM()));

    expect(createNote).toHaveBeenCalledWith(USERS.alice.id, {
      title: 'Groceries',
      contentJson: SHOPPING_JSON,
    });
  });

  it('ignores a user id supplied by the caller', async () => {
    // The form is attacker-controlled; only the session decides who owns the note.
    const formData = VALID_FORM();
    formData.set('userId', USERS.bob.id);

    await captureRedirect(() => createNoteAction(formData));

    expect(createNote).toHaveBeenCalledWith(USERS.alice.id, expect.anything());
  });

  it('stores the trimmed title rather than what was typed', async () => {
    await captureRedirect(() =>
      createNoteAction(noteForm({ title: '  Groceries  ', contentJson: SHOPPING_JSON })),
    );

    expect(createNote).toHaveBeenCalledWith(
      USERS.alice.id,
      expect.objectContaining({
        title: 'Groceries',
      }),
    );
  });

  it('revalidates the dashboard so the list picks the note up', async () => {
    await captureRedirect(() => createNoteAction(VALID_FORM()));

    expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
  });

  it('sends the user to the new note’s editor', async () => {
    await expect(captureRedirect(() => createNoteAction(VALID_FORM()))).resolves.toBe(
      '/notes/note_created',
    );
  });
});

describe('createNoteAction — the insert fails', () => {
  beforeEach(() => {
    createNote.mockImplementation(() => {
      throw new Error('SQLITE_BUSY: database is locked');
    });
  });

  it('reports a message the user can act on', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(createNoteAction(VALID_FORM())).resolves.toEqual({
      error: 'Could not save the note. Please try again.',
    });

    logged.mockRestore();
  });

  it('does not leak the database error to the user', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await createNoteAction(VALID_FORM());

    expect(result.error).not.toMatch(/SQLITE|locked/i);
    logged.mockRestore();
  });

  it('does not navigate away from the form', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    await createNoteAction(VALID_FORM());

    expect(redirect).not.toHaveBeenCalled();
    logged.mockRestore();
  });

  it('logs the underlying cause for the server operator', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    await createNoteAction(VALID_FORM());

    expect(logged).toHaveBeenCalledWith('createNoteAction: insert failed', expect.any(Error));
    logged.mockRestore();
  });
});
