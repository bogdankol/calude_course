---
name: nodejs-first
description: Describes efficient usage of Node.js and its built-in APIs instead of alternative runtimes or redundant third-party packages
---

# Node.js-First Development

We default to **Node.js** as our JavaScript runtime, with **npm** as the package manager
and task runner. Assume Node.js (current LTS) is available unless explicitly stated
otherwise.

## General Principles

- **PREFER** Node.js over Bun, Deno, or other alternative runtimes
- **PREFER** Node.js built-in modules over third-party packages when available
- **PREFER** Node's native APIs (eg `node:fs/promises`, `node:sqlite`, global `fetch`)
  over dependencies that only re-wrap them

## Package Management

- **USE** `npm install`, `npm add`, `npm uninstall`
- **AVOID** `bun`, `yarn`, `pnpm`
- Commit `package-lock.json`; treat any other lockfile in the repo as stale
- Keep dependencies minimal and intentional

## Scripts & Tooling

- **PREFER** `npm run` for scripts
- **AVOID** Node's built-in test runner (`node --test`) => We'll use `Vitest` for testing
- **AVOID** Node-only bundling workarounds => We'll use Vite
- Avoid introducing extra task runners unless required

## Runtime & APIs

- **PREFER** Node's native APIs (global `fetch`, `node:fs`, `node:path`, `node:process`)
- **USE** the `node:` prefix on built-in imports (`import { readFile } from "node:fs/promises"`)
- **PREFER** ESM (`import`/`export`) over CommonJS (`require`)
- **USE** `node --env-file=.env` for env loading instead of a `dotenv` dependency
- Write code assuming modern Web APIs are available in the runtime — `fetch`,
  `AbortController`, `URL`, `structuredClone`, and Web Streams are all global in Node
- Avoid packages that shim what the runtime already provides (`node-fetch`, `rimraf`,
  `mkdirp`, `uuid` => `crypto.randomUUID()`)

## Performance & DX

- Prefer simple, explicit scripts over complex toolchains
- **AVOID** unnecessary abstractions
