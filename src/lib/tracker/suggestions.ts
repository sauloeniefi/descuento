import { getDb } from "./db";
import { keywordsFromTitle, searchProducts } from "./ml";

export interface Suggestion {
  id: number;
  mlId: string;
  title: string;
  url: string;
  price: number;
  originalPrice: number | null;
  discountPercent: number | null;
  categoryId: string | null;
  categoryName: string | null;
  sourceTitle: string | null;
  foundAt: string;
}

/** Quantos produtos da lista servem de semente por varredura. */
const MAX_SEEDS = 20;
/** Resultados olhados por semente. */
const RESULTS_PER_SEED = 8;

export async function listSuggestions(userId: number): Promise<Suggestion[]> {
  const { rows } = await getDb().query(
    `SELECT s.*, c.name AS category_name, p.title AS source_title
       FROM suggestions s
       LEFT JOIN categories c ON c.id = s.category_id
       LEFT JOIN products p ON p.id = s.source_product_id
      WHERE s.user_id = $1 AND s.status = 'pending'
      ORDER BY s.discount_percent DESC NULLS LAST, s.found_at DESC`,
    [userId],
  );

  return rows.map((r) => ({
    id: r.id,
    mlId: r.ml_id,
    title: r.title,
    url: r.url,
    price: r.price,
    originalPrice: r.original_price,
    discountPercent: r.discount_percent,
    categoryId: r.category_id,
    categoryName: r.category_name,
    sourceTitle: r.source_title,
    foundAt: r.found_at.toISOString(),
  }));
}

export async function setSuggestionStatus(userId: number, id: number, status: "approved" | "dismissed") {
  await getDb().query("UPDATE suggestions SET status = $1 WHERE id = $2 AND user_id = $3", [status, id, userId]);
}

export async function getSuggestion(userId: number, id: number) {
  const { rows } = await getDb().query<{ ml_id: string; category_id: string | null; title: string }>(
    "SELECT ml_id, category_id, title FROM suggestions WHERE id = $1 AND user_id = $2",
    [id, userId],
  );
  return rows[0] ?? null;
}

/**
 * Varredura: usa os produtos já rastreados como semente, procura no catálogo do
 * ML itens parecidos que estejam com desconto e guarda como sugestão pendente.
 * Nada entra na lista sem você aprovar.
 */
export async function scanSuggestions(userId: number, minDiscount = 10) {
  const db = getDb();
  const { rows: seeds } = await db.query<{ id: number; title: string; category_id: string | null }>(
    `SELECT id, title, category_id FROM products WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, MAX_SEEDS],
  );
  if (seeds.length === 0) return { seeds: 0, found: 0, errors: [] as string[] };

  const { rows: known } = await db.query<{ ml_id: string }>(
    `SELECT ml_id FROM products WHERE user_id = $1
     UNION SELECT ml_id FROM suggestions WHERE user_id = $1`,
    [userId],
  );
  const skip = new Set(known.map((k) => k.ml_id));

  let found = 0;
  const errors: string[] = [];

  for (const seed of seeds) {
    const query = keywordsFromTitle(seed.title);
    if (!query) continue;
    try {
      const results = await searchProducts(query, RESULTS_PER_SEED);
      for (const r of results) {
        if (skip.has(r.mlId)) continue;
        if (r.originalPrice == null || r.originalPrice <= r.price) continue;
        const discount = Math.round((1 - r.price / r.originalPrice) * 100);
        if (discount < minDiscount) continue;

        await db.query(
          `INSERT INTO suggestions (user_id, ml_id, title, url, price, original_price, discount_percent, category_id, source_product_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (user_id, ml_id) DO NOTHING`,
          [userId, r.mlId, r.title, r.url, r.price, r.originalPrice, discount, seed.category_id, seed.id],
        );
        skip.add(r.mlId);
        found++;
      }
    } catch (e) {
      errors.push(`${seed.title}: ${(e as Error).message}`);
    }
  }

  return { seeds: seeds.length, found, errors };
}

export async function scanAllUsers(minDiscount = 10) {
  const { rows } = await getDb().query<{ id: number }>("SELECT id FROM users");
  let found = 0;
  for (const u of rows) found += (await scanSuggestions(u.id, minDiscount)).found;
  return { users: rows.length, found };
}
