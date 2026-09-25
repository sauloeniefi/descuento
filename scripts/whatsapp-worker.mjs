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
 * Antes de rodar:
 *   npm i whatsapp-web.js qrcode-terminal
 *   WORKER_USER_ID=1 npm run whatsapp
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

client.on("qr", (qr) => {
  console.log("Leia o QR code no WhatsApp do celular (Aparelhos conectados):");
  qrcode.generate(qr, { small: true });
});

client.on("ready", async () => {
  console.log("WhatsApp conectado.");
  await sincronizarGrupos();
  await enviarPendentes();
  setInterval(enviarPendentes, 60_000);
  setInterval(sincronizarGrupos, 30 * 60_000);
});

client.on("disconnected", (motivo) => console.error(`WhatsApp desconectou: ${motivo}`));

async function sincronizarGrupos() {
  try {
    const meuNumero = client.info?.wid?._serialized;
    const chats = await client.getChats();
    const grupos = chats.filter((c) => c.isGroup);
    let admin = 0;

    for (const g of grupos) {
      // Em grupo onde você não é admin o WhatsApp pode recusar o envio, então
      // o site só oferece os que você administra.
      const eu = (g.participants ?? []).find((p) => p.id?._serialized === meuNumero);
      const ehAdmin = Boolean(eu?.isAdmin || eu?.isSuperAdmin);
      if (ehAdmin) admin++;

      await db.query(
        `INSERT INTO wa_groups (user_id, chat_id, name, is_admin, updated_at) VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (user_id, chat_id) DO UPDATE SET name = EXCLUDED.name, is_admin = EXCLUDED.is_admin, updated_at = now()`,
        [USER_ID, g.id._serialized, g.name, ehAdmin],
      );
    }
    console.log(`${grupos.length} grupos sincronizados (${admin} em que você é administrador).`);
  } catch (e) {
    console.error(`Falha ao sincronizar grupos: ${e.message}`);
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
      `SELECT id, chat_id, caption, image_url FROM send_queue
        WHERE status = 'pending' AND scheduled_at <= now()
        ORDER BY scheduled_at LIMIT $1`,
      [Math.min(LOTE, restanteNaHora)],
    );

    for (const item of rows) {
      try {
        if (item.image_url) {
          const media = await MessageMedia.fromUrl(item.image_url, { unsafeMime: true });
          await client.sendMessage(item.chat_id, media, { caption: item.caption });
        } else {
          await client.sendMessage(item.chat_id, item.caption);
        }
        await db.query("UPDATE send_queue SET status = 'sent', sent_at = now() WHERE id = $1", [item.id]);
        console.log(`enviado: ${item.id}`);
      } catch (e) {
        await db.query("UPDATE send_queue SET status = 'failed', error = $2 WHERE id = $1", [item.id, e.message]);
        console.error(`falha no envio ${item.id}: ${e.message}`);
      }
      const pausa = DELAY_MIN + Math.random() * Math.max(0, DELAY_MAX - DELAY_MIN);
      await new Promise((r) => setTimeout(r, pausa * 1000));
    }
  } finally {
    enviando = false;
  }
}

process.on("SIGINT", async () => {
  await client.destroy();
  await db.end();
  process.exit(0);
});

client.initialize();
