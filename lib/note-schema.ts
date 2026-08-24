import { z } from 'zod';

/**
 * Server-side validation for note input, shared by the create and update actions so the
 * two cannot drift apart.
 *
 * This module pulls in zod, so it is imported by Server Actions only — a client component
 * that needs the title limit keeps its own constant instead of importing this.
 */
export const MAX_TITLE_LENGTH = 200;

/**
 * The document has to survive `JSON.parse` on the way back out of `content_json`, so it is
 * validated rather than trusted. Only the top-level shape is checked: TipTap parses the
 * rest against the schema in `lib/tiptap.ts`.
 */
function isTipTapDoc(value: string): boolean {
  try {
    const parsed: unknown = JSON.parse(value);
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as { type?: unknown }).type === 'doc'
    );
  } catch {
    return false;
  }
}

export const NoteInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Give your note a title.')
    .max(MAX_TITLE_LENGTH, 'Title must be ' + MAX_TITLE_LENGTH + ' characters or fewer.'),
  contentJson: z
    .string()
    .min(1, 'The editor did not send any content.')
    .refine(isTipTapDoc, 'The editor content was not in the expected format.'),
});

export type NoteInput = z.infer<typeof NoteInputSchema>;

/** Pulls the two note fields out of a submitted form and validates them. */
export function parseNoteInput(formData: FormData) {
  return NoteInputSchema.safeParse({
    title: formData.get('title'),
    contentJson: formData.get('contentJson'),
  });
}
