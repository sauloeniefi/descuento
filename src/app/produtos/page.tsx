import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listFolders } from "@/lib/tracker/service";

export const dynamic = "force-dynamic";

export default async function Pastas() {
  const user = await requireUser();
  const folders = await listFolders(user.id);
  const total = folders.reduce((soma, f) => soma + f.total, 0);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Meus produtos</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {total} {total === 1 ? "produto" : "produtos"} nas suas pastas. Cada pasta é uma categoria sua — a varredura
          mantém cada uma populada com produtos parecidos, que entram só depois da sua aprovação em{" "}
          <Link href="/sugestoes" className="underline">
            Sugestões
          </Link>
          .
        </p>
      </div>

      {folders.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Nenhuma pasta ainda. Crie uma categoria em{" "}
          <Link href="/categorias" className="underline">
            Categorias
          </Link>
          .
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {folders.map((f) => (
            <Link
              key={f.id ?? "sem-categoria"}
              href={`/produtos/${f.id ?? "sem-categoria"}`}
              className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition-colors hover:border-yellow-400 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <p className="font-semibold text-zinc-900 dark:text-zinc-50">{f.name}</p>
              <div className="mt-3 flex flex-wrap gap-1 text-xs">
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                  {f.total} {f.total === 1 ? "produto" : "produtos"}
                </span>
                {f.expiring > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                    {f.expiring} vencendo
                  </span>
                )}
                {f.expired > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
                    {f.expired} vencidos
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
