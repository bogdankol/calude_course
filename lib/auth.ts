import { betterAuth } from 'better-auth';
import { nextCookies } from 'better-auth/next-js';
import { getDb } from './db';

export const auth = betterAuth({
  database: getDb(),
  emailAndPassword: { enabled: true },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  // Without this, auth calls made from a Server Action return their Set-Cookie
  // header but Next never applies it — the sign-in silently leaves no session.
  // Must stay last in the array.
  plugins: [nextCookies()],
});
