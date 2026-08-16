"use client";

import { useTransition, type JSX } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";

export function LogoutButton(): JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleLogout(): void {
    startTransition(async () => {
      await signOut();
      router.push("/authenticate");
      // Purges the client Router Cache so the authenticated dashboard payload can't be
      // replayed from history once the session cookie is gone.
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      className="absolute top-[50px] right-[200px] flex size-[100px] items-center justify-center p-2 text-center text-sm leading-tight font-medium text-neutral-200 rounded-2xl border border-white/10 bg-white/5 shadow-sm transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isPending ? "Logging out…" : "Log out"}
    </button>
  );
}
