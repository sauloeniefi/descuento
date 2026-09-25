import { requireUser } from "@/lib/auth";
import { hasApiToken } from "@/lib/tracker/api-token";
import { gerarTokenAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function Extensao({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const user = await requireUser();
  const { token } = await searchParams;
  const jaTem = await hasApiToken(user.id);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Extensão do Chrome</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Coloca um botão &quot;Rastrear no Descuento&quot; na página do produto do Mercado Livre, para adicionar sem
          copiar link.
        </p>
      </div>

      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold">1. Token de acesso</h2>
        <p className="text-sm text-zinc-500">
          O token identifica a sua conta na extensão. Gerar um novo invalida o anterior.
          {jaTem && !token && " Já existe um token ativo — só dá para ver o valor na hora em que ele é criado."}
        </p>
        {token && (
          <p className="break-all rounded-lg bg-zinc-100 px-3 py-2 font-mono text-sm dark:bg-zinc-900">{token}</p>
        )}
        <form action={gerarTokenAction}>
          <button className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-yellow-500">
            {jaTem ? "Gerar novo token" : "Gerar token"}
          </button>
        </form>
      </section>

      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-sm font-semibold">2. Instalar a extensão</h2>
        <ol className="list-inside list-decimal space-y-1 text-sm text-zinc-600 dark:text-zinc-300">
          <li>
            Abra <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">chrome://extensions</code> e ligue o
            &quot;Modo do desenvolvedor&quot;.
          </li>
          <li>
            Clique em &quot;Carregar sem compactação&quot; e escolha a pasta{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">extension/</code> do projeto.
          </li>
          <li>Abra o ícone da extensão, cole o endereço do site e o token, escolha a categoria padrão e salve.</li>
          <li>Entre num produto de catálogo do ML e clique no botão amarelo no canto da tela.</li>
        </ol>
        <p className="text-sm text-zinc-500">
          O botão só aparece em produto de catálogo (endereço com <code>/p/MLB…</code>), que é o que a API do Mercado
          Livre deixa rastrear.
        </p>
      </section>
    </main>
  );
}
