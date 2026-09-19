// Importa os dados antigos (data/tracker.db e data/categories.json) para o Postgres. Pode rodar mais de uma vez.
import { DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const dataDir = path.join(process.cwd(), "data");
const sqlitePath = path.join(dataDir, "tracker.db");
if (!existsSync(sqlitePath)) {
  console.error("data/tracker.db não encontrado, nada para importar.");
  process.exit(1);
}

const categoriesPath = path.join(dataDir, "categories.json");
const categories = existsSync(categoriesPath) ? JSON.parse(readFileSync(categoriesPath, "utf8")) : [];
const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });
const products = sqlite.prepare("SELECT * FROM products ORDER BY id").all();
const history = sqlite.prepare("SELECT * FROM price_history ORDER BY id").all();
const categoryIds = new Set(categories.map((c) => c.id));
const utc = (s) => `${s.replace(" ", "T")}Z`;

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL ?? "postgres://descuento:descuento@localhost:5432/descuento",
});
await client.connect();

try {
  await client.query("BEGIN");
  for (const c of categories) {
    await client.query("INSERT INTO categories (id, name, message) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING", [c.id, c.name, c.message]);
  }
  for (const p of products) {
    await client.query(
      `INSERT INTO products (id, ml_id, title, url, thumbnail, affiliate_url, category_id, target_price, interval_days, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT DO NOTHING`,
      [p.id, p.ml_id, p.title, p.url, p.thumbnail, p.affiliate_url ?? null, categoryIds.has(p.category_id) ? p.category_id : null, p.target_price, p.interval_days, utc(p.created_at)],
    );
  }
  for (const h of history) {
    await client.query(
      "INSERT INTO price_history (id, product_id, price, original_price, checked_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING",
      [h.id, h.product_id, h.price, h.original_price, utc(h.checked_at)],
    );
  }
  await client.query("SELECT setval(pg_get_serial_sequence('products', 'id'), COALESCE((SELECT MAX(id) FROM products), 1))");
  await client.query("SELECT setval(pg_get_serial_sequence('price_history', 'id'), COALESCE((SELECT MAX(id) FROM price_history), 1))");
  await client.query("COMMIT");
  console.log(`importados: ${categories.length} categorias, ${products.length} produtos, ${history.length} preços`);
} catch (e) {
  await client.query("ROLLBACK");
  console.error(`falha na importação: ${e.message}`);
  process.exit(1);
} finally {
  await client.end();
}
