import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { verifyJwt, COOKIE_NAME, type AdminPayload } from "@/lib/auth";
import {
  ErrorEvent, ERROR_BUCKET_MINUTES,
  type ErrorKind, type ErrorLevel, type ErrorSource,
} from "@/models/ErrorEvent";

/**
 * Registro de errores de las APIs, por negocio. Lo alimentan tres fuentes: el panel en el navegador
 * (respuestas con error y pedidos sin respuesta), las fallas del servidor (instrumentation.ts) y los
 * rechazos al agente de impresión. Lo lee el panel Errores del superadmin y los correos de alerta.
 */

/** Tope de registros NUEVOS por negocio por hora: un bucle con errores distintos no llena la base. */
const MAX_NEW_PER_TENANT_HOUR = 200;

export interface ErrorEventInput {
  source: ErrorSource;
  kind: ErrorKind;
  method?: string;
  /** Ruta tal cual llegó; acá se normaliza. */
  route?: string;
  status?: number | null;
  message?: string;
  code?: string;
  page?: string;
  at?: Date;
  /** Repeticiones que el navegador ya juntó antes de mandar el reporte. */
  count?: number;
  stack?: string;
  digest?: string;
}

export interface ErrorEventContext {
  tenantId?: string | null;
  tenantSlug?: string;
  userName?: string;
  userRole?: string;
  userAgent?: string;
}

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LONG_TOKEN = /^[a-f0-9]{32,}$/i;

