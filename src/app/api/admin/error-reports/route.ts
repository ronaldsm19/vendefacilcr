import { NextRequest, NextResponse, after } from "next/server";
import { getSession } from "@/lib/auth";
import { recordErrorEvents, type ErrorEventInput } from "@/server/services/errorEvents";
import { checkErrorAlerts } from "@/server/services/errorAlerts";

/**
 * Reportes de errores que manda el panel desde el navegador (src/lib/apiErrorReporter.ts):
 * respuestas con error de /api/admin y pedidos que se quedaron sin respuesta. El negocio y la
 * persona salen de la sesión, nunca del cuerpo.
 */

const MAX_EVENTS = 25;
const METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);
const MAX_AGE_MS = 7 * 24 * 3_600_000;

function parseEvent(raw: unknown, now: number): ErrorEventInput | null {
  if (typeof raw !== "object" || raw === null) return null;
  const e = raw as Record<string, unknown>;
  if (e.kind !== "respuesta" && e.kind !== "sin_conexion") return null;
  const method = typeof e.method === "string" ? e.method.toUpperCase() : "";
  if (!METHODS.has(method)) return null;
  if (typeof e.path !== "string" || !e.path.startsWith("/api/")) return null;

  let status: number | null = null;
  if (e.kind === "respuesta") {
    if (typeof e.status !== "number" || !Number.isInteger(e.status) || e.status < 400 || e.status > 599) return null;
    status = e.status;
  }
  const at = typeof e.at === "string" ? Date.parse(e.at) : NaN;
  const count = typeof e.count === "number" && Number.isFinite(e.count) ? e.count : 1;
  return {
    source: "navegador",
    kind: e.kind,
    method,
    route: e.path,
    status,
    message: typeof e.message === "string" ? e.message : "",
    code: typeof e.code === "string" ? e.code : "",
    page: typeof e.page === "string" ? e.page : "",
    // Los que se quedaron guardados sin conexión llegan tarde: se respeta su hora, con límites.
    at: Number.isFinite(at) && at <= now + 5 * 60_000 && at >= now - MAX_AGE_MS ? new Date(at) : new Date(now),
    count,
  };
}

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const raw = Array.isArray(body?.events) ? body.events.slice(0, MAX_EVENTS) : null;
  if (!raw) return NextResponse.json({ error: "Se espera { events: [...] }" }, { status: 400 });

  const now = Date.now();
  const events = raw.map((e: unknown) => parseEvent(e, now)).filter((e: ErrorEventInput | null): e is ErrorEventInput => e !== null);
  if (events.length) {
    const ctx = {
      tenantId: session.tenantId,
      tenantSlug: session.tenantSlug,
      userName: session.name,
      userRole: session.role,
      userAgent: request.headers.get("user-agent") ?? "",
    };
    // Responder ya: el navegador no espera a que se guarde.
    after(async () => {
      try {
        await recordErrorEvents(events, ctx);
        await checkErrorAlerts();
      } catch (err) {
        console.error("[errores] no se pudo guardar el reporte del navegador", err);
      }
    });
  }
  return new NextResponse(null, { status: 204 });
}
