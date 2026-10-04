export async function register() {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.WA_WORKER_ENABLED === "false"
  ) {
    return;
  }

  const { registerWhatsAppWorker } = await import("./lib/automation/whatsapp-worker-supervisor");
  registerWhatsAppWorker();
}