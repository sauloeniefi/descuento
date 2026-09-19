import type { Coupon, CouponProvider } from "../types";

const MOCK_COUPONS: Coupon[] = [
  {
    id: "mock-1",
    store: "Mercado Livre",
    title: "10% OFF em Eletrônicos",
    description: "Cupom válido para produtos selecionados de eletrônicos.",
    code: "ELETRO10",
    discountLabel: "10% OFF",
    category: "Eletrônicos",
    url: "https://www.mercadolivre.com.br",
    source: "manual",
    expiresAt: null,
    verifiedAt: new Date().toISOString(),
  },
  {
    id: "mock-2",
    store: "Mercado Livre",
    title: "Frete grátis em compras acima de R$ 99",
    description: "Frete grátis para compras elegíveis acima de R$ 99.",
    code: null,
    discountLabel: "Frete grátis",
    category: "Geral",
    url: "https://www.mercadolivre.com.br",
    source: "manual",
    expiresAt: null,
    verifiedAt: new Date().toISOString(),
  },
  {
    id: "mock-3",
    store: "Mercado Livre",
    title: "R$ 20 OFF na primeira compra",
    description: "Desconto de R$ 20 para novos usuários em compras acima de R$ 100.",
    code: "BEMVINDO20",
    discountLabel: "R$ 20 OFF",
    category: "Novos usuários",
    url: "https://www.mercadolivre.com.br",
    source: "manual",
    expiresAt: null,
    verifiedAt: new Date().toISOString(),
  },
];

export const mockProvider: CouponProvider = {
  name: "manual",
  async fetchCoupons() {
    return MOCK_COUPONS;
  },
};
