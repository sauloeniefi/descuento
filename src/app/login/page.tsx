import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AuthForm } from "@/components/auth-form";
import { loginAction } from "../auth-actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { error } = await searchParams;
  return (
    <AuthForm
      title="Entrar"
      action={loginAction}
      error={error}
      submitLabel="Entrar"
      altText="Ainda não tem conta?"
      altHref="/register"
      altLabel="Cadastre-se"
    />
  );
}
