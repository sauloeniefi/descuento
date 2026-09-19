import Link from "next/link";
import { inputClass } from "@/lib/ui";

export function AuthForm({
  title,
  action,
  error,
  withConfirm,
  submitLabel,
  altText,
  altHref,
  altLabel,
}: {
  title: string;
  action: (formData: FormData) => void | Promise<void>;
  error?: string;
  withConfirm?: boolean;
  submitLabel: string;
  altText: string;
  altHref: string;
  altLabel: string;
}) {
  return (
    <div className="flex min-h-[calc(100vh-49px)] items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <div className="w-full max-w-sm space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{title}</h1>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">{error}</p>
        )}
        <form action={action} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-500">Usuário</span>
            <input name="username" required autoComplete="username" autoFocus className={inputClass} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-zinc-500">Senha</span>
            <input
              name="password"
              type="password"
              required
              minLength={withConfirm ? 8 : undefined}
              autoComplete={withConfirm ? "new-password" : "current-password"}
              className={inputClass}
            />
          </label>
          {withConfirm && (
            <label className="block space-y-1">
              <span className="text-xs font-medium text-zinc-500">Confirmar senha</span>
              <input name="confirm" type="password" required autoComplete="new-password" className={inputClass} />
            </label>
          )}
          <button className="w-full rounded-lg bg-yellow-400 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-yellow-500">
            {submitLabel}
          </button>
        </form>
        <p className="text-center text-sm text-zinc-500">
          {altText}{" "}
          <Link href={altHref} className="font-medium text-zinc-900 underline dark:text-zinc-50">
            {altLabel}
          </Link>
        </p>
      </div>
    </div>
  );
}
