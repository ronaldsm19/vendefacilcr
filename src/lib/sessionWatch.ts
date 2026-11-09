/**
 * Mira las respuestas de /api/admin que pide el panel.
 *
 * Casi todas las pantallas hacen `if (!res.ok) return;` y siguen mostrando lo último que cargaron,
 * así que una sesión muerta no se nota: la pantalla se ve igual y solo falla al apretar un botón,
 * con un "No autorizado" suelto que se lee como si el dato que uno escribió estuviera mal. Pasó con
 * el marcaje de jornada: PIN correcto, mensaje de error, y la cajera creyendo que era su PIN.
 *
 * En vez de tocar cada `fetch` del panel, se envuelve el global una sola vez y se avisa a quien
 * escuche (la sesión vencida, el registro de errores). No cambia la respuesta ni el pedido: si el
 * pedido falla, el error se relanza igual.
 */

export interface AdminFetchResult {
  path: string;
  method: string;
  durationMs: number;
  /** La respuesta, si llegó. */
  response?: Response;
  /** El error de `fetch`, si no llegó ninguna respuesta (sin internet, servidor caído, abortado). */
  error?: unknown;
}

type Observer = (result: AdminFetchResult) => void;

const observers = new Set<Observer>();
let patched = false;

const ADMIN_API = "/api/admin/";
/** El login responde 401 con la contraseña equivocada y `me` ya lo maneja el guardia del shell. */
export const AUTH_API = "/api/admin/auth/";

function pathOf(input: RequestInfo | URL): string {
  try {
    const url = typeof input === "string" ? input
      : input instanceof URL ? input.href
      : input.url;
    return new URL(url, window.location.origin).pathname;
  } catch {
    return "";
  }
}

function methodOf(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== "undefined" && input instanceof Request) return input.method.toUpperCase();
  return "GET";
}

function notify(result: AdminFetchResult) {
  for (const observer of observers) {
    try {
      observer(result);
    } catch {
      // Un observador roto no puede afectar al pedido de la pantalla.
    }
  }
}

function patch() {
  const original = window.fetch;
  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const path = pathOf(args[0]);
    if (!path.startsWith(ADMIN_API)) return original.apply(this, args);
    const method = methodOf(args[0], args[1]);
    const started = performance.now();
    try {
      const response = await original.apply(this, args);
      notify({ path, method, durationMs: performance.now() - started, response });
      return response;
    } catch (error) {
      notify({ path, method, durationMs: performance.now() - started, error });
      throw error;
    }
  };
}

/**
 * Llama a `observer` con cada pedido del panel a /api/admin que termine (con respuesta o sin ella).
 * Devuelve la función para dejar de escuchar. El envoltorio se instala una sola vez y se queda:
 * quitarlo y ponerlo con cada montaje correría el riesgo de pisar otro envoltorio instalado después.
 */
export function observeAdminFetch(observer: Observer): () => void {
  observers.add(observer);
  if (!patched && typeof window !== "undefined") {
    patch();
    patched = true;
  }
  return () => { observers.delete(observer); };
}

/** Llama a `listener` cuando una petición del panel responda 401 (fuera del login). */
export function watchUnauthorized(listener: () => void): () => void {
  return observeAdminFetch(({ path, response }) => {
    if (response?.status === 401 && !path.startsWith(AUTH_API)) listener();
  });
}
