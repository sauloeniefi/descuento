import { getDb } from "./db";
import { extractMlId, fetchItem, fetchPictures } from "./ml";

export interface TrackedProduct {
  id: number;
  mlId: string;
  title: string;
  shortName: string | null;
  url: string;
  thumbnail: string | null;
  imageIndex: number;
  affiliateUrl: string | null;
  categoryId: string | null;
  targetPrice: number | null;
  intervalDays: number;
  currentPrice: number | null;
  minPrice: number | null;
  avgPrice: number | null;
  samples: number;
  lastCheckedAt: string | null;
  opportunity: string | null;
}

interface Row {
  id: number;
  ml_id: string;
  title: string;
  short_name: string | null;
  url: string;
  thumbnail: string | null;
  image_index: number;
  affiliate_url: string | null;
  category_id: string | null;
  target_price: number | null;
  interval_days: number;
  current_price: number | null;
  min_price: number | null;
  avg_price: number | null;
  samples: number;
  last_checked_at: Date | null;
}

function detectOpportunity(r: Row): string | null {
  const price = r.current_price;
  if (price == null) return null;
  if (r.target_price != null && price <= r.target_price) return "Abaixo do preço-alvo";
  if (r.samples >= 3 && r.avg_price != null && price <= r.avg_price * 0.9) {
    return `${Math.round((1 - price / r.avg_price) * 100)}% abaixo da média`;
  }
  if (r.samples >= 3 && r.min_price != null && price <= r.min_price) return "Menor preço já registrado";
  return null;
}

export async function listProducts(userId: number): Promise<TrackedProduct[]> {
  const { rows } = await getDb().query<Row>(
    `SELECT p.*,
      (SELECT price FROM price_history WHERE product_id = p.id ORDER BY checked_at DESC, id DESC LIMIT 1) AS current_price,
      (SELECT MIN(price) FROM price_history WHERE product_id = p.id) AS min_price,
      (SELECT AVG(price) FROM price_history WHERE product_id = p.id) AS avg_price,
      (SELECT COUNT(*) FROM price_history WHERE product_id = p.id) AS samples,
      (SELECT MAX(checked_at) FROM price_history WHERE product_id = p.id) AS last_checked_at
     FROM products p WHERE p.user_id = $1 ORDER BY p.created_at DESC`,
    [userId],
  );

  return rows.map((r) => ({
    id: r.id,
    mlId: r.ml_id,
    title: r.title,
    shortName: r.short_name,
    url: r.url,
    thumbnail: r.thumbnail,
    imageIndex: r.image_index,
    affiliateUrl: r.affiliate_url,
    categoryId: r.category_id,
    targetPrice: r.target_price,
    intervalDays: r.interval_days,
    currentPrice: r.current_price,
    minPrice: r.min_price,
    avgPrice: r.avg_price,
    samples: r.samples,
    lastCheckedAt: r.last_checked_at?.toISOString() ?? null,
    opportunity: detectOpportunity(r),
  }));
}

export async function getPriceHistory(productId: number) {
  const { rows } = await getDb().query<{ price: number; checked_at: Date }>(
    "SELECT price, checked_at FROM price_history WHERE product_id = $1 ORDER BY checked_at",
    [productId],
  );
  return rows.map((r) => ({ price: r.price, checkedAt: r.checked_at.toISOString() }));
}

export async function addProduct(
  userId: number,
  input: string,
  targetPrice: number | null,
  intervalDays: number,
  shortName: string | null,
) {
  const mlId = extractMlId(input);
  if (!mlId) throw new Error("Não encontrei um ID MLB na URL/código informado");

  const item = await fetchItem(mlId);
  const db = getDb();
  const { rows } = await db.query<{ id: number }>(
    "INSERT INTO products (user_id, ml_id, title, short_name, url, thumbnail, target_price, interval_days) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
    [userId, item.mlId, item.title, shortName, item.url, item.thumbnail, targetPrice, intervalDays],
  );
  await db.query("INSERT INTO price_history (product_id, price, original_price) VALUES ($1, $2, $3)", [
    rows[0].id,
    item.price,
    item.originalPrice,
  ]);
}

export async function setImageIndex(userId: number, id: number, index: number) {
  const db = getDb();
  const { rows } = await db.query<{ ml_id: string }>("SELECT ml_id FROM products WHERE id = $1 AND user_id = $2", [id, userId]);
  if (!rows[0]) return;
  const pictures = await fetchPictures(rows[0].ml_id);
  if (pictures.length === 0) throw new Error("O anúncio não tem imagens disponíveis.");
  if (index > pictures.length) throw new Error(`O anúncio só tem ${pictures.length} ${pictures.length === 1 ? "imagem" : "imagens"}.`);
  await db.query("UPDATE products SET thumbnail = $1, image_index = $2 WHERE id = $3 AND user_id = $4", [pictures[index - 1], index, id, userId]);
}

export async function getThumbnailUrl(userId: number, id: number): Promise<string | null> {
  const { rows } = await getDb().query<{ thumbnail: string | null }>(
    "SELECT thumbnail FROM products WHERE id = $1 AND user_id = $2",
    [id, userId],
  );
  return rows[0]?.thumbnail ?? null;
}

export async function setAffiliateUrl(userId: number, id: number, url: string | null) {
  await getDb().query("UPDATE products SET affiliate_url = $1 WHERE id = $2 AND user_id = $3", [url, id, userId]);
}

export async function setShortName(userId: number, id: number, shortName: string | null) {
  await getDb().query("UPDATE products SET short_name = $1 WHERE id = $2 AND user_id = $3", [shortName, id, userId]);
}

export async function setProductCategory(userId: number, id: number, categoryId: string | null) {
  await getDb().query(
    `UPDATE products SET category_id = $1 WHERE id = $2 AND user_id = $3
     AND ($1::uuid IS NULL OR EXISTS (SELECT 1 FROM categories WHERE id = $1 AND user_id = $3))`,
    [categoryId, id, userId],
  );
}

export async function removeProduct(userId: number, id: number) {
  await getDb().query("DELETE FROM products WHERE id = $1 AND user_id = $2", [id, userId]);
}

export async function checkDueProducts(force = false, userId: number | null = null) {
  const db = getDb();
  const { rows: due } = await db.query<{ id: number; ml_id: string }>(
    `SELECT p.id, p.ml_id FROM products p WHERE ($2::int IS NULL OR p.user_id = $2) AND ($1::boolean OR COALESCE(
       (SELECT EXTRACT(EPOCH FROM (now() - MAX(checked_at))) / 86400 FROM price_history WHERE product_id = p.id), 999
     ) >= p.interval_days - 0.05)`,
    [force, userId],
  );

  let checked = 0;
  const errors: string[] = [];
  for (const p of due) {
    try {
      const item = await fetchItem(p.ml_id);
      await db.query("INSERT INTO price_history (product_id, price, original_price) VALUES ($1, $2, $3)", [
        p.id,
        item.price,
        item.originalPrice,
      ]);
      checked++;
    } catch (e) {
      errors.push(`${p.ml_id}: ${(e as Error).message}`);
    }
  }
  return { checked, errors };
}
