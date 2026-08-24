import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Single quotes for JS/TS string literals. Two things worth knowing:
      //  - JSX attributes are governed by `jsx-quotes`, NOT this rule, so
      //    className="..." correctly stays on double quotes.
      //  - `avoidEscape` leaves "it's" alone instead of forcing 'it\'s'.
      // The core `quotes` rule is deprecated in ESLint 9 in favour of
      // @stylistic/eslint-plugin, but it still works and needs no new dependency.
      // Autofixable, which is what `.claude/hooks/enforce-single-quotes.mjs` relies on.
      quotes: ['error', 'single', { avoidEscape: true }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
