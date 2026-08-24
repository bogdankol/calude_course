import type { Metadata } from "next";
import type { JSX } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Header } from "@/components/Header";
import { LogoutButton } from "@/components/LogoutButton";

export const metadata: Metadata = {
  title: "Dashboard · Notes",
};

export default async function DashboardPage(): Promise<JSX.Element> {
  // Gate lives in the route, not a layout: a layout is not re-rendered on every
  // navigation within its segment, so its session check can go stale. Doing it here
  // means every request for this page is checked against the real session.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/authenticate");

  return (
    <>
      <Header actions={<LogoutButton />} />

      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Your notes</h1>
            {/* `user.name` is always empty — sign-up collects email and password only. */}
            <p className="mt-1 text-sm text-neutral-400">
              Signed in as {session.user.email}.
            </p>
          </div>

          <Link
            href="/notes/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-700 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
          >
            <span aria-hidden className="text-base leading-none">
              +
            </span>
            New Note
          </Link>
        </div>

        <p className="mt-10 rounded-lg border border-dashed border-white/10 px-4 py-10 text-center text-sm text-neutral-500">
          Your notes list goes here.
        </p>
      </main>
    </>
  );
}
