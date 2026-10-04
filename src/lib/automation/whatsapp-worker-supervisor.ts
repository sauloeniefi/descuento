import { spawn, type ChildProcess } from "node:child_process";

let worker: ChildProcess | undefined;
let restartTimer: NodeJS.Timeout | undefined;
let registered = false;
let stopping = false;

function startWorker() {
  if (stopping) return;

  console.info("Iniciando worker do WhatsApp junto com a aplicação...");
  const currentWorker = spawn(
    process.execPath,
    ["--env-file-if-exists=.env.local", "scripts/whatsapp-worker.mjs"],
    {
      cwd: process.cwd(),
      env: { ...process.env, WORKER_USER_ID: process.env.WORKER_USER_ID ?? "1" },
      stdio: "inherit",
    },
  );
  worker = currentWorker;

  currentWorker.on("error", (error) => {
    console.error("Falha ao iniciar o worker do WhatsApp:", error);
  });

  currentWorker.on("exit", (code, signal) => {
    if (worker === currentWorker) worker = undefined;
    if (stopping) return;

    console.error(`Worker do WhatsApp encerrou (code=${code}, signal=${signal}); nova tentativa em 5s.`);
    restartTimer = setTimeout(startWorker, 5_000);
  });
}

function stopWorker() {
  stopping = true;
  if (restartTimer) clearTimeout(restartTimer);
  worker?.kill("SIGTERM");
}

export function registerWhatsAppWorker() {
  if (registered) return;

  registered = true;
  process.once("SIGINT", stopWorker);
  process.once("SIGTERM", stopWorker);
  process.once("exit", stopWorker);
  startWorker();
}