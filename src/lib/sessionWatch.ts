/**
 * Avisa cuando el panel se quedó sin sesión.
 *
 * Casi todas las pantallas hacen `if (!res.ok) return;` y siguen mostrando lo último que cargaron,
 * así que una sesión muerta no se nota: la pantalla se ve igual y solo falla al apretar un botón,
 * con un "No autorizado" suelto que se lee como si el dato que uno escribió estuviera mal. Pasó con
 * el marcaje de jornada: PIN correcto, mensaje de error, y la cajera creyendo que era su PIN.
 *
 * En vez de tocar cada `fetch` del panel, se envuelve el global una sola vez y se mira el estado de
 * las respuestas de /api/admin. No cambia la respuesta ni el pedido: solo avisa.
 */

type Listener = () => void;

const listeners = new Set<Listener>();
let patched = false;

const ADMIN_API = "/api/admin/";
/** El login responde 401 con la contraseña equivocada y `me` ya lo maneja el guardia del shell. */
const AUTH_API = "/api/admin/auth/";

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

function isAdminApi(input: RequestInfo | URL): boolean {
  const path = pathOf(input);
  return path.startsWith(ADMIN_API) && !path.startsWith(AUTH_API);
}

function patch() {
  const original = window.fetch;
  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const response = await original.apply(this, args);
    if (response.status === 401 && isAdminApi(args[0])) {
      for (const listener of listeners) listener();
    }
    return response;
  };
}

/**
 * Llama a `listener` cuando una petición del panel responda 401. Devuelve la función para dejar de
 * escuchar. El envoltorio del fetch se instala una sola vez y se queda: quitarlo y ponerlo con cada
 * montaje correría el riesgo de pisar otro envoltorio instalado después.
 */
export function watchUnauthorized(listener: Listener): () => void {
  listeners.add(listener);
  if (!patched && typeof window !== "undefined") {
    patch();
    patched = true;
  }
  return () => { listeners.delete(listener); };
}
