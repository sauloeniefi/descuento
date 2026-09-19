"use client";

import { setProductCategoryAction } from "@/app/actions";
import type { Category } from "@/lib/tracker/categories";
import { inputClass } from "@/lib/ui";

export function CategorySelect({ productId, categoryId, categories }: { productId: number; categoryId: string | null; categories: Category[] }) {
  return (
    <form action={setProductCategoryAction}>
      <input type="hidden" name="id" value={productId} />
      <select
        name="categoryId"
        defaultValue={categoryId ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={inputClass}
      >
        <option value="">Sem categoria</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </form>
  );
}
