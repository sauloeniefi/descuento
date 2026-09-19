import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AuthForm } from "@/components/auth-form";
import { registerAction } from "../auth-actions";

export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { error } = await searchParams;
  return (
    <AuthForm
      title="Criar conta"
      action={registerAction}
      error={error}
      withConfirm
      submitLabel="Cadastrar"
      altText="Já tem conta?"
      altHref="/login"
      altLabel="Entrar"
    />
  );
}
