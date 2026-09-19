"use client";

import { useState } from "react";
import type { Coupon } from "@/lib/coupons/types";

export function CouponCard({ coupon }: { coupon: Coupon }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!coupon.code) return;
    await navigator.clipboard.writeText(coupon.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
            {coupon.discountLabel}
          </span>
          <span className="text-xs text-zinc-400">{coupon.category}</span>
        </div>
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          {coupon.title}
        </h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {coupon.description}
        </p>
      </div>

      <div className="mt-4 flex items-center gap-2">
        {coupon.code ? (
          <button
            onClick={handleCopy}
            className="flex-1 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-left font-mono text-sm text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300"
          >
            {copied ? "Copiado!" : coupon.code}
          </button>
        ) : (
          <span className="flex-1 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
            Sem código — aplica automático
          </span>
        )}
        <a
          href={coupon.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-yellow-500"
        >
          Ver oferta
        </a>
      </div>
    </div>
  );
}
