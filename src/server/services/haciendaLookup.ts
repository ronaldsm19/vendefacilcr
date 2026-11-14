import { isIdType, type IdType } from "@/lib/customerId";

/**
 * Consulta pública de Hacienda por número de identificación (la misma que usan los facturadores
 * para llenar el receptor). No pide credenciales y solo recibe la cédula, que en ese servicio es un
 * dato público: nunca se le manda nombre, correo ni nada más del cliente.
 *
 * Respuesta probada el 13/11/2026: { nombre, tipoIdentificacion, regimen: { descripcion },
 * situacion: { estado }, actividades: [{ estado, tipo, codigo, descripcion }] }. Una cédula que no
 * existe responde 400 (y a veces 404).
 */

const HACIENDA_AE_URL = "https://api.hacienda.go.cr/fe/ae";
const TIMEOUT_MS = 5000;

export interface HaciendaActivity {
  code: string;
  name: string;
  /** Principal ("P") o secundaria ("S"). */
  primary: boolean;
}

export type HaciendaLookup =
  | {
      status: "found";
      name: string;
      idType: IdType | null;
      regime: string;
      /** "Inscrito", "No inscrito"... */
      taxStatus: string;
      activities: HaciendaActivity[];
    }
  | { status: "not_found" }
  | { status: "unavailable"; reason: string };

interface RawActivity {
  estado?: string;
  tipo?: string;
  codigo?: string | number;
  descripcion?: string;
}

interface RawResponse {
  nombre?: string;
  tipoIdentificacion?: string;
  regimen?: { descripcion?: string };
  situacion?: { estado?: string };
  actividades?: RawActivity[];
}

/** Recibe el número ya normalizado (solo dígitos). Nunca lanza: si Hacienda falla, "unavailable". */
export async function lookupHacienda(digits: string): Promise<HaciendaLookup> {
  let res: Response;
  try {
    res = await fetch(`${HACIENDA_AE_URL}?identificacion=${encodeURIComponent(digits)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    return { status: "unavailable", reason: timedOut ? "Hacienda tardó demasiado en responder" : "No se pudo conectar con Hacienda" };
  }

  if (res.status === 400 || res.status === 404) return { status: "not_found" };
  if (!res.ok) return { status: "unavailable", reason: `Hacienda respondió ${res.status}` };

  let data: RawResponse;
  try {
    data = (await res.json()) as RawResponse;
  } catch {
    return { status: "unavailable", reason: "Hacienda devolvió una respuesta que no se entiende" };
  }

  const name = String(data.nombre ?? "").replace(/\s+/g, " ").trim();
  if (!name) return { status: "not_found" };

  const activities = (Array.isArray(data.actividades) ? data.actividades : [])
    .filter((a) => (a.estado ?? "A") === "A" && a.codigo !== undefined && a.codigo !== "")
    .map((a) => ({
      code: String(a.codigo).trim(),
      name: String(a.descripcion ?? "").trim(),
      primary: a.tipo === "P",
    }))
    // La principal primero: es la que se propone en el formulario.
    .sort((a, b) => Number(b.primary) - Number(a.primary));

  return {
    status: "found",
    name,
    idType: isIdType(data.tipoIdentificacion) ? data.tipoIdentificacion : null,
    regime: String(data.regimen?.descripcion ?? "").trim(),
    taxStatus: String(data.situacion?.estado ?? "").trim(),
    activities,
  };
}
