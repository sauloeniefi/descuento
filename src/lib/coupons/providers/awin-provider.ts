import type { Coupon, CouponProvider } from "../types";

// Awin Publisher API — cupons/promoções de anunciantes (ex: Mercado Livre) para quem
// está aprovado no programa de afiliados. Docs: https://developer.awin.com
//
// Necessário em .env.local:
//   AWIN_API_TOKEN=...        (token OAuth2 da conta de publisher)
//   AWIN_PUBLISHER_ID=...     (id do publisher)
//   AWIN_MERCADOLIVRE_ADVERTISER_ID=... (id do anunciante Mercado Livre no Awin, se aprovado)
const API_TOKEN = process.env.AWIN_API_TOKEN;
const PUBLISHER_ID = process.env.AWIN_PUBLISHER_ID;
const ADVERTISER_ID = process.env.AWIN_MERCADOLIVRE_ADVERTISER_ID;

interface AwinPromotion {
  promotionId: number;
  title: string;
  description: string;
  voucherCode: string | null;
  type: string;
  urlTracking: string;
  endDate: string | null;
}

export const awinProvider: CouponProvider = {
  name: "awin",
  async fetchCoupons(): Promise<Coupon[]> {
    if (!API_TOKEN || !PUBLISHER_ID || !ADVERTISER_ID) {
      return [];
    }

    const url = `https://api.awin.com/publishers/${PUBLISHER_ID}/promotions?advertiserId=${ADVERTISER_ID}&membership=joined`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${API_TOKEN}` },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      console.error(`[awin] falha ao buscar promoções: ${res.status}`);
      return [];
    }

    const data = (await res.json()) as AwinPromotion[];

    return data.map((promo) => ({
      id: `awin-${promo.promotionId}`,
      store: "Mercado Livre",
      title: promo.title,
      description: promo.description,
      code: promo.voucherCode,
      discountLabel: promo.voucherCode ? "Cupom" : "Oferta",
      category: promo.type || "Geral",
      url: promo.urlTracking,
      source: "awin",
      expiresAt: promo.endDate,
      verifiedAt: new Date().toISOString(),
    }));
  },
};
