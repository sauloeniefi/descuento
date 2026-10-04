"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/auth-actions";

const links = [
  { href: "/", label: "Rastreador" },
  { href: "/categorias", label: "Categorias" },
  { href: "/produtos", label: "Produtos" },
  { href: "/sugestoes", label: "Sugestões" },
  { href: "/cupons", label: "Cupons" },
  { href: "/automacao", label: "Automação" },
  { href: "/extensao", label: "Extensão" },
];

export function Navbar({ username }: { username: string | null }) {
  const pathname = usePathname();
  return (
    <nav className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:gap-6 sm:px-6">
        <span className="font-bold text-zinc-900 dark:text-zinc-50">Descuento</span>
        {username &&
          links.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`text-sm ${active ? "font-semibold text-zinc-900 dark:text-zinc-50" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"}`}
              >
                {l.label}
              </Link>
            );
          })}
        {username && (
          <form action={logoutAction} className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-zinc-500 sm:inline">{username}</span>
            <button className="text-zinc-500 underline hover:text-zinc-900 dark:hover:text-zinc-50">Sair</button>
          </form>
        )}
      </div>
    </nav>
  );
}
