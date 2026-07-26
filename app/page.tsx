export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-blue-500/30">
      <div className="rounded-lg bg-green-500/30 p-16">
        <h1 className="text-center text-4xl font-semibold text-red-500/80">
          Hello world
        </h1>
        <ul className="mt-8 list-disc space-y-2 pl-6 text-lg text-gray-800">
          <li>Works right in your terminal &mdash; no context switching</li>
          <li>Understands your whole codebase, not just single files</li>
          <li>Edits files, runs commands, and fixes tests for you</li>
          <li>Extensible with skills, MCP servers, hooks, and plugins</li>
          <li>Automates routine work so you focus on the hard parts</li>
        </ul>
      </div>
    </div>
  );
}
