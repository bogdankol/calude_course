#!/usr/bin/env node
/**
 * PostToolUse hook: normalises string quotes in the file Claude just wrote.
 *
 * Runs ESLint's autofix for the `quotes` rule on that single file. Fixing beats nagging —
 * the style is applied instead of reported, so it cannot drift.
 *
 * Exits 2 when it actually changed the file. For PostToolUse that is not a rollback; it
 * just feeds the message back to Claude, which matters because Claude's in-memory copy of
 * the file is stale the moment this rewrites it.
 */
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const FIXABLE = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (raw += chunk));
process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.exit(0); // Not our business if the payload is unreadable.
  }

  const file = payload?.tool_input?.file_path;
  if (typeof file !== 'string' || !existsSync(file)) process.exit(0);
  if (!FIXABLE.has(path.extname(file))) process.exit(0);

  const projectDir = payload?.cwd ?? process.cwd();
  // Call the local binary through node rather than `npx`, which on Windows means
  // npx.cmd and a shell, and is far slower.
  const eslintBin = path.join(projectDir, 'node_modules', 'eslint', 'bin', 'eslint.js');
  if (!existsSync(eslintBin)) process.exit(0);

  const before = readFileSync(file, 'utf8');
  try {
    execFileSync(process.execPath, [eslintBin, '--fix', file], {
      cwd: projectDir,
      stdio: 'ignore',
    });
  } catch {
    // A lint error unrelated to quotes still exits non-zero after fixing what it could.
    // The content comparison below is what decides whether anything happened.
  }

  const after = readFileSync(file, 'utf8');
  if (before === after) process.exit(0);

  process.stderr.write(
    'Quote style normalised to single quotes in ' +
      path.relative(projectDir, file) +
      ' (ESLint `quotes` autofix). Your copy of this file is now stale — re-read it ' +
      'before editing again.\n',
  );
  process.exit(2);
});
