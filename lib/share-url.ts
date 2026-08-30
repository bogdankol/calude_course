/**
 * Building the absolute link to a publicly shared note.
 *
 * Both functions are pure — the origin is passed in rather than read from `process.env`
 * here, so `ShareToggle` can import this into the client bundle without dragging a
 * server-only environment read along with it.
 */

/** Where `next dev` serves from, and the last resort when a request has no Host header. */
const DEV_ORIGIN = 'http://localhost:3000';

/**
 * The absolute base URL to build share links against.
 *
 * `BETTER_AUTH_URL` is the app's canonical base URL (SPEC.MD §6.3) and is preferred
 * because the `Host` header is attacker-controlled — trusting it would let a request forge
 * the origin baked into a copied link. Host is only the fallback for a deployment that
 * never set the variable.
 */
export function resolveAppOrigin(
  configuredUrl: string | undefined,
  host: string | null | undefined,
): string {
  // Trailing slash stripped so `origin + '/p/' + slug` cannot produce a doubled separator.
  if (configuredUrl) return configuredUrl.replace(/\/+$/, '');
  return host ? 'http://' + host : DEV_ORIGIN;
}

/**
 * The public URL for a note, or null when there is nothing to link to.
 *
 * An unshared note has `public_slug = NULL`, and null in means null out — the caller
 * renders no link rather than one pointing at the bare `/p/` route.
 */
export function publicNoteUrl(origin: string, slug: string | null | undefined): string | null {
  if (!slug) return null;
  return origin + '/p/' + slug;
}
