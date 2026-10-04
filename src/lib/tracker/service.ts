import { getDb } from "./db";
import { extractMlId, fetchItem, fetchPictures } from "./ml";
import { analyzePrice, WINDOW_DAYS, type PriceLevel } from "./price-level";

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
  /** Preço "de" da última coleta, quando o anúncio está com desconto. */
  currentOriginalPrice: number | null;
  minPrice: number | null;
  avgPrice: number | null;
  samples: number;
  /** Quando o menor preço de todo o histórico foi coletado. */
  minPriceAt: string | null;
  lastCheckedAt: string | null;
  /** Quando o produto sai da pasta se não for renovado. */
  expiresAt: string | null;
  favorite: boolean;
  opportunity: string | null;
  /** Como o preço atual se compara ao histórico dos últimos 90 dias. */
  level: PriceLevel | null;
  percentile: number | null;
  suggestedTarget: number | null;
  targetWarning: string | null;
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
  current_original_price: number | null;
  min_price: number | null;
  avg_price: number | null;
  samples: number;
  min_price_at: Date | null;
  last_checked_at: Date | null;
  expires_at: Date | null;
  favorite: boolean;
  samples_window: number;
  at_or_below_window: number;
  min_window: number | null;
  p25_window: number | null;
}

export async function listProducts(userId: number): Promise<TrackedProduct[]> {
  const { rows } = await getDb().query<Row>(
    `SELECT p.*,
      (SELECT price FROM price_history WHERE product_id = p.id ORDER BY checked_at DESC, id DESC LIMIT 1) AS current_price,
      (SELECT original_price FROM price_history WHERE product_id = p.id ORDER BY checked_at DESC, id DESC LIMIT 1) AS current_original_price,
      (SELECT MIN(price) FROM price_history WHERE product_id = p.id) AS min_price,
      (SELECT AVG(price) FROM price_history WHERE product_id = p.id) AS avg_price,
      (SELECT COUNT(*) FROM price_history WHERE product_id = p.id) AS samples,
      (SELECT MAX(checked_at) FROM price_history WHERE product_id = p.id) AS last_checked_at,
      (SELECT checked_at FROM price_history WHERE product_id = p.id ORDER BY price, checked_at LIMIT 1) AS min_price_at,
      (SELECT COUNT(*) FROM price_history WHERE product_id = p.id AND checked_at > now() - $2::int * INTERVAL '1 day') AS samples_window,
      (SELECT MIN(price) FROM price_history WHERE product_id = p.id AND checked_at > now() - $2::int * INTERVAL '1 day') AS min_window,
      (SELECT percentile_cont(0.25) WITHIN GROUP (ORDER BY price) FROM price_history
        WHERE product_id = p.id AND checked_at > now() - $2::int * INTERVAL '1 day') AS p25_window,
      (SELECT COUNT(*) FROM price_history h WHERE h.product_id = p.id AND h.checked_at > now() - $2::int * INTERVAL '1 day'
        AND h.price <= (SELECT price FROM price_history WHERE product_id = p.id ORDER BY checked_at DESC, id DESC LIMIT 1)) AS at_or_below_window
     FROM products p WHERE p.user_id = $1 ORDER BY p.created_at DESC`,
    [userId, WINDOW_DAYS],
  );

  return rows.map((r) => {
    const analysis = analyzePrice(
      {
        current: r.current_price,
        samples: r.samples_window,
        atOrBelow: r.at_or_below_window,
        min: r.min_window,
        p25: r.p25_window,
        target: r.target_price,
      },
      r.min_price,
      r.samples,
    );

    return {
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
      currentOriginalPrice: r.current_original_price,
      minPrice: r.min_price,
      avgPrice: r.avg_price,
      samples: r.samples,
      minPriceAt: r.min_price_at?.toISOString() ?? null,
      lastCheckedAt: r.last_checked_at?.toISOString() ?? null,
      expiresAt: r.expires_at?.toISOString() ?? null,
      favorite: r.favorite,
      opportunity: analysis.opportunity,
      level: analysis.level,
      percentile: analysis.percentile,
      suggestedTarget: analysis.suggestedTarget,
      targetWarning: analysis.targetWarning,
    };
  });
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
  categoryId: string | null = null,
) {
  const mlId = extractMlId(input);
  if (!mlId) throw new Error("Não encontrei um ID MLB na URL/código informado");

  const item = await fetchItem(mlId);
  const db = getDb();
  const { rows } = await db.query<{ id: number }>(
    "INSERT INTO products (user_id, ml_id, title, short_name, url, thumbnail, target_price, interval_days, category_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id",
    [userId, item.mlId, item.title, shortName, item.url, item.thumbnail, targetPrice, intervalDays, categoryId],
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

/** Uma pasta é uma categoria sua, com os produtos que estão dentro dela. */
export interface Folder {
  id: string | null;
  name: string;
  total: number;
  expiring: number;
  expired: number;
}

export async function listFolders(userId: number): Promise<Folder[]> {
  const { rows } = await getDb().query(
    `SELECT c.id, c.name,
            count(p.id)::int AS total,
            count(p.id) FILTER (WHERE p.expires_at BETWEEN now() AND now() + INTERVAL '7 days')::int AS expiring,
            count(p.id) FILTER (WHERE p.expires_at < now())::int AS expired
       FROM categories c LEFT JOIN products p ON p.category_id = c.id AND p.user_id = $1
      WHERE c.user_id = $1
      GROUP BY c.id, c.name
      UNION ALL
     SELECT NULL, 'Sem categoria',
            count(*)::int,
            count(*) FILTER (WHERE expires_at BETWEEN now() AND now() + INTERVAL '7 days')::int,
            count(*) FILTER (WHERE expires_at < now())::int
       FROM products WHERE user_id = $1 AND category_id IS NULL
      ORDER BY name`,
    [userId],
  );
  return rows
    .map((r) => ({ id: r.id, name: r.name, total: r.total, expiring: r.expiring, expired: r.expired }))
    .filter((f) => f.id !== null || f.total > 0);
}

/** Renova por mais 30 dias: um produto, vários, ou a pasta inteira. */
export async function renewProducts(userId: number, ids: number[]) {
  if (ids.length === 0) return;
  await getDb().query(
    "UPDATE products SET expires_at = now() + INTERVAL '30 days' WHERE user_id = $1 AND id = ANY($2::int[])",
    [userId, ids],
  );
}

export async function renewFolder(userId: number, categoryId: string | null) {
  await getDb().query(
    `UPDATE products SET expires_at = now() + INTERVAL '30 days'
      WHERE user_id = $1 AND category_id IS NOT DISTINCT FROM $2::uuid`,
    [userId, categoryId],
  );
}

export async function removeProducts(userId: number, ids: number[]) {
  if (ids.length === 0) return;
  await getDb().query("DELETE FROM products WHERE user_id = $1 AND id = ANY($2::int[])", [userId, ids]);
}

export async function toggleFavorite(userId: number, id: number) {
  await getDb().query("UPDATE products SET favorite = NOT favorite WHERE id = $1 AND user_id = $2", [id, userId]);
}

export async function setTargetPrice(userId: number, id: number, targetPrice: number | null) {
  await getDb().query("UPDATE products SET target_price = $1 WHERE id = $2 AND user_id = $3", [targetPrice, id, userId]);
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
