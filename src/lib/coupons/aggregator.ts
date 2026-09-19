import type { Coupon } from "./types";
import { awinProvider } from "./providers/awin-provider";
import { lomadeeProvider } from "./providers/lomadee-provider";
import { mockProvider } from "./providers/mock-provider";

const providers = [awinProvider, lomadeeProvider];

function dedupe(coupons: Coupon[]): Coupon[] {
  const seen = new Map<string, Coupon>();
  for (const coupon of coupons) {
    const key = coupon.code ? `code:${coupon.code}` : `title:${coupon.title}`;
    if (!seen.has(key)) seen.set(key, coupon);
  }
  return [...seen.values()];
}

export async function getAllCoupons(): Promise<Coupon[]> {
  const results = await Promise.allSettled(providers.map((p) => p.fetchCoupons()));

  const coupons = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

  if (coupons.length === 0) {
    // Nenhum provedor de afiliados configurado ainda: usa dados de exemplo
    // para que o site continue navegável em desenvolvimento.
    return mockProvider.fetchCoupons();
  }

  return dedupe(coupons).sort((a, b) => a.title.localeCompare(b.title));
}
