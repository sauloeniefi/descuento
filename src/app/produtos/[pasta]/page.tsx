import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listCategories } from "@/lib/tracker/categories";
import { listProducts } from "@/lib/tracker/service";
import { favoritarAction, removerProdutosAction, renovarPastaAction, renovarProdutosAction } from "@/app/actions";
import { brl, inputClass } from "@/lib/ui";

export const dynamic = "force-dynamic";

const botao =
  "rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";

function diasAte(iso: string | null) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export default async function Pasta({
  params,
  searchParams,
}: {
  params: Promise<{ pasta: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const { pasta } = await params;
  const { q } = await searchParams;
  const categoryId = pasta === "sem-categoria" ? null : pasta;

  const [categories, todos] = await Promise.all([listCategories(user.id), listProducts(user.id)]);
  const nome = categoryId ? (categories.find((c) => c.id === categoryId)?.name ?? "Pasta") : "Sem categoria";
  const busca = q?.trim().toLowerCase() ?? "";
  const produtos = todos
    .filter((p) => p.categoryId === categoryId)
    .filter((p) => !busca || p.title.toLowerCase().includes(busca) || (p.shortName ?? "").toLowerCase().includes(busca));

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/produtos" className="text-sm text-zinc-500 hover:underline">
            ← Pastas
          </Link>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{nome}</h1>
          <p className="text-sm text-zinc-500">
            {produtos.length} {produtos.length === 1 ? "produto" : "produtos"}
          </p>
        </div>
        <form action={renovarPastaAction}>
          <input type="hidden" name="categoryId" value={categoryId ?? ""} />
          <button className={botao}>Renovar pasta por 30 dias</button>
        </form>
      </div>

      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar produto por nome…" className={inputClass} />
        <button className={botao}>Buscar</button>
      </form>

      {produtos.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          {busca ? "Nada encontrado nesta pasta." : "Pasta vazia. Aprove sugestões ou adicione um produto no rastreador."}
        </p>
      ) : (
        <form className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button formAction={renovarProdutosAction} className={botao}>
              Renovar selecionados
            </button>
            <button formAction={removerProdutosAction} className={`${botao} text-red-600`}>
              Remover selecionados
            </button>
          </div>

          <ul className="space-y-2">
            {produtos.map((p) => {
              const dias = diasAte(p.expiresAt);
              const desconto =
                p.currentOriginalPrice != null && p.currentPrice != null && p.currentOriginalPrice > p.currentPrice
                  ? Math.round((1 - p.currentPrice / p.currentOriginalPrice) * 100)
                  : null;

              return (
                <li
                  key={p.id}
                  className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <input type="checkbox" name="ids" value={p.id} className="mt-1" aria-label={`Selecionar ${p.title}`} />
                  {p.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/products/${p.id}/image?v=${p.imageIndex}`}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-lg border border-zinc-200 object-contain p-1 dark:border-zinc-800"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="line-clamp-2 text-sm hover:underline">
                      {p.title}
                    </a>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-bold">{brl(p.currentPrice)}</span>
                      {p.currentOriginalPrice != null && desconto != null && (
                        <span className="text-zinc-400 line-through">{brl(p.currentOriginalPrice)}</span>
                      )}
                      {desconto != null && (
                        <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                          -{desconto}%
                        </span>
                      )}
                      {dias != null && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            dias < 0
                              ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                              : dias <= 7
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                          }`}
                        >
                          {dias < 0 ? "vencido" : `expira em ${dias} ${dias === 1 ? "dia" : "dias"}`}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    formAction={favoritarAction}
                    name="id"
                    value={p.id}
                    title={p.favorite ? "Desfavoritar" : "Favoritar (prioriza no envio)"}
                    className="shrink-0 text-lg text-zinc-300 hover:text-yellow-500"
                  >
                    {p.favorite ? "★" : "☆"}
                  </button>
                </li>
              );
            })}
          </ul>
        </form>
      )}
    </main>
  );
}
