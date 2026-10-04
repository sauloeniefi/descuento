/**
 * Worker de envio no WhatsApp.
 *
 * ATENÇÃO: usa whatsapp-web.js, que controla o WhatsApp Web com o SEU número.
 * Isso é contra os termos de uso do WhatsApp e pode levar ao bloqueio do
 * número. A API oficial da Meta não resolve: ela só envia em grupos criados
 * pela própria API, com no máximo 8 participantes.
 *
 * O que ele faz:
 *   1. pede o QR code na primeira execução (a sessão fica em .wwebjs_auth/);
 *   2. grava a lista dos seus grupos na tabela wa_groups;
 *   3. a cada minuto, envia os itens vencidos da tabela send_queue.
 *
 * O worker é iniciado e supervisionado pelo servidor Next.js.
 */
import pg from "pg";
import qrcode from "qrcode-terminal";
import wweb from "whatsapp-web.js";

const { Client, LocalAuth, MessageMedia } = wweb;

const USER_ID = Number(process.env.WORKER_USER_ID ?? 1);
/** Pausa entre dois envios: sorteada nesse intervalo, em segundos. */
const DELAY_MIN = Number(process.env.WA_DELAY_MIN ?? 45);
const DELAY_MAX = Number(process.env.WA_DELAY_MAX ?? 180);
/** Teto de mensagens enviadas por hora, somando todas as campanhas. */
const MAX_POR_HORA = Number(process.env.WA_MAX_PER_HOUR ?? 12);
/** Máximo de mensagens por rodada (a cada minuto). */
const LOTE = Number(process.env.WA_BATCH ?? 3);
/** Ajuste para o WhatsApp terminar de sincronizar o histórico antes de processar fila. */
const WAIT_AFTER_READY_MS = Number(process.env.WA_WAIT_AFTER_READY_MS ?? 30_000);
/** Intervalo em que o worker procura jobs pendentes de sincronização de grupos. */
const SYNC_POLL_INTERVAL_MS = Number(process.env.WA_SYNC_POLL_INTERVAL_MS ?? 15_000);
/** Máximo de tempo total de retry para sincronização de grupos: 10 minutos. */
const MAX_SYNC_RETRY_WINDOW_MS = Number(process.env.WA_MAX_SYNC_RETRY_WINDOW_MS ?? 10 * 60_000);
/** Tempo de espera entre tentativas de sincronização. */
const SYNC_RETRY_DELAY_MS = Number(process.env.WA_SYNC_RETRY_DELAY_MS ?? 15_000);
/** Item atrasado além disso é descartado, para não despejar tudo de uma vez. */
const ATRASO_MAXIMO_HORAS = 2;

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL ?? "postgres://descuento:descuento@localhost:5432/descuento",
});
await db.connect();

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: ".wwebjs_auth" }),
  puppeteer: { args: ["--no-sandbox"] },
});
let clientInitialized = false;
let qrJobProcessing = false;
let syncJobProcessing = false;
let loopsStarted = false;

async function initializeClient() {
  await client.initialize();
  clientInitialized = true;
}

client.on("qr", async (qr) => {
  console.log("Leia o QR code no WhatsApp do celular (Aparelhos conectados):");
  qrcode.generate(qr, { small: true });
  try {
    await salvarQrCode(USER_ID, qr);
    console.log("QR salvo no banco para a tela de automação.");
  } catch (e) {
    console.error(`Falha ao salvar QR no banco: ${erroParaTexto(e)}`);
  }
});

client.on("ready", async () => {
  console.log("WhatsApp conectado.");
  console.log(`Aguardando ${WAIT_AFTER_READY_MS / 1000}s para o WhatsApp terminar de sincronizar conversas...`);
  await new Promise((resolve) => setTimeout(resolve, WAIT_AFTER_READY_MS));
  await testarConexaoDb();
  await verificarSyncJobs();
  await enviarPendentes();
  if (!loopsStarted) {
    loopsStarted = true;
    setInterval(verificarSyncJobs, SYNC_POLL_INTERVAL_MS);
    setInterval(enviarPendentes, 60_000);
  }
});

