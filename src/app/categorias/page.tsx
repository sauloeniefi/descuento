import { listCategories } from "@/lib/tracker/categories";
import { requireUser } from "@/lib/auth";
import { createCategoryAction, deleteCategoryAction, updateCategoryAction } from "../actions";

export const dynamic = "force-dynamic";

const field = "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

export default async function CategoriasPage() {
  const user = await requireUser();
  const categories = await listCategories(user.id);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Categorias</h1>
          <p className="mt-1 text-sm text-zinc-500">
            A mensagem da categoria vai no começo do texto compartilhado, seguida do nome do produto e do link.
          </p>
        </div>

        <form action={createCategoryAction} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold">Nova categoria</h2>
          <input name="name" required placeholder="Nome (ex: Cuidados com o carro)" className={field} />
          <textarea name="message" rows={3} placeholder="Mensagem pré-definida (ex: Olha essa oferta imperdível!)" className={field} />
          <button className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-yellow-500">Criar</button>
        </form>

        {categories.length === 0 && <p className="text-sm text-zinc-500">Nenhuma categoria criada ainda.</p>}

        {categories.map((c) => (
          <div key={c.id} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <form action={updateCategoryAction} className="space-y-3">
              <input type="hidden" name="id" value={c.id} />
              <input name="name" required defaultValue={c.name} className={field} />
              <textarea name="message" rows={3} defaultValue={c.message} className={field} />
              <button className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700">Salvar</button>
            </form>
            <form action={deleteCategoryAction}>
              <input type="hidden" name="id" value={c.id} />
              <button className="text-xs text-zinc-400 hover:text-red-600">Excluir categoria</button>
            </form>
          </div>
        ))}
      </main>
    </div>
  );
}
