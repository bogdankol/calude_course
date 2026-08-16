import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AuthForm, type AuthMode } from "@/components/AuthForm";

type PageProps = {
  searchParams: Promise<{ mode?: string | string[] }>;
};

/** `?mode=signup` is the only recognised value — anything else means log in. */
function resolveMode(mode: string | string[] | undefined): AuthMode {
  const value = Array.isArray(mode) ? mode[0] : mode;
  return value === "signup" ? "signup" : "login";
}

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const mode = resolveMode((await searchParams).mode);

  return {
    title: mode === "signup" ? "Sign up · Notes" : "Log in · Notes",
  };
}

export default async function AuthenticatePage({ searchParams }: PageProps) {
  // Authoritative check — someone with a live session has no business on this page.
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/dashboard");

  const mode = resolveMode((await searchParams).mode);
  const isSignup = mode === "signup";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <section className="w-full max-w-sm">
        <h1 className="text-2xl font-bold tracking-tight">
          {isSignup ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-sm text-neutral-400">
          {isSignup
            ? "Sign up with an email and password to start taking notes."
            : "Log in with your email and password."}
        </p>

        <AuthForm mode={mode} />

        <p className="mt-6 text-center text-sm text-neutral-400">
          {isSignup ? "Already have an account? " : "No account yet? "}
          {/* `replace` keeps mode toggling out of the history stack. */}
          <Link
            replace
            href={isSignup ? "/authenticate" : "/authenticate?mode=signup"}
            className="font-medium text-neutral-100 underline underline-offset-4 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
          >
            {isSignup ? "Log in" : "Sign up"}
          </Link>
        </p>
      </section>
    </main>
  );
}
