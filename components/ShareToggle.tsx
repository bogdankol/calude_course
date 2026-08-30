'use client';

import { useState, useTransition, type JSX } from 'react';
import { setNoteSharingAction } from '@/app/notes/[id]/actions';
import { publicNoteUrl } from '@/lib/share-url';

const LABEL_ID = 'share-toggle-label';

type ShareToggleProps = {
  noteId: string;
  initialIsPublic: boolean;
  initialSlug: string | null;
  /** Absolute origin, passed from the server so the link needs no `window` access. */
  origin: string;
};

/**
 * SPEC.MD §8.3 `ShareToggle` — flips public sharing and shows the public URL when on.
 *
 * A `role="switch"` button rather than a styled `<input type="checkbox">`: pseudo-elements
 * do not render on replaced elements like `<input>`, which is how the usual
 * Tailwind-switch trick quietly breaks. A button can hold the knob as a real child.
 *
 * Sharing state is held locally and replaced by whatever the action reports, so the switch
 * always shows what the database stored rather than what the click assumed.
 */
export function ShareToggle({
  noteId,
  initialIsPublic,
  initialSlug,
  origin,
}: ShareToggleProps): JSX.Element {
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [slug, setSlug] = useState(initialSlug);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const url = publicNoteUrl(origin, slug);

  function handleToggle(): void {
    if (pending) return;
    const next = !isPublic;

    setError(null);
    setCopied(false);

    startTransition(async () => {
      const result = await setNoteSharingAction(noteId, next);

      // Discriminated on `ok`, not on `error` being truthy: `error: string` is not a
      // literal type, so truthiness alone does not narrow the union.
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setIsPublic(result.isPublic);
      setSlug(result.publicSlug);
    });
  }

  async function handleCopy(): Promise<void> {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; the URL is selectable in the field regardless.
      setError('Could not copy. Select the link and copy it manually.');
    }
  }

  return (
    <section
      aria-labelledby={LABEL_ID}
      className='rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3'
    >
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <p id={LABEL_ID} className='text-sm font-medium text-neutral-200'>
            Share via link
          </p>
          <p className='mt-0.5 text-xs text-neutral-500'>
            {isPublic ? 'Anyone with the link can read this note.' : 'Only you can see this note.'}
          </p>
        </div>

        <button
          type='button'
          role='switch'
          aria-checked={isPublic}
          aria-labelledby={LABEL_ID}
          onClick={handleToggle}
          disabled={pending}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:cursor-not-allowed disabled:opacity-60 ${
            isPublic ? 'bg-emerald-600' : 'bg-white/15'
          }`}
        >
          <span
            aria-hidden
            className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${
              isPublic ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {isPublic && url && (
        <div className='mt-3 flex flex-wrap items-center gap-2'>
          <input
            readOnly
            value={url}
            aria-label='Public link to this note'
            onFocus={(event) => event.currentTarget.select()}
            className='min-w-0 flex-1 rounded-md border border-white/10 bg-black/25 px-2.5 py-1.5 font-mono text-xs text-neutral-300 focus-visible:outline-2 focus-visible:outline-slate-400'
          />
          <button
            type='button'
            onClick={handleCopy}
            className='rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400'
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}

      {/* Always present so the live region exists before a message lands in it. */}
      <div role='alert' aria-live='polite'>
        {error && <p className='mt-2 text-xs text-red-300'>{error}</p>}
      </div>
    </section>
  );
}
