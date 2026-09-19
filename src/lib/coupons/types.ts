export type CouponSource = "mercadolivre-affiliates" | "awin" | "lomadee" | "manual";

export interface Coupon {
  id: string;
  store: "Mercado Livre";
  title: string;
  description: string;
  code: string | null;
  discountLabel: string;
  category: string;
  url: string;
  source: CouponSource;
  expiresAt: string | null;
  verifiedAt: string;
}

export interface CouponProvider {
  name: CouponSource;
  fetchCoupons(): Promise<Coupon[]>;
}
