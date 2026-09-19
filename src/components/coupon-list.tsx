"use client";

import { useMemo, useState } from "react";
import type { Coupon } from "@/lib/coupons/types";
import { CouponCard } from "./coupon-card";

export function CouponList({ coupons }: { coupons: Coupon[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todas");

  const categories = useMemo(
    () => ["Todas", ...new Set(coupons.map((c) => c.category))],
    [coupons],
  );

  const filtered = useMemo(() => {
    return coupons.filter((c) => {
      const matchesQuery = c.title.toLowerCase().includes(query.toLowerCase());
      const matchesCategory = category === "Todas" || c.category === category;
      return matchesQuery && matchesCategory;
    });
  }, [coupons, query, category]);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          placeholder="Buscar cupom..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhum cupom encontrado.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((coupon) => (
            <CouponCard key={coupon.id} coupon={coupon} />
          ))}
        </div>
      )}
    </div>
  );
}
