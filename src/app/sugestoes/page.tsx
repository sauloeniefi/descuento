import { requireUser } from "@/lib/auth";
import { listSuggestions } from "@/lib/tracker/suggestions";
import { approveSuggestionAction, dismissSuggestionAction, scanSuggestionsAction } from "../actions";
import { brl } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function Sugestoes({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; encontrados?: string }>;
}) {
  const user = await requireUser();
  const { error, encontrados } = await searchParams;
  const suggestions = await listSuggestions(user.id);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Produtos parecidos</h1>
          <p className="mt-1 text-sm text-zinc-500">
            A varredura usa os produtos que você já rastreia como ponto de partida e procura itens parecidos que estejam
            com desconto. Nada entra na sua lista sem você aprovar.
          </p>
        </div>
        <form action={scanSuggestionsAction}>
          <button className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-yellow-500">
            Procurar agora
          </button>
        </form>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>
      )}
      {encontrados && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-300">
          Varredura concluída: {encontrados} {encontrados === "1" ? "novidade" : "novidades"}.
        </p>
      )}

      {suggestions.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Nenhuma sugestão pendente. Clique em &quot;Procurar agora&quot; ou deixe o cron rodar a varredura.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {suggestions.map((s) => (
            <article
              key={s.id}
              className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div>
                <div className="mb-1 flex flex-wrap gap-1">
                  {s.discountPercent != null && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-900/40 dark:text-green-300">
                      {s.discountPercent}% OFF
                    </span>
                  )}
                  {s.categoryName && (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {s.categoryName}
                    </span>
                  )}
                </div>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="line-clamp-2 font-medium text-zinc-900 hover:underline dark:text-zinc-50"
                >
                  {s.title}
                </a>
                {s.sourceTitle && <p className="mt-1 line-clamp-1 text-xs text-zinc-500">parecido com: {s.sourceTitle}</p>}
              </div>

              <p className="text-sm">
                {s.originalPrice != null && s.originalPrice > s.price && (
                  <span className="text-zinc-400 line-through">{brl(s.originalPrice)} </span>
                )}
                <span className="text-lg font-bold">{brl(s.price)}</span>
              </p>

              <div className="flex gap-2">
                <form action={approveSuggestionAction}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className="rounded-lg bg-yellow-400 px-3 py-1.5 text-sm font-semibold text-zinc-900 hover:bg-yellow-500">
                    Rastrear
                  </button>
                </form>
                <form action={dismissSuggestionAction}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                    Descartar
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
