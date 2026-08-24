import Link from 'next/link';

export default function Home() {
  return (
    <main className='flex min-h-screen flex-col items-center justify-center px-6 text-center'>
      <h1 className='text-4xl font-bold tracking-tight'>Welcome to Notes</h1>

      <p className='mt-3 max-w-xs text-sm text-neutral-400'>
        A simple note-taking app with rich text editing and public sharing.
      </p>

      <nav className='mt-6 flex items-center gap-2'>
        <Link
          href='/authenticate'
          className='rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-600'
        >
          Log in
        </Link>
        <Link
          href='/authenticate?mode=signup'
          className='rounded-md px-4 py-2 text-sm font-medium text-neutral-300 transition hover:bg-white/5'
        >
          Sign up
        </Link>
      </nav>
    </main>
  );
}
