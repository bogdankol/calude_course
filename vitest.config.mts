import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    // Mirrors `paths: { "@/*": ["./*"] }` in tsconfig.json. Declared by hand rather than
    // via vite-tsconfig-paths so the runner needs no extra dependency for one mapping.
    alias: { '@': projectRoot },
  },
  test: {
    // Node, not jsdom: everything under test here is data-layer, validation or Server
    // Action logic. Next.js does not support unit-testing async Server Components at all,
    // and the rendered UI is covered end-to-end with Playwright instead.
    environment: 'node',
    // Forward slashes even on Windows — Vitest's glob matching does not accept `\`.
    include: ['tests/**/*.test.ts'],
    // Already the default in Vitest 4, set explicitly because it matters here: native
    // modules like better-sqlite3 can crash cryptically under the `threads` pool.
    pool: 'forks',
    env: {
      // Every suite that touches the data layer runs against a throwaway in-memory
      // database. Set here so no test can reach data/app.db by forgetting to override it;
      // `tests/helpers/db.ts` refuses to load if this is anything else.
      DATABASE_PATH: ':memory:',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // The unit-testable surface. Components are deliberately absent: their logic was
      // extracted into lib/ (auth-errors, share-url, note-doc) precisely so it could be
      // tested here, and what remains in them is rendering, covered by Playwright.
      include: ['lib/**/*.ts', 'app/**/actions.ts'],
      // Third-party wiring with no branches of our own: lib/auth.ts is a betterAuth()
      // call and lib/auth-client.ts is a createAuthClient() call. Both are mocked
      // wherever they matter, and neither has logic a unit test could assert.
      exclude: ['lib/auth.ts', 'lib/auth-client.ts'],
    },
  },
});
