import { describe, expect, it } from 'vitest';
import { AUTH_FALLBACK_MESSAGE, authErrorMessage } from '@/lib/auth-errors';

/**
 * Mock better-auth failures. The codes and statuses are the ones CLAUDE.md records as
 * confirmed against the running app, so this suite fails if a mapping is dropped.
 */
const AUTH_ERRORS = {
  wrongPassword: { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password' },
  duplicateEmail: {
    code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
    message: 'User already exists. Use another email.',
  },
  shortPassword: { code: 'PASSWORD_TOO_SHORT', message: 'Password too short' },
} as const;

describe('authErrorMessage', () => {
  it('maps a wrong-password failure to a message that names neither field', () => {
    const message = authErrorMessage(AUTH_ERRORS.wrongPassword);

    expect(message).toBe("That email and password don't match an account.");
    // Not leaking which half was wrong is the point — it would confirm the account exists.
    expect(message).not.toMatch(/password is|no such|not found/i);
  });

  it('points a duplicate sign-up at logging in instead', () => {
    expect(authErrorMessage(AUTH_ERRORS.duplicateEmail)).toBe(
      'An account with that email already exists — log in instead.',
    );
  });

  it('maps the bare USER_ALREADY_EXISTS code the same way as the sign-up variant', () => {
    expect(authErrorMessage({ code: 'USER_ALREADY_EXISTS' })).toBe(
      authErrorMessage(AUTH_ERRORS.duplicateEmail),
    );
  });

  it('states the real minimum for a too-short password', () => {
    expect(authErrorMessage(AUTH_ERRORS.shortPassword)).toBe(
      'Password must be at least 8 characters.',
    );
  });

  it("falls back to better-auth's own message for a code it does not know", () => {
    expect(authErrorMessage({ code: 'SOME_FUTURE_CODE', message: 'Rate limit exceeded' })).toBe(
      'Rate limit exceeded',
    );
  });

  it('uses the generic message when there is no code and no message', () => {
    expect(authErrorMessage({})).toBe(AUTH_FALLBACK_MESSAGE);
  });

  it('uses the generic message for a nullish error', () => {
    expect(authErrorMessage(null)).toBe(AUTH_FALLBACK_MESSAGE);
  });
});
