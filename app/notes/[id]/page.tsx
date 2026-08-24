import type { Metadata } from "next";
import type { JSX } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { JSONContent } from "@tiptap/core";
import { auth } from "@/lib/auth";
import { getNoteById } from "@/lib/notes";
import { Header } from "@/components/Header";
import { LogoutButton } from "@/components/LogoutButton";
import { NoteContent } from "@/components/NoteContent";

const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

type NotePageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: NotePageProps): Promise<Metadata> {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { title: "Note · NextNotes" };

  const note = getNoteById(session.user.id, id);
  return { title: note ? `${note.title} · NextNotes` : "Note not found · NextNotes" };
}

export default async function NotePage({ params }: NotePageProps): Promise<JSX.Element> {
  // Next 16: dynamic `params` is a Promise.
  const { id } = await params;

  // This page had no gate at all and answered 200 to anonymous requests.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/authenticate");

  // Ownership is enforced in the query, so someone else's note id is simply "not found".
  const note = getNoteById(session.user.id, id);
  if (!note) notFound();

  return (
    <>
      <Header actions={<LogoutButton />} />

      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <nav className="mb-6">
          <Link
            href="/dashboard"
            className="-mx-1.5 rounded px-1.5 py-1 text-sm text-neutral-400 transition-colors hover:text-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
          >
            ← Back to notes
          </Link>
        </nav>

        <article>
          <header>
            <h1 className="text-3xl font-semibold tracking-tight text-balance">
              {note.title}
            </h1>
            <p className="mt-2 text-xs text-neutral-500">
              Updated {formatTimestamp(note.updatedAt)}
              {note.isPublic && (
                <span className="ml-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-300">
                  Public
                </span>
              )}
            </p>
          </header>

          <div className="mt-8 border-t border-white/10 pt-6">
            <NoteContent doc={parseDoc(note.contentJson)} />
          </div>
        </article>
      </main>
    </>
  );
}

/**
 * `content_json` is TEXT, so nothing at the database level guarantees it parses. A note
 * that somehow stored garbage should still render its title rather than crash the page.
 */
function parseDoc(contentJson: string): JSONContent {
  try {
    const parsed: unknown = JSON.parse(contentJson);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as { type?: unknown }).type === "doc"
    ) {
      return parsed as JSONContent;
    }
  } catch {
    // fall through to the empty document
  }
  return EMPTY_DOC;
}

/** SQLite writes `datetime('now')` as UTC with a space separator, not ISO-8601. */
function formatTimestamp(sqliteUtc: string): string {
  const date = new Date(`${sqliteUtc.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return sqliteUtc;

  // Fixed locale and zone so the server's environment can't change the output.
  return `${new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date)} UTC`;
}
