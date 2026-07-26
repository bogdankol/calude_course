"use client";

import { useState } from "react";

const advantages = [
  "Works right in your terminal — no context switching",
  "Understands your whole codebase, not just single files",
  "Edits files, runs commands, and fixes tests for you",
  "Extensible with skills, MCP servers, hooks, and plugins",
  "Automates routine work so you focus on the hard parts",
];

export default function Home() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-slate-50 to-slate-200 p-6">
      <div className="w-full max-w-xl rounded-2xl bg-white p-10 shadow-xl ring-1 ring-slate-200">
        <h1 className="text-center text-4xl font-bold tracking-tight text-slate-900">
          Hello world
        </h1>
        <p className="mt-3 text-center text-slate-500">
          Why teams build with Claude Code
        </p>

        <ul className="mt-8 space-y-3">
          {advantages.map((item) => (
            <li key={item} className="flex items-start gap-3 text-slate-700">
              <span className="mt-1 text-emerald-500" aria-hidden>
                ✓
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg bg-slate-900 px-6 py-3 font-medium text-white shadow-sm transition hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
          >
            Open popup
          </button>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-red-500/30"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex h-100 w-100 items-center justify-center rounded-xl bg-white text-2xl font-semibold text-slate-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            popup
          </div>
        </div>
      )}
    </div>
  );
}