client.on("disconnected", (motivo) => console.error(`WhatsApp desconectou: ${motivo}`));

function erroParaTexto(e) {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  if (e && typeof e === "object") {
    const parts = [];
    if (e.message) parts.push(String(e.message));
    if (e.code) parts.push(`code=${e.code}`);
    if (e.detail) parts.push(`detail=${e.detail}`);
    if (e.table) parts.push(`table=${e.table}`);
    if (e.constraint) parts.push(`constraint=${e.constraint}`);
    return parts.join(" | ") || JSON.stringify(e);
  }
  return String(e);
}

function detalhesErro(e) {
  if (e instanceof Error) {
    return { name: e.name, message: e.message, stack: e.stack, cause: e.cause };
  }
  if (e && typeof e === "object") {
    return Object.fromEntries(
      Object.getOwnPropertyNames(e).map((key) => [key, e[key]]),
    );
  }
  return { type: typeof e, value: e, json: JSON.stringify(e) };
}

async function testarConexaoDb() {
  try {
    const { rows: dbInfo } = await db.query("SELECT current_database() AS db, current_user AS user, now() AS ts");
    console.log("DB OK:", dbInfo[0]);

    const { rows: tables } = await db.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name IN ('users', 'wa_groups', 'campaigns', 'send_queue')
       ORDER BY table_name`,
    );
    console.log("Tabelas relevantes:", tables.map((row) => row.table_name));
  } catch (e) {
    console.error("Erro ao verificar conexão com o banco:", erroParaTexto(e));
  }
}

async function sincronizarGrupos(userId = USER_ID) {
  const startedAt = Date.now();
  let tentativa = 0;
  let ultimaFalha;

  while (Date.now() - startedAt < MAX_SYNC_RETRY_WINDOW_MS) {
    tentativa += 1;
    try {
      const meuNumero = client.info?.wid?._serialized;
      console.log(`Sincronizando grupos (tentativa ${tentativa}, janela ${Math.round((Date.now() - startedAt) / 1000)}s, user_id=${userId})...`);
      let resultado;
      try {
        resultado = await client.pupPage.evaluate(() => {
          const chats = window.require("WAWebCollections").Chat.getModelsArray();
          const { toPn } = window.require("WAWebLidMigrationUtils");
          const groups = [];
          const errors = [];

          for (const chat of chats) {
            if (!chat.groupMetadata) continue;

            const chatId = chat.id?._serialized;
            try {
              const metadata = chat.groupMetadata.serialize();
              groups.push({
                chatId,
                name: chat.name || chat.formattedTitle || metadata.subject || chatId,
                participants: (metadata.participants || []).map((participant) => {
                  const convertedId = toPn(participant.id) ?? participant.id;
                  return {
                    id: typeof convertedId === "string" ? convertedId : convertedId?._serialized,
                    isAdmin: Boolean(participant.isAdmin),
                    isSuperAdmin: Boolean(participant.isSuperAdmin),
                  };
                }),
              });
            } catch (error) {
              errors.push({ chatId, error: error instanceof Error ? error.message : String(error) });
            }
          }

          return { groups, errors };
        });
      } catch (error) {
        console.error("Falha ao ler grupos sincronizados do WhatsApp Web:", detalhesErro(error));
        throw error;
      }
      const grupos = resultado.groups;
      if (resultado.errors.length) {
        console.warn(`Não foi possível ler metadados de ${resultado.errors.length} grupos:`, resultado.errors);
      }
      let admin = 0;

      for (const g of grupos) {
        // Em grupo onde você não é admin o WhatsApp pode recusar o envio, então
        // o site só oferece os que você administra.
        const eu = g.participants.find((p) => p.id === meuNumero);
        const ehAdmin = Boolean(eu?.isAdmin || eu?.isSuperAdmin);
        if (ehAdmin) admin++;

        await db.query(
          `INSERT INTO wa_groups (user_id, chat_id, name, is_admin, updated_at) VALUES ($1, $2, $3, $4, now())
           ON CONFLICT (user_id, chat_id) DO UPDATE SET name = EXCLUDED.name, is_admin = EXCLUDED.is_admin, updated_at = now()`,
          [userId, g.chatId, g.name, ehAdmin],
        );
      }
      console.log(`${grupos.length} grupos sincronizados (${admin} em que você é administrador).`);
      return;
    } catch (e) {
      ultimaFalha = e;
      const msg = erroParaTexto(e);
      const elapsed = Date.now() - startedAt;
      const remaining = MAX_SYNC_RETRY_WINDOW_MS - elapsed;
      if (remaining > 0) {
        console.warn(`Falha ao sincronizar grupos (tentativa ${tentativa}): ${msg}. Próxima tentativa em ${Math.min(SYNC_RETRY_DELAY_MS, remaining) / 1000}s (máximo 10 min total).`);
        if (tentativa === 1) console.error("Detalhes completos da falha de sincronização:", detalhesErro(e));
        await new Promise((resolve) => setTimeout(resolve, Math.min(SYNC_RETRY_DELAY_MS, remaining)));
        continue;
      }

      console.error(`Falha ao sincronizar grupos após até 10 minutos de retry: ${msg}`);
      console.error("Detalhes da exceção no banco/WhatsApp:", detalhesErro(e));
      throw e;
    }
  }

  console.warn(`Sincronização de grupos interrompida após 10 minutos de retry.`);
  throw ultimaFalha ?? new Error("Sincronização de grupos excedeu o tempo máximo de retry.");
}

async function salvarQrCode(userId, qr) {
  await db.query("INSERT INTO wa_qr_codes (user_id, qr_code) VALUES ($1, $2)", [userId, qr]);
}

async function verificarSyncJobs() {
  if (syncJobProcessing) return;
  syncJobProcessing = true;
  let jobId;

  try {
    const { rows } = await db.query(
      `UPDATE wa_sync_jobs
          SET status = 'processing', started_at = now(), error = NULL
        WHERE id = (
          SELECT id FROM wa_sync_jobs
           WHERE status = 'pending'
           ORDER BY requested_at ASC
           LIMIT 1
           FOR UPDATE SKIP LOCKED
        )
        RETURNING id, user_id`,
    );

    if (!rows.length) return;

    const job = rows[0];
    console.log(`Job de sincronização de grupos solicitado para user_id=${job.user_id}.`);
    jobId = job.id;
    await sincronizarGrupos(Number(job.user_id));
    await db.query("UPDATE wa_sync_jobs SET status = 'done', processed_at = now(), error = NULL WHERE id = $1", [job.id]);
    console.log(`Sincronização de grupos concluída para user_id=${job.user_id}.`);
  } catch (e) {
    const msg = erroParaTexto(e);
    console.error(`Falha ao processar job de sincronização de grupos: ${msg}`);
    if (jobId !== undefined) try {
      await db.query(
        "UPDATE wa_sync_jobs SET status = 'failed', processed_at = now(), error = $2 WHERE id = $1",
        [jobId, msg],
      );
    } catch (updateError) {
      console.error("Falha ao salvar o estado de erro do job de sincronização:", detalhesErro(updateError));
    }
  } finally {
    syncJobProcessing = false;
  }
}

async function verificarQrJobs() {
  if (!clientInitialized || qrJobProcessing) return;
  qrJobProcessing = true;

  try {
    const { rows } = await db.query(
      `SELECT id, user_id FROM wa_qr_jobs
       WHERE status = 'pending'
       ORDER BY requested_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
    );

    if (!rows.length) return;

    const job = rows[0];
    await db.query("UPDATE wa_qr_jobs SET status = 'processing', processed_at = now() WHERE id = $1", [job.id]);
    console.log(`Job de QR solicitado para user_id=${job.user_id}. Removendo a sessão salva e gerando outro QR...`);

    clientInitialized = false;
    await client.destroy();
    await client.authStrategy.logout();
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    await initializeClient();
    await db.query("UPDATE wa_qr_jobs SET status = 'done', processed_at = now(), error = NULL WHERE id = $1", [job.id]);
    console.log(`Nova sessão de QR iniciada para user_id=${job.user_id}.`);
  } catch (e) {
    const msg = erroParaTexto(e);
    console.error(`Falha ao processar job de QR: ${msg}`);
    try {
      const { rows } = await db.query("SELECT id FROM wa_qr_jobs WHERE status = 'processing' ORDER BY requested_at DESC LIMIT 1");
      if (rows.length) await db.query("UPDATE wa_qr_jobs SET status = 'failed', error = $2, processed_at = now() WHERE id = $1", [rows[0].id, msg]);
    } catch {}
  } finally {
    qrJobProcessing = false;
  }
}

