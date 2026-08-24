"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createNote } from "@/lib/notes";

const MAX_TITLE_LENGTH = 200;

/** What the form renders back on a rejected submit. `null` means "nothing wrong yet". */
export type NewNoteState = { error: string | null };

const NewNoteSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give your note a title.")
    .max(MAX_TITLE_LENGTH, `Title must be ${MAX_TITLE_LENGTH} characters or fewer.`),
  // The editor posts a serialised TipTap document through a hidden field. Anything
  // reaching the database as `content_json` has to survive `JSON.parse` on the way back
  // out, so it is validated here rather than trusted.
  contentJson: z
    .string()
    .min(1, "The editor did not send any content.")
    .refine(isTipTapDoc, "The editor content was not in the expected format."),
});

function isTipTapDoc(value: string): boolean {
  try {
    const parsed: unknown = JSON.parse(value);
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as { type?: unknown }).type === "doc"
    );
  } catch {
    return false;
  }
}

/**
 * Creates a note for the signed-in user, then sends them to its editor.
 *
 * Called straight from the form's `onSubmit`, not through `useActionState`, so it takes
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
  if (!session) redirect("/authenticate");

  const parsed = NewNoteSchema.safeParse({
    title: formData.get("title"),
    contentJson: formData.get("contentJson"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "That note could not be saved." };
  }

  let noteId: string;
  try {
    noteId = createNote(session.user.id, parsed.data).id;
  } catch (cause) {
    console.error("createNoteAction: insert failed", cause);
    return { error: "Could not save the note. Please try again." };
  }

  // So the dashboard's list picks the note up instead of serving a cached payload.
  revalidatePath("/dashboard");
  redirect(`/notes/${noteId}`);
}
