export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Note editor</h1>
      <p className="mt-2 text-slate-600">note id: {id}</p>
    </main>
  );
}
