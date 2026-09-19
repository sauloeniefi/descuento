"use client";

import { useState } from "react";

async function toPng(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("png"))), "image/png"));
}

export function ShareButton({ productId, imageIndex, hasImage, message, isAffiliate }: { productId: number; imageIndex: number; hasImage: boolean; message: string; isAffiliate: boolean }) {
  const [status, setStatus] = useState<string | null>(null);

  async function handleShare() {
    let image: Blob | null = null;
    if (hasImage) {
      try {
        const res = await fetch(`/api/products/${productId}/image?v=${imageIndex}`);
        if (res.ok) image = await res.blob();
      } catch {}
    }

    try {
      const file = image ? new File([image], "produto.jpg", { type: image.type }) : null;
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: message });
        return;
      }
      if (navigator.share) {
        await navigator.share({ text: message });
        return;
      }
      if (image && typeof ClipboardItem !== "undefined") {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              "image/png": toPng(image),
              "text/plain": new Blob([message], { type: "text/plain" }),
            }),
          ]);
          setStatus("Imagem e mensagem copiadas!");
          setTimeout(() => setStatus(null), 2500);
          return;
        } catch {}
      }
      await navigator.clipboard.writeText(message);
      setStatus("Mensagem copiada!");
    } catch {
      return;
    }
    setTimeout(() => setStatus(null), 2500);
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        onClick={handleShare}
        className="rounded-lg bg-yellow-400 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-yellow-500"
      >
        Compartilhar
      </button>
      {status && <span className="text-xs text-green-700">{status}</span>}
      {!isAffiliate && <span className="text-xs text-zinc-400">sem link de afiliado</span>}
    </div>
  );
}
