import { brl } from "@/lib/ui";

export interface CaptionInput {
  title: string;
  shortName: string | null;
  price: number;
  originalPrice: number | null;
  minPrice: number | null;
  url: string;
  affiliateUrl: string | null;
  categoryMessage: string | null;
}

/**
 * Legenda da promoção, por modelo de texto (sem IA): chamada, preço de/por,
 * desconto e link. A mensagem da categoria, quando existe, abre o texto.
 */
export function buildCaption(p: CaptionInput): string {
  const nome = p.shortName?.trim() || p.title;
  const desconto =
    p.originalPrice != null && p.originalPrice > p.price ? Math.round((1 - p.price / p.originalPrice) * 100) : null;

  const linhas: string[] = [];
  if (p.categoryMessage?.trim()) linhas.push(p.categoryMessage.trim());

  linhas.push(desconto != null ? `🔥 *${nome}* — ${desconto}% OFF` : `🔥 *${nome}*`);

  if (p.originalPrice != null && p.originalPrice > p.price) {
    linhas.push(`De ~${brl(p.originalPrice)}~ por *${brl(p.price)}*`);
  } else {
    linhas.push(`Por *${brl(p.price)}*`);
  }

  if (p.minPrice != null && p.price <= p.minPrice) linhas.push("📉 Menor preço que já vi neste produto");

  linhas.push(p.affiliateUrl ?? p.url);
  return linhas.join("\n\n");
}
