"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  addProduct,
  checkDueProducts,
  removeProduct,
  removeProducts,
  renewFolder,
  renewProducts,
  setAffiliateUrl,
  setProductCategory,
  setShortName,
  setImageIndex,
  setTargetPrice,
  toggleFavorite,
} from "@/lib/tracker/service";
import { createCategory, deleteCategory, updateCategory } from "@/lib/tracker/categories";
import { getSuggestion, scanSuggestions, setSuggestionStatus } from "@/lib/tracker/suggestions";
import {
  createCampaign,
  deleteCampaign,
  enqueueDueSends,
  requestGroupsSync,
  requestQrCode,
  startDevMode,
  setCampaignEnabled,
} from "@/lib/automation/campaigns";
import { createApiToken } from "@/lib/tracker/api-token";
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

export async function setTargetAction(formData: FormData) {
  const user = await requireUser();
  const target = Number(String(formData.get("target") ?? "").replace(",", "."));
  await setTargetPrice(user.id, Number(formData.get("id")), target > 0 ? target : null);
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

// ---- Varredura de produtos parecidos ----

export async function scanSuggestionsAction() {
  const user = await requireUser();
  const { found } = await scanSuggestions(user.id);
  revalidatePath("/sugestoes");
  redirect(`/sugestoes?encontrados=${found}`);
}

export async function approveSuggestionAction(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  const suggestion = await getSuggestion(user.id, id);
  if (!suggestion) return;

  let error: string | null = null;
  try {
    await addProduct(user.id, suggestion.ml_id, null, 1, null, suggestion.category_id);
    await setSuggestionStatus(user.id, id, "approved");
  } catch (e) {
    error = (e as { code?: string }).code === "23505" ? "Você já rastreia esse produto." : (e as Error).message;
  }
  revalidatePath("/sugestoes");
  revalidatePath("/");
  if (error) redirect(`/sugestoes?error=${encodeURIComponent(error)}`);
}

export async function dismissSuggestionAction(formData: FormData) {
  const user = await requireUser();
  await setSuggestionStatus(user.id, Number(formData.get("id")), "dismissed");
  revalidatePath("/sugestoes");
}

// ---- Automação de envio ----

export async function createCampaignAction(formData: FormData) {
  const user = await requireUser();
  const grupos = formData.getAll("chats").map(String).filter(Boolean);
  const chatIds = grupos.map((g) => g.split("|")[0]);
  const chatNames = grupos.map((g) => g.split("|").slice(1).join("|"));
  const weekdays = formData.getAll("weekdays").map(Number).filter((n) => n >= 0 && n <= 6);
  const windowStart = String(formData.get("windowStart") ?? "");
  const windowEnd = String(formData.get("windowEnd") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "") || null;
  const endsOn = String(formData.get("endsOn") ?? "") || null;

  let error: string | null = null;
  const horaValida = /^\d{2}:\d{2}$/;
  if (chatIds.length === 0) error = "Escolha pelo menos um grupo do WhatsApp.";
  else if (weekdays.length === 0) error = "Escolha pelo menos um dia da semana.";
  else if (!horaValida.test(windowStart) || !horaValida.test(windowEnd)) error = "Informe a janela de envio.";
  else if (windowEnd <= windowStart) error = "O fim da janela precisa ser depois do início.";

  if (!error) {
    await createCampaign(user.id, {
      name: String(formData.get("name") ?? "").trim() || chatNames[0],
      chatIds,
      chatNames,
      categoryId,
      weekdays,
      windowStart,
      windowEnd,
      intervalMinutes: Math.max(15, Math.floor(Number(formData.get("intervalMinutes")) || 60)),
      resendHours: Math.max(1, Math.floor(Number(formData.get("resendHours")) || 24)),
      productsPerSend: Math.max(1, Math.floor(Number(formData.get("productsPerSend")) || 1)),
      minDiscount: Math.max(0, Math.floor(Number(formData.get("minDiscount")) || 10)),
      startsOn: String(formData.get("startsOn") ?? "") || new Date().toISOString().slice(0, 10),
      endsOn,
    });
  }

  revalidatePath("/automacao");
  if (error) redirect(`/automacao?error=${encodeURIComponent(error)}`);
}

export async function toggleCampaignAction(formData: FormData) {
  const user = await requireUser();
  await setCampaignEnabled(user.id, Number(formData.get("id")), formData.get("enabled") === "1");
  revalidatePath("/automacao");
}

export async function deleteCampaignAction(formData: FormData) {
  const user = await requireUser();
  await deleteCampaign(user.id, Number(formData.get("id")));
  revalidatePath("/automacao");
}

export async function enqueueNowAction() {
  await requireUser();
  const { queued } = await enqueueDueSends();
  revalidatePath("/automacao");
  redirect(`/automacao?enfileirados=${queued}`);
}

export async function startDevModeAction(formData: FormData) {
  const user = await requireUser();
  const chatId = String(formData.get("chatId") ?? "");
  let queued: number;

  try {
    queued = await startDevMode(user.id, chatId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível iniciar o modo dev.";
    redirect(`/automacao?devError=${encodeURIComponent(message)}`);
  }

  revalidatePath("/automacao");
  redirect(`/automacao?dev=${queued}`);
}

export async function syncGroupsAction() {
  const user = await requireUser();
  await requestGroupsSync(user.id);
  revalidatePath("/automacao");
  redirect(`/automacao?sincronizado=1`);
}

export async function generateQrAction() {
  const user = await requireUser();
  await requestQrCode(user.id);
  revalidatePath("/automacao");
  redirect(`/automacao?qr=1`);
}

// ---- Extensão do Chrome ----

export async function gerarTokenAction() {
  const user = await requireUser();
  const token = await createApiToken(user.id);
  redirect(`/extensao?token=${token}`);
}

// ---- Pastas de produtos ----

const idsSelecionados = (formData: FormData) => formData.getAll("ids").map(Number).filter(Number.isInteger);

export async function renovarProdutosAction(formData: FormData) {
  const user = await requireUser();
  await renewProducts(user.id, idsSelecionados(formData));
  revalidatePath("/produtos");
}

export async function removerProdutosAction(formData: FormData) {
  const user = await requireUser();
  await removeProducts(user.id, idsSelecionados(formData));
  revalidatePath("/produtos");
  revalidatePath("/");
}

export async function renovarPastaAction(formData: FormData) {
  const user = await requireUser();
  await renewFolder(user.id, String(formData.get("categoryId") ?? "") || null);
  revalidatePath("/produtos");
}

export async function favoritarAction(formData: FormData) {
  const user = await requireUser();
  await toggleFavorite(user.id, Number(formData.get("id")));
  revalidatePath("/produtos");
}
