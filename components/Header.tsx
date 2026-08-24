import Link from 'next/link';
import type { JSX, ReactNode } from 'react';

/**
 * App header. Deliberately not mounted in `app/layout.tsx`: the brand links to
 * `/dashboard`, and SPEC.MD §8.1 wants no route into user-specific areas on the public
 * `/p/[slug]` page. Authenticated pages opt in instead.
 *
 * `actions` is the right-hand slot — logout, note controls, whatever the page owns.
 */
export function Header({ actions }: { actions?: ReactNode }): JSX.Element {
  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-[color:var(--background)]/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-4 px-6">
        <Link
          href="/dashboard"
          className="-mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
        >
          <span
            aria-hidden
            className="grid size-6 place-items-center rounded-[7px] bg-slate-700 text-[11px] font-bold text-white"
          >
            N
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-neutral-100">
            NextNotes
          </span>
        </Link>

        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
