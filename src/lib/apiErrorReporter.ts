import { observeAdminFetch, AUTH_API } from "@/lib/sessionWatch";

/**
 * Reporta al registro de errores lo que el panel no pudo hacer: respuestas con error de /api/admin
 * (con el mensaje exacto que vio la persona) y pedidos que se quedaron sin respuesta.
 *
 * Los reportes se guardan en el navegador y se mandan en tandas. Un pedido sin respuesta casi
 * siempre es falta de internet, y en ese momento tampoco se puede reportar: queda guardado y sale
 * cuando vuelve la conexión, o la próxima vez que se abra el panel.
 */

const ENDPOINT = "/api/admin/error-reports";
const STORAGE_KEY = "vf-error-reports";
const MAX_QUEUE = 50;
const BATCH = 25;
const FLUSH_DELAY_MS = 3000;
/** Si el envío falló (servidor caído con internet), se reintenta cada minuto mientras quede algo. */
const RETRY_DELAY_MS = 60_000;

interface QueuedReport {
  kind: "respuesta" | "sin_conexion";
  method: string;
  path: string;
  status: number | null;
  message: string;
  code: string;
  page: string;
  at: string;
  count: number;
}

let started = false;
let timer: ReturnType<typeof setTimeout> | undefined;
let flushing = false;
/** Respaldo en memoria por si el navegador no deja usar localStorage (modo privado, bloqueado). */
let memoryQueue: QueuedReport[] = [];

function load(): QueuedReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed as QueuedReport[] : [];
  } catch {
    return memoryQueue;
  }
}

function save(queue: QueuedReport[]) {
  const trimmed = queue.slice(-MAX_QUEUE);
  memoryQueue = trimmed;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Queda en memoria.
  }
}

function enqueue(report: Omit<QueuedReport, "at" | "count">) {
  const queue = load();
  const same = queue.find((q) =>
    q.kind === report.kind && q.method === report.method && q.path === report.path &&
    q.status === report.status && q.message === report.message && q.page === report.page);
  if (same) same.count += 1;
  else queue.push({ ...report, at: new Date().toISOString(), count: 1 });
  save(queue);
  schedule();
}

function schedule(delay = FLUSH_DELAY_MS) {
  if (timer) return;
  timer = setTimeout(() => {
    timer = undefined;
    void flush();
  }, delay);
}

async function flush() {
  if (flushing || !navigator.onLine) return;
  const queue = load();
  if (!queue.length) return;
  flushing = true;
  // Se sacan de la cola antes de mandarlos: lo que llegue mientras tanto no se cuenta dos veces.
  const batch = queue.splice(0, BATCH);
  save(queue);
  let requeue = false;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });
    // 401 (sin sesión) y 400 (reporte inválido) no se reintentan.
    requeue = res.status >= 500;
  } catch {
    requeue = true;
  } finally {
    if (requeue) save([...batch, ...load()]);
    flushing = false;
    if (load().length) schedule(requeue ? RETRY_DELAY_MS : FLUSH_DELAY_MS);
  }
}

/** Al esconder la pestaña: lo pendiente sale por sendBeacon, que sobrevive al cierre. */
function beacon() {
  const queue = load();
  if (!queue.length || typeof navigator.sendBeacon !== "function") return;
  const batch = queue.slice(0, BATCH);
  const blob = new Blob([JSON.stringify({ events: batch })], { type: "application/json" });
  if (navigator.sendBeacon(ENDPOINT, blob)) save(queue.slice(BATCH));
}

async function messageOf(response: Response): Promise<{ message: string; code: string }> {
  try {
    // clone() tiene que ir antes de que la pantalla lea el cuerpo: se llama sin esperar nada antes.
    const copy = response.clone();
    if (!(response.headers.get("content-type") ?? "").includes("application/json")) {
      return { message: response.statusText || "", code: "" };
    }
    const data = await copy.json() as { error?: unknown; code?: unknown };
    return {
      message: typeof data?.error === "string" ? data.error : "",
      code: typeof data?.code === "string" ? data.code : "",
    };
  } catch {
    return { message: "", code: "" };
  }
}

/** Arranca el reporte una sola vez por pestaña. */
export function startApiErrorReporting() {
  if (started || typeof window === "undefined") return;
  started = true;

  observeAdminFetch(({ path, method, response, error }) => {
    if (path === ENDPOINT || path.startsWith(AUTH_API)) return;
    const page = window.location.pathname;
    if (response) {
      // 401 es la sesión vencida: tiene su propio aviso en pantalla.
      if (response.status < 400 || response.status === 401) return;
      const status = response.status;
      void messageOf(response).then(({ message, code }) => enqueue({ kind: "respuesta", method, path, status, message, code, page }));
      return;
    }
    if (error instanceof DOMException && error.name === "AbortError") return;
    enqueue({
      kind: "sin_conexion", method, path, status: null, code: "", page,
      message: navigator.onLine ? "El servidor no respondió" : "Sin internet",
    });
  });

  window.addEventListener("online", () => { void flush(); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") beacon();
  });
  // Lo que quedó guardado de la última vez.
  schedule();
}