/** Ruta sin query y con los ids como :id, para que /work-shifts/<id> de todos los negocios se agrupe. */
export function normalizePath(raw: string): string {
  const path = (raw || "").split(/[?#]/)[0].slice(0, 300);
  return path
    .split("/")
    .map((seg) => (OBJECT_ID.test(seg) || UUID.test(seg) || LONG_TOKEN.test(seg) || /^\d+$/.test(seg) ? ":id" : seg))
    .join("/");
}

/** Pantalla del panel sin el slug: /kahve-tanna/admin/salon → /:negocio/admin/salon. */
export function normalizePage(raw: string, tenantSlug?: string): string {
  const path = normalizePath(raw);
  if (tenantSlug && (path === `/${tenantSlug}` || path.startsWith(`/${tenantSlug}/`))) {
    return `/:negocio${path.slice(tenantSlug.length + 1)}`;
  }
  return path.replace(/^\/[^/]+\/admin(?=\/|$)/, "/:negocio/admin");
}

export function levelFor(kind: ErrorKind, status: number | null): ErrorLevel {
  if (kind === "respuesta") return status !== null && status >= 500 ? "error" : "aviso";
  return "error";
}

/**
 * Graves: merecen un correo la primera vez que aparecen. "Sin conexión" no, aunque sea error: casi
 * siempre es el wifi del negocio. Se ve en el panel; tampoco cuenta para el correo de pico.
 */
export function isGrave(kind: ErrorKind, status: number | null): boolean {
  return kind === "excepcion" || kind === "agente_rechazado" || (kind === "respuesta" && (status ?? 0) >= 500);
}

/** El mensaje sin números, para que "Se cruza ... (7:25 p. m.)" y "(8:10 p. m.)" sean el mismo error. */
function messageKey(message: string): string {
  return message.toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim().slice(0, 200);
}

function bucketOf(at: Date): Date {
  const ms = ERROR_BUCKET_MINUTES * 60_000;
  return new Date(Math.floor(at.getTime() / ms) * ms);
}

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

function isDuplicateKey(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

/**
 * Guarda los eventos. Repetir el mismo error en el mismo tramo solo sube el contador. Devuelve
 * cuántos errores graves aparecieron por primera vez (para el correo de "error nuevo").
 */
export async function recordErrorEvents(inputs: ErrorEventInput[], ctx: ErrorEventContext): Promise<{ graveNew: number }> {
  if (!inputs.length) return { graveNew: 0 };
  await connectToDatabase();

  const tenantId = ctx.tenantId && mongoose.isValidObjectId(ctx.tenantId)
    ? new mongoose.Types.ObjectId(ctx.tenantId)
    : null;
  const appVersion = (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7);
  let graveNew = 0;

  for (const input of inputs) {
    const at = input.at ?? new Date();
    const status = typeof input.status === "number" && Number.isFinite(input.status) ? Math.trunc(input.status) : null;
    const method = clip(input.method, 10).toUpperCase();
    const route = normalizePath(clip(input.route, 300));
    const message = clip(input.message, 300).trim();
    const level = levelFor(input.kind, status);
    const fingerprint = createHash("sha1")
      .update([input.source, input.kind, method, route, status ?? "", messageKey(message)].join("|"))
      .digest("hex");
    const filter = { fingerprint, tenantId, bucket: bucketOf(at) };
    const count = Math.max(1, Math.min(1000, Math.trunc(input.count ?? 1)));
    const latest = {
      message,
      page: normalizePage(clip(input.page, 300), ctx.tenantSlug),
      userName: clip(ctx.userName, 80),
      userRole: clip(ctx.userRole, 20),
      userAgent: clip(ctx.userAgent, 200),
      appVersion,
      ...(input.stack ? { stack: clip(input.stack, 3000) } : {}),
      ...(input.digest ? { digest: clip(input.digest, 80) } : {}),
    };
    const bump = { $inc: { count }, $max: { lastAt: at }, $set: latest };

    // Lo más común es que el error se repita: eso solo suma al registro del tramo.
    const repeated = await ErrorEvent.updateOne(filter, bump);
    if (repeated.matchedCount) continue;

    // Registro nuevo: el tope se mira acá, justo antes de crearlo, y no una vez por tanda, porque
    // varias tandas del mismo negocio se procesan en paralelo.
    const newThisHour = await ErrorEvent.countDocuments({ tenantId, bucket: { $gte: new Date(Date.now() - 3_600_000) } });
    if (newThisHour >= MAX_NEW_PER_TENANT_HOUR) continue;

    try {
      const r = await ErrorEvent.updateOne(filter, {
        ...bump,
        $setOnInsert: {
          tenantSlug: clip(ctx.tenantSlug, 80),
          source: input.source, level, kind: input.kind, method, route, status,
          code: clip(input.code, 60), firstAt: at, firstSeen: false, notifiedAt: null,
        },
      }, { upsert: true });
      if (!r.upsertedId) continue;
      if (level === "error" && isGrave(input.kind, status)) {
        const seenBefore = await ErrorEvent.exists({ fingerprint, _id: { $ne: r.upsertedId } });
        if (!seenBefore) {
          await ErrorEvent.updateOne({ _id: r.upsertedId }, { $set: { firstSeen: true } });
          graveNew++;
        }
      }
    } catch (err) {
      // Dos pedidos crearon el mismo registro a la vez: el segundo solo suma.
      if (!isDuplicateKey(err)) throw err;
      await ErrorEvent.updateOne(filter, bump);
    }
  }
  return { graveNew };
}

type HeaderBag = Record<string, string | string[] | undefined>;

function headerOf(headers: HeaderBag, name: string): string {
  const v = headers[name] ?? headers[name.toLowerCase()];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

/** La misma sesión que usan las rutas: el bearer de la app, o si no, la cookie del panel. */
async function sessionFromHeaders(headers: HeaderBag): Promise<AdminPayload | null> {
  const bearer = /^Bearer\s+(.+)$/i.exec(headerOf(headers, "authorization").trim());
  if (bearer) return verifyJwt(bearer[1].trim());
  const cookie = headerOf(headers, "cookie")
    .split(/;\s*/)
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));
  if (!cookie) return null;
  try {
    return await verifyJwt(decodeURIComponent(cookie.slice(COOKIE_NAME.length + 1)));
  } catch {
    return null;
  }
}

/** Una falla inesperada que atrapó Next (ver src/instrumentation.ts). */
export async function recordServerError(
  err: { message?: string; stack?: string; digest?: string },
  request: { path: string; method: string; headers: HeaderBag },
  context: { routeType: string },
): Promise<{ graveNew: number }> {
  const session = await sessionFromHeaders(request.headers);
  const isPage = context.routeType === "render";
  return recordErrorEvents([{
    source: "servidor",
    kind: "excepcion",
    method: request.method,
    route: isPage ? normalizePage(request.path, session?.tenantSlug) : request.path,
    status: 500,
    message: err.message || "Error sin mensaje",
    stack: err.stack,
    digest: err.digest,
    page: isPage ? request.path : "",
  }], {
    tenantId: session?.tenantId ?? null,
    tenantSlug: session?.tenantSlug ?? "",
    userName: session?.name ?? "",
    userRole: session?.role ?? "",
    userAgent: headerOf(request.headers, "user-agent"),
  });
}
