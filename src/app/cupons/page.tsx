import { getAllCoupons } from "@/lib/coupons/aggregator";
import { CouponList } from "@/components/coupon-list";
import { requireUser } from "@/lib/auth";

export const revalidate = 3600;

export default async function Home() {
  await requireUser();
  const coupons = await getAllCoupons();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            Cupons Mercado Livre
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Cupons de desconto do Mercado Livre, atualizados a partir de redes
            de afiliados parceiras.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <CouponList coupons={coupons} />
      </main>

      <footer className="mx-auto max-w-6xl px-6 py-8 text-xs text-zinc-400">
        Este site pode ganhar comissão de afiliado nas ofertas exibidas. Os
        cupons são de terceiros e sua validade é responsabilidade do
        anunciante.
      </footer>
    </div>
  );
}
