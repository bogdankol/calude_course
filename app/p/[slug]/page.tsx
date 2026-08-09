export default async function PublicNotePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Public note</h1>
      <p className="mt-2 text-slate-600">slug: {slug}</p>
    </main>
  );
}
