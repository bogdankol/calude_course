import type { Metadata } from "next";
import type { JSX } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
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
    <main className="relative min-h-screen p-8">
      <LogoutButton />

      <h1 className="text-2xl font-semibold">Dashboard</h1>
      {/* `user.name` is always empty — sign-up collects email and password only. */}
      <p className="mt-2 text-sm text-neutral-400">
        Signed in as {session.user.email}.
      </p>
      <p className="mt-6 text-sm text-neutral-500">Your notes list goes here.</p>
    </main>
  );
}
