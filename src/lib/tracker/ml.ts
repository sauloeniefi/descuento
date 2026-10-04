export interface MlItem {
  mlId: string;
  title: string;
  url: string;
  thumbnail: string | null;
  price: number;
  originalPrice: number | null;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  const id = process.env.ML_CLIENT_ID;
  const secret = process.env.ML_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error("Defina ML_CLIENT_ID e ML_CLIENT_SECRET no .env.local");
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const res = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: id,
      client_secret: secret,
    }),
  });
  if (!res.ok) throw new Error(`Falha ao obter token do ML (${res.status})`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

export function extractMlId(input: string): string | null {
  const upper = input.toUpperCase();
  const catalog = upper.match(/\/P\/(MLB\d{6,})/);
  if (catalog) return catalog[1];
  const match = upper.match(/MLB-?(\d{6,})/);
  return match ? `MLB${match[1]}` : null;
}

async function mlGet<T>(pathname: string): Promise<T> {
  const token = await getToken();
  const res = await fetch(`https://api.mercadolibre.com${pathname}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 404 && pathname.startsWith("/products/")) {
    throw new Error(
      "Produto não encontrado no catálogo do ML. Links de anúncio avulso (/up/MLBU... ou MLB-123...) não são suportados pela API com o token do app; use um link de catálogo (/p/MLB...) ou a busca.",
    );
  }
  if (!res.ok) throw new Error(`ML API retornou ${res.status} para ${pathname}`);
  return (await res.json()) as T;
}

// O token de app não acessa /items (403); usamos o catálogo, que devolve as ofertas com preço.
export async function fetchItem(mlId: string): Promise<MlItem> {
  const [product, offers] = await Promise.all([
    mlGet<{ id: string; name: string; pictures?: { url: string }[] }>(`/products/${mlId}`),
    mlGet<{ results: { price: number; original_price: number | null; condition: string }[] }>(
      `/products/${mlId}/items`,
    ),
  ]);

  const newOffers = offers.results.filter((o) => o.condition === "new");
  const candidates = newOffers.length > 0 ? newOffers : offers.results;
  if (candidates.length === 0) throw new Error(`Sem ofertas ativas para ${mlId}`);
  const best = candidates.reduce((a, b) => (b.price < a.price ? b : a));

  return {
    mlId: product.id,
    title: product.name,
    url: `https://www.mercadolivre.com.br/p/${product.id}`,
    thumbnail: product.pictures?.[0]?.url ?? null,
    price: best.price,
    originalPrice: best.original_price,
  };
}

export async function fetchPictures(mlId: string): Promise<string[]> {
  const product = await mlGet<{ pictures?: { url: string }[] }>(`/products/${mlId}`);
  return (product.pictures ?? []).map((p) => p.url);
}

export interface MlSearchResult {
  mlId: string;
  title: string;
  url: string;
  price: number;
  /** Preço "de" da melhor oferta, quando o anúncio está com desconto. */
  originalPrice: number | null;
}

export async function searchProducts(query: string, limit = 12): Promise<MlSearchResult[]> {
  const params = new URLSearchParams({ status: "active", site_id: "MLB", limit: String(limit), q: query });
  const data = await mlGet<{ results?: { id: string; name: string }[] }>(`/products/search?${params}`);

  // Muitos produtos de catálogo não têm oferta ativa (404); só listamos os que têm preço.
  const priced = await Promise.allSettled(
    (data.results ?? []).map(async (r): Promise<MlSearchResult> => {
      const offers = await mlGet<{ results: { price: number; original_price: number | null; condition: string }[] }>(
        `/products/${r.id}/items`,
      );
      const news = offers.results.filter((o) => o.condition === "new");
      if (news.length === 0) throw new Error("sem oferta");
      const best = news.reduce((a, b) => (b.price < a.price ? b : a));
      return {
        mlId: r.id,
        title: r.name,
        url: `https://www.mercadolivre.com.br/p/${r.id}`,
        price: best.price,
        originalPrice: best.original_price,
      };
    }),
  );
  return priced.flatMap((p) => (p.status === "fulfilled" ? [p.value] : []));
}

const STOPWORDS = new Set(["de", "da", "do", "com", "para", "por", "e", "em", "a", "o", "as", "os", "un", "kit", "novo", "nova"]);

/**
 * Palavras-chave de um título, para procurar produtos parecidos.
 * Ex.: "Fone de Ouvido Bluetooth JBL Tune 510BT Preto" -> "fone ouvido bluetooth jbl".
 */
export function keywordsFromTitle(title: string, words = 4): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .slice(0, words)
    .join(" ");
}
