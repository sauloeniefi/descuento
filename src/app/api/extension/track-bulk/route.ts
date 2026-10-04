import { NextResponse } from "next/server";
import { userIdFromToken } from "@/lib/tracker/api-token";
import { addProduct } from "@/lib/tracker/service";
import { extractMlId } from "@/lib/tracker/ml";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Teto por chamada: cada item consulta a API do ML duas vezes. */
const LIMITE = 40;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-descuento-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Resultado = { url: string; status: "ok" | "duplicado" | "erro"; erro?: string };

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}

export async function POST(req: Request) {
  const userId = await userIdFromToken(req.headers.get("x-descuento-token"));
  if (!userId) return NextResponse.json({ error: "token inválido" }, { status: 401, headers: cors });

  const body = (await req.json().catch(() => null)) as { urls?: string[]; categoryId?: string | null } | null;
  const urls = (body?.urls ?? []).filter((u) => typeof u === "string").slice(0, LIMITE);
  if (urls.length === 0) return NextResponse.json({ error: "nenhum produto enviado" }, { status: 400, headers: cors });

  const categoryId = body?.categoryId || null;
  const resultados: Resultado[] = [];

  for (const url of urls) {
    if (!extractMlId(url)) {
      resultados.push({ url, status: "erro", erro: "sem código MLB" });
      continue;
    }
    try {
      await addProduct(userId, url, null, 1, null, categoryId);
      resultados.push({ url, status: "ok" });
    } catch (e) {
      const duplicado = (e as { code?: string }).code === "23505";
      resultados.push({ url, status: duplicado ? "duplicado" : "erro", erro: duplicado ? undefined : (e as Error).message });
    }
  }

  return NextResponse.json(
    {
      adicionados: resultados.filter((r) => r.status === "ok").length,
      duplicados: resultados.filter((r) => r.status === "duplicado").length,
      erros: resultados.filter((r) => r.status === "erro").length,
      resultados,
    },
    { headers: cors },
  );
}