let enviando = false;

async function enviarPendentes() {
  if (enviando) return;
  enviando = true;
  try {
    // Descarta o que ficou muito atrasado (worker desligado, por exemplo).
    await db.query(
      `UPDATE send_queue SET status = 'skipped', error = 'atrasado demais'
        WHERE status = 'pending' AND scheduled_at < now() - ($1::int * INTERVAL '1 hour')`,
      [ATRASO_MAXIMO_HORAS],
    );

    const { rows: ultimaHora } = await db.query(
      "SELECT count(*)::int AS total FROM send_queue WHERE status = 'sent' AND sent_at > now() - INTERVAL '1 hour'",
    );
    const restanteNaHora = MAX_POR_HORA - ultimaHora[0].total;
    if (restanteNaHora <= 0) {
      console.log("teto de mensagens por hora atingido; esperando.");
      return;
    }

    const { rows } = await db.query(
      `SELECT q.id, q.chat_id, q.caption, q.image_url, c.dev_mode
         FROM send_queue q JOIN campaigns c ON c.id = q.campaign_id
        WHERE q.status = 'pending' AND q.scheduled_at <= now()
        ORDER BY q.scheduled_at LIMIT $1`,
      [Math.min(LOTE, restanteNaHora)],
    );

    for (const item of rows) {
      try {
        if (item.image_url) {
          const media = await MessageMedia.fromUrl(item.image_url, { unsafeMime: true });
          await client.sendMessage(item.chat_id, media, {
            caption: item.caption,
            linkPreview: false,
            sendSeen: false,
          });
        } else {
          await client.sendMessage(item.chat_id, item.caption, {
            linkPreview: false,
            sendSeen: false,
          });
        }
        await db.query("UPDATE send_queue SET status = 'sent', sent_at = now() WHERE id = $1", [item.id]);
        console.log(`enviado: ${item.id}`);
      } catch (e) {
        const msg = erroParaTexto(e);
        await db.query("UPDATE send_queue SET status = 'failed', error = $2 WHERE id = $1", [item.id, msg]);
        console.error(`falha no envio ${item.id} (chat_id=${item.chat_id}, media=${Boolean(item.image_url)}): ${msg}`);
        console.error("Detalhes completos do erro de envio:", detalhesErro(e));
      }
      const pausaMs = item.dev_mode
        ? 60_000
        : (DELAY_MIN + Math.random() * Math.max(0, DELAY_MAX - DELAY_MIN)) * 1000;
      await new Promise((r) => setTimeout(r, pausaMs));
    }
  } finally {
    enviando = false;
  }
}

let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  await client.destroy();
  await db.end();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

setInterval(verificarQrJobs, SYNC_POLL_INTERVAL_MS);
initializeClient();
