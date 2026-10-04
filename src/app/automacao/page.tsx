import { requireUser } from "@/lib/auth";
import { listCategories } from "@/lib/tracker/categories";
import { listCampaigns, listGroups, listLatestQrCode, listQueue, listSyncStatus } from "@/lib/automation/campaigns";
import { SyncStatusBadge } from "@/components/sync-status-badge";
import { GenerateQrButton } from "@/components/generate-qr-button";
import { QrCodeRefresh } from "@/components/qr-code-refresh";
import {
  createCampaignAction,
  deleteCampaignAction,
  enqueueNowAction,
  startDevModeAction,
  syncGroupsAction,
  toggleCampaignAction,
} from "../actions";
import { inputClass } from "@/lib/ui";

export const dynamic = "force-dynamic";

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const statusTone: Record<string, string> = {
  pending: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  sent: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

export default async function Automacao({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; enfileirados?: string; sincronizado?: string; qr?: string; dev?: string; devError?: string }>;
}) {
  const user = await requireUser();
  const { error, enfileirados, sincronizado, qr, dev, devError } = await searchParams;
  const [groups, campaigns, categories, queue, latestQrCode, syncStatus] = await Promise.all([
    listGroups(user.id),
    listCampaigns(user.id),
    listCategories(user.id),
    listQueue(user.id),
    listLatestQrCode(user.id),
    listSyncStatus(user.id),
  ]);
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Automação de envio</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Cada campanha manda promoções de uma categoria para um grupo de WhatsApp, nos dias e horários que você definir.
          O site monta a fila; o serviço do WhatsApp envia as mensagens. Só aparecem os grupos em que você é
          administrador — nos outros o WhatsApp recusa o envio.
        </p>
      </div>

      {syncStatus?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          Erro ao sincronizar grupos: {syncStatus.error}
        </p>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>
      )}
      {enfileirados && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950/40 dark:text-green-300">
          {enfileirados} {enfileirados === "1" ? "envio criado" : "envios criados"} na fila.
        </p>
      )}
      {dev && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          Modo dev iniciado: {dev} {dev === "1" ? "produto na fila" : "produtos na fila"}, um por minuto para o grupo escolhido. O limite de 12 envios por hora continua ativo.
        </p>
      )}
      {devError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{devError}</p>
      )}
      {sincronizado && (
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
          Solicitação de sincronização enviada. O worker vai atualizar os grupos em breve.
        </p>
      )}
      {qr && (
        <p className="rounded-lg bg-violet-50 px-3 py-2 text-sm text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
          Solicitação enviada. Aguardando o novo QR Code do WhatsApp...
        </p>
      )}
      <QrCodeRefresh active={Boolean(qr) && !latestQrCode} />

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold">WhatsApp</h2>
            <SyncStatusBadge syncStatus={syncStatus?.status ?? null} />
          </div>
          <div className="flex flex-wrap gap-2">
            <GenerateQrButton hasExistingQr={Boolean(latestQrCode)} />
            <form action={syncGroupsAction}>
              <button className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800">
                Sincronizar grupos
              </button>
            </form>
          </div>
        </div>

        {latestQrCode ? (
          <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">QR Code atual</p>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(latestQrCode)}`}
              alt="QR Code do WhatsApp"
              className="h-52 w-52 rounded-lg bg-white p-2 shadow-sm"
            />
          </div>
        ) : (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Ainda não há QR gerado. Clique em “Gerar QR Code” para abrir a conexão do WhatsApp.
          </p>
        )}

        {groups.length > 0 && (
          <form action={startDevModeAction} className="mt-4 flex flex-wrap items-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <label className="min-w-56 flex-1 space-y-1">
              <span className="text-xs font-medium text-zinc-500">Grupo para testar todos os produtos</span>
              <select className={inputClass} name="chatId" required defaultValue="">
                <option disabled value="">Selecione um grupo</option>
                {groups.map((group) => (
                  <option key={group.chatId} value={group.chatId}>{group.name}</option>
                ))}
              </select>
            </label>
            <button className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200 dark:hover:bg-amber-900/40">
              Modo dev
            </button>
            <p className="basis-full text-xs text-zinc-500">Enfileira produtos ativos com preço coletado, um a cada minuto. O limite global de 12 mensagens por hora permanece em vigor.</p>
          </form>
        )}

        {groups.length === 0 ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Nenhum grupo encontrado ainda. Conecte o WhatsApp no worker e clique em “Sincronizar grupos”.
          </p>
        ) : (
          <form action={createCampaignAction} className="mt-3 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-medium text-zinc-500">Nome da campanha</span>
                <input name="name" placeholder="Ex.: Eletrônicos da manhã" className={inputClass} />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-zinc-500">
                  Grupos ({groups.length} em que você é administrador)
                </span>
                <select name="chats" multiple size={5} className={`${inputClass} h-auto`}>
                  {groups.map((g) => (
                    <option key={g.chatId} value={`${g.chatId}|${g.name}`}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <label className="space-y-1">
                <span className="text-xs font-medium text-zinc-500">Categoria</span>
                <select name="categoryId" className={inputClass} defaultValue="">
                  <option value="">Todas</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-zinc-500">Enviar a cada (min)</span>
                <input name="intervalMinutes" type="number" min={15} step={5} defaultValue={60} className={inputClass} />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-zinc-500">Desconto mínimo (%)</span>
                <input name="minDiscount" type="number" min={0} defaultValue={10} className={inputClass} />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-zinc-500" title="Horas até o mesmo produto poder repetir">
                  Reenvio em (horas)
                </span>
                <input name="resendHours" type="number" min={1} defaultValue={24} className={inputClass} />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-[10rem_10rem_9rem_1fr] sm:items-end">
              <label className="space-y-1">
                <span className="text-xs font-medium text-zinc-500">Envia das</span>
                <input name="windowStart" type="time" defaultValue="09:00" className={inputClass} />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-zinc-500">até</span>
                <input name="windowEnd" type="time" defaultValue="21:00" className={inputClass} />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-zinc-500">Produtos por envio</span>
                <input name="productsPerSend" type="number" min={1} defaultValue={1} className={inputClass} />
              </label>
              <p className="text-xs text-zinc-500">
                Dentro dessa faixa a automação envia de intervalo em intervalo, para cada grupo escolhido.
              </p>
            </div>

            <fieldset className="space-y-1">
              <legend className="text-xs font-medium text-zinc-500">Dias da semana</legend>
              <div className="flex flex-wrap gap-3 pt-1">
                {DIAS.map((d, i) => (
                  <label key={d} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" name="weekdays" value={i} defaultChecked={i >= 1 && i <= 5} />
                    {d}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-[10rem_10rem_auto] sm:items-end">
              <label className="space-y-1">
                <span className="text-xs font-medium text-zinc-500">Início</span>
                <input name="startsOn" type="date" defaultValue={hoje} className={inputClass} />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-medium text-zinc-500">Fim (opcional)</span>
                <input name="endsOn" type="date" className={inputClass} />
              </label>
              <button className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-yellow-500 sm:justify-self-start">
                Criar campanha
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Campanhas</h2>
        {campaigns.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
            Nenhuma campanha ainda.
          </p>
        ) : (
          <ul className="space-y-2">
            {campaigns.map((c) => (
              <li
                key={c.id}
                className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {c.name}{" "}
                    {c.devMode && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Dev</span>}{" "}
                    <span className="text-sm font-normal text-zinc-500">
                      → {c.chatNames.length === 1 ? c.chatNames[0] : `${c.chatNames.length} grupos`}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {c.categoryName ?? "Todas as categorias"} · {c.weekdays.map((d) => DIAS[d]).join(", ")} ·{" "}
                    {c.windowStart}–{c.windowEnd} · a cada {c.intervalMinutes}min · {c.productsPerSend} produto(s)/envio ·
                    mín. {c.minDiscount}% · reenvio em {c.resendHours}h ·{" "}
                    {c.startsOn.split("-").reverse().join("/")}
                    {c.endsOn ? ` até ${c.endsOn.split("-").reverse().join("/")}` : " sem data de fim"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <form action={toggleCampaignAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="enabled" value={c.enabled ? "0" : "1"} />
                    <button className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                      {c.enabled ? "Pausar" : "Ativar"}
                    </button>
                  </form>
                  <form action={deleteCampaignAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className="text-sm text-zinc-400 hover:text-red-600">Remover</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Fila de envio</h2>
          <form action={enqueueNowAction}>
            <button className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
              Gerar fila de hoje
            </button>
          </form>
        </div>
        {queue.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
            Fila vazia.
          </p>
        ) : (
          <ul className="space-y-2">
            {queue.map((q) => (
              <li key={q.id} className="rounded-xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <span className={`rounded-full px-2 py-0.5 font-semibold ${statusTone[q.status] ?? statusTone.pending}`}>
                    {q.status}
                  </span>
                  <span>
                    {new Date(q.scheduledAt).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span>
                    {q.campaignName} → {q.chatName}
                  </span>
                </div>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{q.caption}</p>
                {q.error && <p className="mt-1 text-xs text-red-600">{q.error}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
