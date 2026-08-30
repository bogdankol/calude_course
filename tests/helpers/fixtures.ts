/**
 * Mock data for the data-layer suites.
 *
 * Timestamps are fixed strings in SQLite's own format (UTC, space separator) rather than
 * anything derived from the clock: `datetime('now')` has one-second resolution, so rows
 * written in the same tick would share an `updated_at` and ordering assertions would
 * depend on how fast the machine is.
 */

export const USERS = {
  alice: { id: 'usr_alice', email: 'alice@notes.test' },
  bob: { id: 'usr_bob', email: 'bob@notes.test' },
} as const;

/** A realistic TipTap document — headings and lists, not a hand-simplified stub. */
export const SHOPPING_DOC = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Groceries' }] },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Oat milk' }] }],
        },
      ],
    },
  ],
};

export const SHOPPING_JSON = JSON.stringify(SHOPPING_DOC);

export const PLAIN_JSON = JSON.stringify({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Just some text.' }] }],
});

export type SeedNote = {
  id: string;
  userId: string;
  title: string;
  contentJson: string;
  isPublic: boolean;
  publicSlug: string | null;
  createdAt: string;
  updatedAt: string;
};

function note(overrides: Partial<SeedNote> & Pick<SeedNote, 'id' | 'userId'>): SeedNote {
  return {
    title: 'A note',
    contentJson: PLAIN_JSON,
    isPublic: false,
    publicSlug: null,
    createdAt: '2026-01-01 09:00:00',
    updatedAt: '2026-01-01 09:00:00',
    ...overrides,
  };
}

/**
 * Alice owns five notes; the last two deliberately share an `updated_at` so the `id`
 * tie-break in `getNotesByUser` is actually exercised. Bob's two exist to prove ownership
 * scoping, and his second is the "slug present but sharing off" state that only a bug
 * could produce — `getNoteByPublicSlug` must still refuse it.
 */
export const SEED_NOTES = {
  aliceOldest: note({
    id: 'note_a1',
    userId: USERS.alice.id,
    title: 'Groceries',
    contentJson: SHOPPING_JSON,
    updatedAt: '2026-01-01 09:00:00',
  }),
  aliceShared: note({
    id: 'note_a2',
    userId: USERS.alice.id,
    title: 'Shared recipe',
    isPublic: true,
    publicSlug: 'aliceSharedSlug000001',
    updatedAt: '2026-02-01 09:00:00',
  }),
  aliceMiddle: note({
    id: 'note_a3',
    userId: USERS.alice.id,
    title: 'Reading list',
    updatedAt: '2026-03-01 09:00:00',
  }),
  aliceTieLowId: note({
    id: 'note_a4_aaa',
    userId: USERS.alice.id,
    title: 'Same second, lower id',
    updatedAt: '2026-04-01 09:00:00',
  }),
  aliceTieHighId: note({
    id: 'note_a5_zzz',
    userId: USERS.alice.id,
    title: 'Same second, higher id',
    updatedAt: '2026-04-01 09:00:00',
  }),
  bobPrivate: note({
    id: 'note_b1',
    userId: USERS.bob.id,
    title: "Bob's private note",
  }),
  bobRevoked: note({
    id: 'note_b2',
    userId: USERS.bob.id,
    title: 'Slug left behind, sharing off',
    isPublic: false,
    publicSlug: 'bobRevokedSlug000001',
  }),
} as const;

export const ALL_SEED_NOTES: readonly SeedNote[] = Object.values(SEED_NOTES);
