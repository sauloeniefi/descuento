import { getDb } from "@/lib/tracker/db";
import { listProducts, type TrackedProduct } from "@/lib/tracker/service";
import { buildCaption } from "@/lib/promo/caption";

/** Fuso usado para interpretar os horários das campanhas. */
export const TIMEZONE = "America/Sao_Paulo";
/** Intervalo mínimo aceito entre dois envios, em minutos. */
export const INTERVALO_MINIMO = 15;

export interface Campaign {
  id: number;
  name: string;
  devMode: boolean;
  chatIds: string[];
  chatNames: string[];
  categoryId: string | null;
  categoryName: string | null;
  weekdays: number[];
  /** Faixa do dia em que a automação roda (HH:MM). */
  windowStart: string;
  windowEnd: string;
  /** De quantos em quantos minutos ela envia dentro da faixa. */
  intervalMinutes: number;
  /** Horas até o mesmo produto poder repetir nesta automação. */
  resendHours: number;
  productsPerSend: number;
  minDiscount: number;
  startsOn: string;
  endsOn: string | null;
  enabled: boolean;
}

export interface WaGroup {
  chatId: string;
  name: string;
  updatedAt: string;
}

export interface QueueItem {
  id: number;
  campaignName: string;
  chatName: string;
  caption: string;
  scheduledAt: string;
  status: string;
  sentAt: string | null;
  error: string | null;
}

/** Só grupos em que você é administrador — nos outros o envio seria recusado. */
export async function listGroups(userId: number): Promise<WaGroup[]> {
  const { rows } = await getDb().query<{ chat_id: string; name: string; updated_at: Date }>(
    "SELECT chat_id, name, updated_at FROM wa_groups WHERE user_id = $1 AND is_admin ORDER BY name",
    [userId],
  );
  return rows.map((r) => ({ chatId: r.chat_id, name: r.name, updatedAt: r.updated_at.toISOString() }));
}

export async function requestGroupsSync(userId: number) {
  await getDb().query("INSERT INTO wa_sync_jobs (user_id, status) VALUES ($1, 'pending')", [userId]);
}

