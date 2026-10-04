"use client";

import { useEffect } from "react";

export function SyncStatusBadge({ syncStatus }: { syncStatus: "Sincronizando" | "Sincronizado" | "Falha na sincronização" | null }) {
  useEffect(() => {
    if (syncStatus !== "Sincronizando") return;

    const timer = window.setTimeout(() => {
      window.location.reload();
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [syncStatus]);

  if (!syncStatus) return null;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        syncStatus === "Sincronizando"
          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
          : syncStatus === "Sincronizado"
            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
            : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
      }`}
    >
      {syncStatus}
    </span>
  );
}
