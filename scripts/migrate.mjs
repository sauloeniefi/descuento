import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const dir = path.join(process.cwd(), "db", "migrations");
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL ?? "postgres://descuento:descuento@localhost:5432/descuento",
});

try {
  await client.connect();
} catch (e) {
  console.error(`Não consegui conectar ao Postgres (${e.message}). Rode: npm run db:up`);
  process.exit(1);
}

await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`);

const applied = new Set((await client.query("SELECT version FROM schema_migrations")).rows.map((r) => r.version));
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

for (const file of files) {
  if (applied.has(file)) continue;
  try {
    await client.query("BEGIN");
    await client.query(readFileSync(path.join(dir, file), "utf8"));
    await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
    await client.query("COMMIT");
    console.log(`migration aplicada: ${file}`);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(`falha em ${file}: ${e.message}`);
    process.exit(1);
  }
}

await client.end();
