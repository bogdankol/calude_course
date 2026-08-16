"use client";

import { useState, type ComponentProps, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn, signUp } from "@/lib/auth-client";

export type AuthMode = "login" | "signup";

/** better-auth resolves to `{ data, error }`; `error.code` is a stable machine string. */
type AuthError = { code?: string; message?: string };

/**
 * Tagged with the mode that produced it. Switching modes is a same-route navigation, so
 * this component stays mounted — an untagged message would linger over the other form.
 */
type FormError = { mode: AuthMode; message: string };

const ERROR_MESSAGES: Record<string, string | undefined> = {
  INVALID_EMAIL_OR_PASSWORD: "That email and password don't match an account.",
  USER_ALREADY_EXISTS: "An account with that email already exists — log in instead.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    "An account with that email already exists — log in instead.",
  PASSWORD_TOO_SHORT: "Password must be at least 8 characters.",
  PASSWORD_TOO_LONG: "Password must be 128 characters or fewer.",
  INVALID_EMAIL: "Enter a valid email address.",
};

const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

function messageFor({ code, message }: AuthError) {
  return (code ? ERROR_MESSAGES[code] : undefined) ?? message ?? FALLBACK_MESSAGE;
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<FormError | null>(null);

  const isSignup = mode === "signup";
  const message = error?.mode === mode ? error.message : null;

  /**
   * Deliberately an `onSubmit` handler rather than a `<form action>`: React 19 wraps
   * action dispatches in `requestFormReset`, which would wipe the inputs after a failed
   * attempt. Plain submit keeps the fields uncontrolled *and* keeps what was typed.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const fields = new FormData(event.currentTarget);
    const email = String(fields.get("email"));
    const password = String(fields.get("password"));

    setPending(true);
    setError(null);

    // `name` is required by the sign-up body schema — omitting it is a 400
    // VALIDATION_ERROR — but an empty string is accepted. We collect nothing beyond
    // email and password, so nothing is sent and nothing derived is stored.
    const { error: authError } = isSignup
      ? await signUp.email({ name: "", email, password })
      : await signIn.email({ email, password });

    if (authError) {
      setError({ mode, message: messageFor(authError) });
      setPending(false);
      return;
    }

    // The sign-in response carries the session cookie, so the RSC request for
    // /dashboard already sees it — a route change needs no router.refresh().
    // `pending` stays true so the form cannot be resubmitted mid-navigation.
    router.push("/dashboard");
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
      <fieldset disabled={pending} className="flex flex-col gap-4">
        <legend className="sr-only">
          {isSignup ? "Account details" : "Login details"}
        </legend>

        <Field id="email" label="Email" type="email" autoComplete="email" />

        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          minLength={isSignup ? 8 : undefined}
          maxLength={128}
          hint={isSignup ? "At least 8 characters." : undefined}
        />
      </fieldset>

      {/* Always rendered so the live region exists before a message lands in it. */}
      <div role="alert" aria-live="polite">
        {message && (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-slate-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending
          ? isSignup
            ? "Creating account…"
            : "Logging in…"
          : isSignup
            ? "Create account"
            : "Log in"}
      </button>
    </form>
  );
}

type FieldProps = ComponentProps<"input"> & {
  id: string;
  label: string;
  hint?: string;
};

function Field({ id, label, hint, ...inputProps }: FieldProps) {
  const hintId = `${id}-hint`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-neutral-300">
        {label}
      </label>
      <input
        id={id}
        name={id}
        required
        aria-describedby={hint ? hintId : undefined}
        className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-100 transition-colors placeholder:text-neutral-500 focus-visible:border-slate-400 focus-visible:outline-2 focus-visible:outline-slate-400 disabled:opacity-60"
        {...inputProps}
      />
      {hint && (
        <p id={hintId} className="text-xs text-neutral-500">
          {hint}
        </p>
      )}
    </div>
  );
}
