/**
 * Turns a better-auth failure into something worth showing a person.
 *
 * Lives outside `components/AuthForm.tsx` so the mapping can be tested without rendering a
 * form. It is pure string data with no dependencies, so importing it from a client
 * component costs nothing.
 *
 * Every code below was confirmed against the running app; the HTTP status is noted because
 * the sign-up route throws the `_USE_ANOTHER_EMAIL` variant rather than the bare one.
 */

/** better-auth resolves to `{ data, error }`; `error.code` is a stable machine string. */
export type AuthErrorLike = { code?: string; message?: string };

export const AUTH_ERROR_MESSAGES: Record<string, string | undefined> = {
  // 401 — deliberately does not say which half was wrong, since that would confirm
  // whether an account exists for the address.
  INVALID_EMAIL_OR_PASSWORD: "That email and password don't match an account.",
  USER_ALREADY_EXISTS: 'An account with that email already exists — log in instead.',
  // 422 — what the sign-up route actually throws.
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    'An account with that email already exists — log in instead.',
  // 400 — better-auth's default password bounds are 8–128.
  PASSWORD_TOO_SHORT: 'Password must be at least 8 characters.',
  PASSWORD_TOO_LONG: 'Password must be 128 characters or fewer.',
  INVALID_EMAIL: 'Enter a valid email address.',
};

export const AUTH_FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

/**
 * A known code wins; otherwise better-auth's own message is shown rather than swallowing
 * detail behind the generic string, and the generic string is the last resort.
 */
export function authErrorMessage(error: AuthErrorLike | null | undefined): string {
  if (!error) return AUTH_FALLBACK_MESSAGE;

  const mapped = error.code ? AUTH_ERROR_MESSAGES[error.code] : undefined;
  return mapped ?? error.message ?? AUTH_FALLBACK_MESSAGE;
}
