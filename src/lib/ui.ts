export const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-400/40 dark:border-zinc-700 dark:bg-zinc-900";

export const brl = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
