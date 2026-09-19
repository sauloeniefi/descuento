import Link from "next/link";
import { listProducts } from "@/lib/tracker/service";
import { searchProducts, type MlSearchResult } from "@/lib/tracker/ml";
import { listCategories } from "@/lib/tracker/categories";
import { addProductAction, checkNowAction } from "./actions";
import { ProductCard } from "@/components/product-card";
import { brl, inputClass } from "@/lib/ui";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const primaryButton =
  "rounded-lg bg-yellow-400 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-yellow-500";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string; q?: string; oportunidades?: string }> }) {
  const user = await requireUser();
  const { error, q, oportunidades } = await searchParams;
  let results: MlSearchResult[] = [];
  let searchError: string | null = null;
  if (q?.trim()) {
    try {
      results = await searchProducts(q.trim());
    } catch (e) {
      searchError = (e as Error).message;
    }
  }
  const products = await listProducts(user.id);
  const categories = await listCategories(user.id);
  const opportunities = products.filter((p) => p.opportunity).length;
  const onlyOpportunities = oportunidades === "1";
  const visible = onlyOpportunities ? products.filter((p) => p.opportunity) : products;
  const toggleParams = new URLSearchParams();
  if (q) toggleParams.set("q", q);
  if (!onlyOpportunities) toggleParams.set("oportunidades", "1");
  const toggleHref = toggleParams.size > 0 ? `/?${toggleParams}` : "/";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Rastreador de preços</h1>
            <p className="mt-1 text-sm text-zinc-500">Mercado Livre — histórico e oportunidades.</p>
          </div>
          <div className="flex gap-2 text-sm">
            <span className="rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-900">{products.length} produtos</span>
            <Link
              href={toggleHref}
              aria-pressed={onlyOpportunities}
              title={onlyOpportunities ? "Mostrar todos os produtos" : "Mostrar só as oportunidades"}
              className={`rounded-full px-3 py-1 transition-colors ${
                onlyOpportunities
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60"
              }`}
            >
              {opportunities} {opportunities === 1 ? "oportunidade" : "oportunidades"}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 sm:py-8">
        <section className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold">Adicionar por link</h2>
            <form action={addProductAction} className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input name="input" required placeholder="URL de produto (/p/MLB...) ou código MLB" className={inputClass} />
                <button className={`${primaryButton} shrink-0`}>Rastrear</button>
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">Mais opções</summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <input name="shortName" placeholder="Nome reduzido" className={inputClass} />
                  <input name="target" placeholder="Preço-alvo (R$)" inputMode="decimal" className={inputClass} />
                  <input name="days" type="number" min={1} defaultValue={1} title="Verificar a cada X dias" placeholder="Dias" className={inputClass} />
                </div>
              </details>
            </form>
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>
            )}
          </div>

          <div className="space-y-3 border-t border-zinc-100 pt-5 dark:border-zinc-900">
            <h2 className="text-sm font-semibold">Ou buscar no Mercado Livre</h2>
            <form className="flex flex-col gap-2 sm:flex-row">
              <input name="q" defaultValue={q} placeholder="Nome do produto" className={inputClass} />
              <button className="shrink-0 rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                Buscar
              </button>
            </form>
            {searchError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{searchError}</p>
            )}
            {q && !searchError && results.length === 0 && <p className="text-sm text-zinc-500">Nada encontrado.</p>}
            {results.length > 0 && (
              <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-900 dark:border-zinc-800">
                {results.map((r) => (
                  <li key={r.mlId} className="flex flex-col gap-3 p-3 text-sm lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="line-clamp-2 hover:underline">
                        {r.title}
                      </a>
                      <span className="font-semibold">{brl(r.price)}</span>
                    </div>
                    <form action={addProductAction} className="grid grid-cols-2 gap-2 sm:grid-cols-[10rem_7rem_auto] lg:shrink-0">
                      <input type="hidden" name="input" value={r.mlId} />
                      <input type="hidden" name="days" value="1" />
                      <input name="shortName" placeholder="Nome reduzido" className={`${inputClass} col-span-2 sm:col-span-1`} />
                      <input name="target" placeholder="Alvo (R$)" inputMode="decimal" className={inputClass} />
                      <button className={primaryButton}>Rastrear</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Seus produtos</h2>
            <form action={checkNowAction}>
              <button className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                Verificar preços agora
              </button>
            </form>
          </div>

          {visible.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
              {onlyOpportunities
                ? "Nenhum produto em oportunidade agora."
                : "Nenhum produto rastreado ainda. Adicione um link ou busque acima."}
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {visible.map((p) => (
                <ProductCard key={p.id} product={p} categories={categories} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
