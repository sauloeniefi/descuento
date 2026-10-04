import { NextResponse } from "next/server";
import { userIdFromToken } from "@/lib/tracker/api-token";
import { addProduct } from "@/lib/tracker/service";
import { extractMlId } from "@/lib/tracker/ml";

export const dynamic = "force-dynamic";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-descuento-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}

export async function POST(req: Request) {
  const userId = await userIdFromToken(req.headers.get("x-descuento-token"));
  if (!userId) return NextResponse.json({ error: "token inválido" }, { status: 401, headers: cors });

  const body = (await req.json().catch(() => null)) as { url?: string; categoryId?: string; target?: number } | null;
  const url = body?.url?.trim();
  if (!url) return NextResponse.json({ error: "faltou a url" }, { status: 400, headers: cors });
  if (!extractMlId(url)) {
    return NextResponse.json({ error: "não achei um código MLB nessa página" }, { status: 400, headers: cors });
  }

  try {
    await addProduct(userId, url, body?.target ?? null, 1, null, body?.categoryId || null);
  } catch (e) {
    const duplicado = (e as { code?: string }).code === "23505";
    return NextResponse.json(
      { error: duplicado ? "você já rastreia esse produto" : (e as Error).message },
      { status: duplicado ? 409 : 502, headers: cors },
    );
  }

  return NextResponse.json({ ok: true }, { headers: cors });
}
