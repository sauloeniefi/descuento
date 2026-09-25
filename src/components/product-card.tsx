import type { TrackedProduct } from "@/lib/tracker/service";
import { levelLabel, WINDOW_DAYS, type PriceLevel } from "@/lib/tracker/price-level";
import type { Category } from "@/lib/tracker/categories";
import { removeProductAction, setAffiliateAction, setImageIndexAction, setShortNameAction, setTargetAction } from "@/app/actions";
import { brl, inputClass } from "@/lib/ui";
import { CategorySelect } from "./category-select";
import { ShareButton } from "./share-button";

const saveButton =
  "shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

const tones = {
  neutral: "bg-zinc-100 dark:bg-zinc-800",
  green: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  yellow: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  red: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const levelTones: Record<PriceLevel, keyof typeof tones> = {
  otimo: "green",
  bom: "green",
  normal: "neutral",
  caro: "red",
};

function priceTone(p: TrackedProduct): keyof typeof tones {
  if (p.currentPrice == null) return "neutral";
  if (p.targetPrice != null) {
    if (p.currentPrice <= p.targetPrice) return "green";
    if (p.currentPrice <= p.targetPrice * 1.1) return "yellow";
    return "red";
  }
  return p.level ? levelTones[p.level] : "neutral";
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: keyof typeof tones }) {
  return (
    <div className={`rounded-lg px-3 py-2 ${tone ? tones[tone] : "bg-zinc-50 dark:bg-zinc-900"}`}>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className={`mt-0.5 truncate ${tone ? "text-lg font-bold" : "text-sm font-medium"}`}>{value}</dd>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      {children}
    </div>
  );
}

export function ProductCard({ product: p, categories }: { product: TrackedProduct; categories: Category[] }) {
  const message = [categories.find((c) => c.id === p.categoryId)?.message, p.shortName ?? p.title, p.affiliateUrl ?? p.url]
    .filter(Boolean)
    .join("\n\n");
  const minAt = p.minPriceAt
    ? new Date(p.minPriceAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    : null;
  const checkedAt = p.lastCheckedAt
    ? new Date(p.lastCheckedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 sm:h-20 sm:w-20 dark:border-zinc-800">
          {p.thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/products/${p.id}/image?v=${p.imageIndex}`} alt="" className="h-full w-full object-contain" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap gap-1">
            {p.opportunity && (
              <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-900/40 dark:text-green-300">
                {p.opportunity}
              </span>
            )}
            {p.currentOriginalPrice != null && p.currentPrice != null && p.currentOriginalPrice > p.currentPrice && (
              <span
                title={`Preço "de" do anúncio: ${brl(p.currentOriginalPrice)}`}
                className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
              >
                Anúncio {Math.round((1 - p.currentPrice / p.currentOriginalPrice) * 100)}% OFF
              </span>
            )}
            {p.level && p.percentile != null && (
              <span
                title={`Mais barato que ${Math.round((1 - p.percentile) * 100)}% das coletas dos últimos ${WINDOW_DAYS} dias`}
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${tones[levelTones[p.level]]}`}
              >
                Preço {levelLabel[p.level].toLowerCase()}
              </span>
            )}
          </div>
          <a
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="line-clamp-2 font-medium text-zinc-900 hover:underline dark:text-zinc-50"
          >
            {p.title}
          </a>
          <p className="mt-1 text-xs text-zinc-500">
            {p.samples} {p.samples === 1 ? "coleta" : "coletas"}
            {checkedAt && ` · verificado em ${checkedAt}`}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Atual" value={brl(p.currentPrice)} tone={priceTone(p)} />
        <Stat label={minAt ? `Mínimo (${minAt})` : "Mínimo"} value={brl(p.minPrice)} />
        <Stat label="Média" value={brl(p.avgPrice)} />
        <Stat label="Alvo" value={brl(p.targetPrice)} />
      </dl>

      {p.targetWarning && <p className="-mt-2 text-xs text-amber-700 dark:text-amber-400">{p.targetWarning}</p>}
      {p.suggestedTarget != null && (p.targetPrice == null || p.targetWarning) && (
        <div className="-mt-2 text-xs text-zinc-500">
          Alvo sugerido pelo histórico: <span className="font-semibold">{brl(p.suggestedTarget)}</span> — 25% das coletas dos
          últimos {WINDOW_DAYS} dias ficaram nesse valor ou abaixo.{" "}
          <form action={setTargetAction} className="inline">
            <input type="hidden" name="id" value={p.id} />
            <input type="hidden" name="target" value={p.suggestedTarget} />
            <button className="font-medium text-yellow-700 underline hover:text-yellow-800 dark:text-yellow-500">Usar</button>
          </form>
        </div>
      )}
      {p.level == null && p.samples > 0 && (
        <p className="-mt-2 text-xs text-zinc-500">Poucas coletas para classificar o preço — o histórico ainda está curto.</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome reduzido">
          <form action={setShortNameAction} className="flex gap-2">
            <input type="hidden" name="id" value={p.id} />
            <input name="shortName" defaultValue={p.shortName ?? ""} placeholder="Usado na mensagem" className={inputClass} />
            <button className={saveButton}>Salvar</button>
          </form>
        </Field>
        <Field label="Categoria">
          <CategorySelect productId={p.id} categoryId={p.categoryId} categories={categories} />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_9rem_9rem]">
        <Field label="Link de afiliado">
          <form action={setAffiliateAction} className="flex gap-2">
            <input type="hidden" name="id" value={p.id} />
            <input name="url" defaultValue={p.affiliateUrl ?? ""} placeholder="https://meli.la/..." className={inputClass} />
            <button className={saveButton}>Salvar</button>
          </form>
        </Field>
        <Field label="Preço-alvo (R$)">
          <form action={setTargetAction} className="flex gap-2">
            <input type="hidden" name="id" value={p.id} />
            <input
              name="target"
              defaultValue={p.targetPrice ?? ""}
              placeholder="Vazio = sem alvo"
              inputMode="decimal"
              className={inputClass}
            />
            <button className={saveButton}>Salvar</button>
          </form>
        </Field>
        <Field label="Nº da imagem">
          <form action={setImageIndexAction} className="flex gap-2">
            <input type="hidden" name="id" value={p.id} />
            <input name="imageIndex" type="number" min={1} defaultValue={p.imageIndex} className={inputClass} />
            <button className={saveButton}>Salvar</button>
          </form>
        </Field>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-900">
        <ShareButton productId={p.id} imageIndex={p.imageIndex} hasImage={p.thumbnail != null} message={message} isAffiliate={p.affiliateUrl != null} />
        <form action={removeProductAction}>
          <input type="hidden" name="id" value={p.id} />
          <button className="text-sm text-zinc-400 hover:text-red-600">Remover</button>
        </form>
      </div>
    </article>
  );
}
