import { NextResponse } from "next/server";
import { userIdFromToken } from "@/lib/tracker/api-token";
import { listCategories } from "@/lib/tracker/categories";

export const dynamic = "force-dynamic";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-descuento-token",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}

export async function GET(req: Request) {
  const userId = await userIdFromToken(req.headers.get("x-descuento-token"));
  if (!userId) return NextResponse.json({ error: "token inválido" }, { status: 401, headers: cors });
  const categories = await listCategories(userId);
  return NextResponse.json(
    categories.map((c) => ({ id: c.id, name: c.name })),
    { headers: cors },
  );
}
