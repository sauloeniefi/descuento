"use server";

import { redirect } from "next/navigation";
import { login, logout, register } from "@/lib/auth";

const fail = (path: string, message: string): never => redirect(`${path}?error=${encodeURIComponent(message)}`);

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const user = await login(username, password);
  if (!user) fail("/login", "Usuário ou senha inválidos.");
  redirect("/");
}

export async function registerAction(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!/^[A-Za-z0-9_.-]{3,32}$/.test(username)) {
    fail("/register", "O usuário deve ter de 3 a 32 caracteres: letras, números, ponto, hífen ou sublinhado.");
  }
  if (password.length < 8) fail("/register", "A senha deve ter pelo menos 8 caracteres.");
  if (password !== confirm) fail("/register", "As senhas não conferem.");

  try {
    await register(username, password);
  } catch (e) {
    fail("/register", (e as Error).message);
  }
  redirect("/");
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}
