"use client";

import { useRef, useState } from "react";
import { generateQrAction } from "@/app/actions";

export function GenerateQrButton({ hasExistingQr }: { hasExistingQr: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form action={generateQrAction} ref={formRef}>
      <button
        type="button"
        onClick={() => {
          if (hasExistingQr) setConfirming(true);
          else formRef.current?.requestSubmit();
        }}
        className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm text-violet-700 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-900/20 dark:text-violet-200 dark:hover:bg-violet-900/30"
      >
        Gerar Novo QR
      </button>

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setConfirming(false);
          }}
        >
          <section
            aria-labelledby="qr-confirm-title"
            aria-modal="true"
            className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            role="dialog"
          >
            <h2 className="text-base font-semibold" id="qr-confirm-title">
              Gerar um novo QR Code?
            </h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
              Já existe um QR Code salvo. A sessão atual do WhatsApp será reiniciada para solicitar outro.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                onClick={() => setConfirming(false)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700"
                type="submit"
              >
                Gerar novo QR
              </button>
            </div>
          </section>
        </div>
      )}
    </form>
  );
}