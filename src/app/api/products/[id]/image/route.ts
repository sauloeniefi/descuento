import { getThumbnailUrl } from "@/lib/tracker/service";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response(null, { status: 401 });
  const { id } = await params;
  const url = Number.isInteger(Number(id)) ? await getThumbnailUrl(user.id, Number(id)) : null;
  if (!url) return new Response(null, { status: 404 });

  const upstream = await fetch(url);
  if (!upstream.ok) return new Response(null, { status: 502 });

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
