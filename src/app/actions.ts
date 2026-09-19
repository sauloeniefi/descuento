"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { addProduct, checkDueProducts, removeProduct, setAffiliateUrl, setProductCategory, setShortName, setImageIndex } from "@/lib/tracker/service";
import { createCategory, deleteCategory, updateCategory } from "@/lib/tracker/categories";
import { requireUser } from "@/lib/auth";

export async function addProductAction(formData: FormData) {
  const user = await requireUser();
  const input = String(formData.get("input") ?? "").trim();
  const target = Number(String(formData.get("target") ?? "").replace(",", "."));
  const days = Math.max(1, Math.floor(Number(formData.get("days")) || 1));
  const shortName = String(formData.get("shortName") ?? "").trim() || null;

  let error: string | null = null;
  try {
    await addProduct(user.id, input, target > 0 ? target : null, days, shortName);
  } catch (e) {
    error = (e as { code?: string }).code === "23505" ? "Você já rastreia esse produto." : (e as Error).message;
  }
  revalidatePath("/");
  if (error) redirect(`/?error=${encodeURIComponent(error)}`);
  redirect("/");
}

export async function removeProductAction(formData: FormData) {
  const user = await requireUser();
  await removeProduct(user.id, Number(formData.get("id")));
  revalidatePath("/");
}

export async function checkNowAction() {
  const user = await requireUser();
  await checkDueProducts(true, user.id);
  revalidatePath("/");
}

export async function setAffiliateAction(formData: FormData) {
  const user = await requireUser();
  const raw = String(formData.get("url") ?? "").trim();
  let url: string | null = null;
  if (raw) {
    try {
      const parsed = new URL(raw);
      if (parsed.protocol === "https:" || parsed.protocol === "http:") url = parsed.toString();
    } catch {}
  }
  await setAffiliateUrl(user.id, Number(formData.get("id")), url);
  revalidatePath("/");
}

export async function setShortNameAction(formData: FormData) {
  const user = await requireUser();
  await setShortName(user.id, Number(formData.get("id")), String(formData.get("shortName") ?? "").trim() || null);
  revalidatePath("/");
}

export async function setImageIndexAction(formData: FormData) {
  const user = await requireUser();
  const index = Math.max(1, Math.floor(Number(formData.get("imageIndex")) || 1));
  let error: string | null = null;
  try {
    await setImageIndex(user.id, Number(formData.get("id")), index);
  } catch (e) {
    error = (e as Error).message;
  }
  revalidatePath("/");
  if (error) redirect(`/?error=${encodeURIComponent(error)}`);
}

export async function setProductCategoryAction(formData: FormData) {
  const user = await requireUser();
  const categoryId = String(formData.get("categoryId") ?? "");
  await setProductCategory(user.id, Number(formData.get("id")), categoryId || null);
  revalidatePath("/");
}

export async function createCategoryAction(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (name) await createCategory(user.id, name, String(formData.get("message") ?? "").trim());
  revalidatePath("/categorias");
  revalidatePath("/");
}

export async function updateCategoryAction(formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  if (name) await updateCategory(user.id, String(formData.get("id")), name, String(formData.get("message") ?? "").trim());
  revalidatePath("/categorias");
  revalidatePath("/");
}

export async function deleteCategoryAction(formData: FormData) {
  const user = await requireUser();
  await deleteCategory(user.id, String(formData.get("id")));
  revalidatePath("/categorias");
  revalidatePath("/");
}
