import { z } from 'zod';
import { isNoteDocJson } from './note-doc.ts';

/**
 * Server-side validation for note input, shared by the create and update actions so the
 * two cannot drift apart.
 *
 * This module pulls in zod, so it is imported by Server Actions only — a client component
 * that needs the title limit keeps its own constant instead of importing this.
 */
export const MAX_TITLE_LENGTH = 200;

export const NoteInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Give your note a title.')
    .max(MAX_TITLE_LENGTH, 'Title must be ' + MAX_TITLE_LENGTH + ' characters or fewer.'),
  // The document has to survive `JSON.parse` on the way back out of `content_json`, so it
  // is validated rather than trusted. `isNoteDocJson` checks the top level only; TipTap
  // parses the rest against the schema in `lib/tiptap.ts`.
  contentJson: z
    .string()
    .min(1, 'The editor did not send any content.')
    .refine(isNoteDocJson, 'The editor content was not in the expected format.'),
});

export type NoteInput = z.infer<typeof NoteInputSchema>;

/** Pulls the two note fields out of a submitted form and validates them. */
export function parseNoteInput(formData: FormData) {
  return NoteInputSchema.safeParse({
    title: formData.get('title'),
    contentJson: formData.get('contentJson'),
  });
}
