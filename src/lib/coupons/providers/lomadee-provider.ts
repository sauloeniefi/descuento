import type { Coupon, CouponProvider } from "../types";

// Lomadee API — feed de cupons por loja. Docs: https://developer.lomadee.com
//
// Necessário em .env.local:
//   LOMADEE_APP_TOKEN=...
//   LOMADEE_SOURCE_ID=...
//   LOMADEE_MERCADOLIVRE_STORE_ID=... (id da loja Mercado Livre no catálogo Lomadee)
const APP_TOKEN = process.env.LOMADEE_APP_TOKEN;
const SOURCE_ID = process.env.LOMADEE_SOURCE_ID;
const STORE_ID = process.env.LOMADEE_MERCADOLIVRE_STORE_ID;

interface LomadeeCoupon {
  id: number;
  name: string;
  description: string;
  code: string | null;
  discount: string;
  link: string;
  expiration: string | null;
}

export const lomadeeProvider: CouponProvider = {
  name: "lomadee",
  async fetchCoupons(): Promise<Coupon[]> {
    if (!APP_TOKEN || !SOURCE_ID || !STORE_ID) {
      return [];
    }

    const url = `https://api.lomadee.com/v3/${APP_TOKEN}/coupon/_source/${SOURCE_ID}?storeId=${STORE_ID}`;

    const res = await fetch(url, { next: { revalidate: 3600 } });

    if (!res.ok) {
      console.error(`[lomadee] falha ao buscar cupons: ${res.status}`);
      return [];
    }

    const data = (await res.json()) as { coupons?: { coupon: LomadeeCoupon }[] };

    return (data.coupons ?? []).map(({ coupon }) => ({
      id: `lomadee-${coupon.id}`,
      store: "Mercado Livre",
      title: coupon.name,
      description: coupon.description,
      code: coupon.code,
      discountLabel: coupon.discount || "Cupom",
      category: "Geral",
      url: coupon.link,
      source: "lomadee",
      expiresAt: coupon.expiration,
      verifiedAt: new Date().toISOString(),
    }));
  },
};
