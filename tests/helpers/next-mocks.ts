/**
 * Stand-ins for the Next.js runtime a Server Action reaches for.
 *
 * `redirect()` signals by throwing an internal `NEXT_REDIRECT`, which is why the actions
 * keep their `redirect` calls outside any `try`. The mock throws too, so a test that
 * swallowed the navigation would be swallowing it for the same reason production would.
 */
export class RedirectSignal extends Error {
  constructor(public readonly url: string) {
    super('NEXT_REDIRECT: ' + url);
    this.name = 'RedirectSignal';
  }
}

/**
 * Runs an action that is expected to navigate, and reports where it went.
 *
 * Fails loudly if the action returns normally — otherwise a lost redirect would read as a
 * passing test.
 */
export async function captureRedirect(action: () => Promise<unknown>): Promise<string> {
  try {
    await action();
  } catch (error) {
    if (error instanceof RedirectSignal) return error.url;
    throw error;
  }
  throw new Error('Expected the action to redirect, but it returned normally.');
}