export async function requestQrCode(userId: number) {
  const client = await getDb().connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM wa_qr_jobs WHERE user_id = $1 AND status = 'pending'", [userId]);
    await client.query("DELETE FROM wa_qr_codes WHERE user_id = $1", [userId]);
    await client.query("INSERT INTO wa_qr_jobs (user_id, status) VALUES ($1, 'pending')", [userId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listSyncStatus(userId: number): Promise<{ status: "Sincronizando" | "Sincronizado" | "Falha na sincronização"; error: string | null } | null> {
  const { rows } = await getDb().query<{ status: string; error: string | null }>(
    `SELECT CASE
              WHEN status = 'processing' AND started_at < now() - INTERVAL '12 minutes' THEN 'failed'
              ELSE status
            END AS status,
            CASE
              WHEN status = 'processing' AND started_at < now() - INTERVAL '12 minutes'
                THEN COALESCE(error, 'O worker parou antes de concluir a sincronização.')
              ELSE error
            END AS error
       FROM wa_sync_jobs WHERE user_id = $1 ORDER BY requested_at DESC LIMIT 1`,
    [userId],
  );

  const row = rows[0];
  if (!row) return null;
  if (row.status === "pending" || row.status === "processing") return { status: "Sincronizando", error: null };
  if (row.status === "done") return { status: "Sincronizado", error: null };
  if (row.status === "failed") return { status: "Falha na sincronização", error: row.error };
  return null;
}

export async function listLatestQrCode(userId: number): Promise<string | null> {
  const { rows } = await getDb().query<{ qr_code: string }>(
    "SELECT qr_code FROM wa_qr_codes WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
    [userId],
  );
  return rows[0]?.qr_code ?? null;
}

export async function listCampaigns(userId: number): Promise<Campaign[]> {
  const { rows } = await getDb().query(
    `SELECT c.*, cat.name AS category_name FROM campaigns c
       LEFT JOIN categories cat ON cat.id = c.category_id
      WHERE c.user_id = $1 ORDER BY c.created_at DESC`,
    [userId],
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    devMode: r.dev_mode,
    chatIds: r.chat_ids,
    chatNames: r.chat_names,
    categoryId: r.category_id,
    categoryName: r.category_name,
    weekdays: r.weekdays,
    windowStart: String(r.window_start).slice(0, 5),
    windowEnd: String(r.window_end).slice(0, 5),
    intervalMinutes: r.interval_minutes,
    resendHours: r.resend_hours,
    productsPerSend: r.products_per_send,
    minDiscount: r.min_discount,
    startsOn: r.starts_on.toISOString().slice(0, 10),
    endsOn: r.ends_on ? r.ends_on.toISOString().slice(0, 10) : null,
    enabled: r.enabled,
  }));
}

export async function createCampaign(userId: number, c: Omit<Campaign, "id" | "categoryName" | "enabled" | "devMode">) {
  await getDb().query(
    `INSERT INTO campaigns (user_id, name, chat_ids, chat_names, category_id, weekdays, window_start, window_end, interval_minutes, resend_hours, products_per_send, min_discount, starts_on, ends_on)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      userId,
      c.name,
      c.chatIds,
      c.chatNames,
      c.categoryId,
      c.weekdays,
      c.windowStart,
      c.windowEnd,
      c.intervalMinutes,
      c.resendHours,
      c.productsPerSend,
      c.minDiscount,
      c.startsOn,
      c.endsOn,
    ],
  );
}

export async function startDevMode(userId: number, chatId: string): Promise<number> {
  const { rows: groups } = await getDb().query<{ name: string }>(
    "SELECT name FROM wa_groups WHERE user_id = $1 AND chat_id = $2 AND is_admin",
    [userId, chatId],
  );
  if (!groups[0]) throw new Error("Selecione um grupo sincronizado em que você é administrador.");

  const products = (await listProducts(userId))
    .filter((product) => product.currentPrice != null)
    .filter((product) => product.expiresAt == null || new Date(product.expiresAt).getTime() > Date.now())
    .sort((a, b) => Number(b.favorite) - Number(a.favorite));
  if (products.length === 0) throw new Error("Não há produtos ativos com preço coletado para enviar.");

  const { rows: categories } = await getDb().query<{ id: string; message: string }>(
    "SELECT id, message FROM categories WHERE user_id = $1",
    [userId],
  );

  const db = getDb();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE send_queue q SET status = 'cancelled', error = 'Substituído por uma nova execução do modo dev'
        FROM campaigns c
       WHERE q.campaign_id = c.id AND c.user_id = $1 AND c.dev_mode AND q.status = 'pending'`,
      [userId],
    );
    await client.query("UPDATE campaigns SET enabled = false WHERE user_id = $1 AND dev_mode AND enabled", [userId]);

    const { rows: created } = await client.query<{ id: number }>(
      `INSERT INTO campaigns
         (user_id, name, chat_ids, chat_names, category_id, weekdays, window_start, window_end,
          interval_minutes, resend_hours, products_per_send, min_discount, starts_on, ends_on, dev_mode)
       VALUES ($1, $2, ARRAY[$3]::text[], ARRAY[$4]::text[], NULL, ARRAY[0,1,2,3,4,5,6],
          '00:00', '23:59', 1, 24, 1, 0, current_date, current_date, true)
       RETURNING id`,
      [userId, `Modo dev - ${groups[0].name}`, chatId, groups[0].name],
    );
    const campaignId = created[0].id;

    for (const [index, product] of products.entries()) {
      const caption = buildCaption({
        title: product.title,
        shortName: product.shortName,
        price: product.currentPrice!,
        originalPrice: product.currentOriginalPrice,
        minPrice: product.minPrice,
        url: product.url,
        affiliateUrl: product.affiliateUrl,
        categoryMessage: categories.find((category) => category.id === product.categoryId)?.message ?? null,
      });
      await client.query(
        `INSERT INTO send_queue (campaign_id, product_id, chat_id, caption, image_url, scheduled_at)
         VALUES ($1, $2, $3, $4, $5, date_trunc('minute', now()) + ($6::int * INTERVAL '1 minute'))`,
        [campaignId, product.id, chatId, caption, product.thumbnail, index + 1],
      );
    }

    await client.query("COMMIT");
    return products.length;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function setCampaignEnabled(userId: number, id: number, enabled: boolean) {
  const db = getDb();
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE campaigns SET enabled = $1 WHERE id = $2 AND user_id = $3", [enabled, id, userId]);
    if (!enabled) {
      await client.query(
        `UPDATE send_queue SET status = 'cancelled', error = 'Modo dev pausado'
          WHERE campaign_id = $1 AND status = 'pending'
            AND EXISTS (SELECT 1 FROM campaigns WHERE id = $1 AND user_id = $2 AND dev_mode)`,
        [id, userId],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteCampaign(userId: number, id: number) {
  await getDb().query("DELETE FROM campaigns WHERE id = $1 AND user_id = $2", [id, userId]);
}

export async function listQueue(userId: number, limit = 30): Promise<QueueItem[]> {
  const { rows } = await getDb().query(
    `SELECT q.id, q.caption, q.scheduled_at, q.status, q.sent_at, q.error, c.name AS campaign_name,
            COALESCE(g.name, q.chat_id) AS chat_name
       FROM send_queue q
       JOIN campaigns c ON c.id = q.campaign_id
       LEFT JOIN wa_groups g ON g.chat_id = q.chat_id AND g.user_id = c.user_id
      WHERE c.user_id = $1 ORDER BY q.scheduled_at DESC LIMIT $2`,
    [userId, limit],
  );
  return rows.map((r) => ({
    id: r.id,
    campaignName: r.campaign_name,
    chatName: r.chat_name,
    caption: r.caption,
    scheduledAt: r.scheduled_at.toISOString(),
    status: r.status,
    sentAt: r.sent_at ? r.sent_at.toISOString() : null,
    error: r.error,
  }));
}

/** Desconto do anúncio agora (preço "de" contra preço atual). */
function discountOf(p: TrackedProduct): number {
  if (p.currentPrice == null || p.currentOriginalPrice == null || p.currentOriginalPrice <= p.currentPrice) return 0;
  return Math.round((1 - p.currentPrice / p.currentOriginalPrice) * 100);
}

const minutos = (hhmm: string) => {
  const [h, m] = hhmm.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
};

/**
 * Horários do dia: do início ao fim da faixa, de intervalo em intervalo.
 * O que já passou fica de fora.
 */
export function horariosDoDia(windowStart: string, windowEnd: string, intervalMinutes: number, agoraMin: number): number[] {
  const inicio = minutos(windowStart);
  const fim = minutos(windowEnd);
  const passo = Math.max(INTERVALO_MINIMO, intervalMinutes);
  const horarios: number[] = [];
  for (let m = inicio; m <= fim; m += passo) if (m > agoraMin) horarios.push(m);
  return horarios;
}

/**
 * Monta a fila do dia: para cada automação ativa que cai hoje, percorre os
 * horários da faixa e escolhe os produtos, um envio por grupo. É idempotente —
 * automação que já tem fila hoje é pulada.
 */
export async function enqueueDueSends() {
  const db = getDb();
  const { rows: campaigns } = await db.query(
    `SELECT c.*, u.id AS owner
       FROM campaigns c JOIN users u ON u.id = c.user_id
      WHERE c.enabled
        AND c.starts_on <= (now() AT TIME ZONE $1)::date
        AND (c.ends_on IS NULL OR c.ends_on >= (now() AT TIME ZONE $1)::date)
        AND EXTRACT(DOW FROM (now() AT TIME ZONE $1))::int = ANY (c.weekdays)`,
    [TIMEZONE],
  );

  const { rows: relogio } = await db.query<{ min: number }>(
    `SELECT (EXTRACT(HOUR FROM now() AT TIME ZONE $1) * 60 + EXTRACT(MINUTE FROM now() AT TIME ZONE $1))::int AS min`,
    [TIMEZONE],
  );
  const agoraMin = relogio[0].min;

  const produtosPorUsuario = new Map<number, TrackedProduct[]>();
  let queued = 0;

  for (const c of campaigns) {
    const { rows: jaTemHoje } = await db.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM send_queue
        WHERE campaign_id = $1 AND (scheduled_at AT TIME ZONE $2)::date = (now() AT TIME ZONE $2)::date`,
      [c.id, TIMEZONE],
    );
    if (jaTemHoje[0].total > 0) continue;

    const horarios = horariosDoDia(c.window_start, c.window_end, c.interval_minutes, agoraMin);
    const grupos: string[] = c.chat_ids ?? [];
    if (horarios.length === 0 || grupos.length === 0) continue;

    if (!produtosPorUsuario.has(c.owner)) produtosPorUsuario.set(c.owner, await listProducts(c.owner));

    const { rows: recentes } = await db.query<{ product_id: number }>(
      `SELECT DISTINCT product_id FROM send_queue
        WHERE campaign_id = $1 AND scheduled_at > now() - ($2::int * INTERVAL '1 hour')`,
      [c.id, c.resend_hours],
    );
    const jaEnviados = new Set(recentes.map((r) => r.product_id));
    const agora = Date.now();

    const candidatos = (produtosPorUsuario.get(c.owner) ?? [])
      .filter((p) => p.currentPrice != null)
      .filter((p) => p.expiresAt == null || new Date(p.expiresAt).getTime() > agora)
      .filter((p) => c.category_id == null || p.categoryId === c.category_id)
      .filter((p) => discountOf(p) >= c.min_discount || p.opportunity != null)
      .filter((p) => !jaEnviados.has(p.id))
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || discountOf(b) - discountOf(a));

    if (candidatos.length === 0) continue;

    const { rows: mensagens } = await db.query<{ id: string; message: string }>(
      "SELECT id, message FROM categories WHERE user_id = $1",
      [c.owner],
    );

    for (const minuto of horarios) {
      const escolhidos = candidatos.splice(0, c.products_per_send);
      if (escolhidos.length === 0) break;

      for (const p of escolhidos) {
        const caption = buildCaption({
          title: p.title,
          shortName: p.shortName,
          price: p.currentPrice!,
          originalPrice: p.currentOriginalPrice,
          minPrice: p.minPrice,
          url: p.url,
          affiliateUrl: p.affiliateUrl,
          categoryMessage: mensagens.find((m) => m.id === p.categoryId)?.message ?? null,
        });

        for (const chatId of grupos) {
          const { rowCount } = await db.query(
            `INSERT INTO send_queue (campaign_id, product_id, chat_id, caption, image_url, scheduled_at)
             VALUES ($1, $2, $3, $4, $5, ((now() AT TIME ZONE $6)::date + make_interval(mins => $7)) AT TIME ZONE $6)
             ON CONFLICT (campaign_id, chat_id, product_id, scheduled_at) DO NOTHING`,
            [c.id, p.id, chatId, caption, p.thumbnail, TIMEZONE, minuto],
          );
          queued += rowCount ?? 0;
        }
      }
    }
  }

  return { campaigns: campaigns.length, queued };
}
