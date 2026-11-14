/**
 * Mensualidad del negocio: los comprobantes de pago que sube el dueño y la revisión del superadmin.
 *
 * Lógica pura y sin imports: la usan el servicio, las rutas y las pantallas, y su prueba corre con
 * node sin compilar (`node --experimental-strip-types src/lib/mensualidad.test.ts`).
 *
 * El dinero manda en la factura (`status`: pending, late, paid...). La revisión va aparte
 * (`review.status`): dice si hay un comprobante esperando, si se rechazó o si se aprobó. Aprobar
 * un comprobante es lo mismo que registrar el pago.
 */

/**
 * Primer mes (yyyymm) que el dueño ve en Mensualidad. Los anteriores pudieron pagarse por fuera sin
 * quedar marcados en el sistema: mostrárselos como pendientes sería un error.
 */
export const MENSUALIDAD_DESDE = 202611;

export const shownToOwner = (y: number, m: number) => y * 100 + m >= MENSUALIDAD_DESDE;

/** Filtro de Mongo para las facturas desde MENSUALIDAD_DESDE. */
export function shownToOwnerFilter() {
  const y = Math.floor(MENSUALIDAD_DESDE / 100);
  const m = MENSUALIDAD_DESDE % 100;
  return { $or: [{ periodYear: { $gt: y } }, { periodYear: y, periodMonth: { $gte: m } }] };
}

export type ProofStatus = "submitted" | "approved" | "rejected";
/** La revisión de una factura. "none": nunca le subieron un comprobante. */
export type ReviewStatus = "none" | ProofStatus;

export const PROOF_LIMITS = {
  perInvoice: 5,
  // Vercel corta los pedidos de más de 4,5 MB: las fotos grandes se achican en el navegador antes de subir.
  maxBytes: 4 * 1024 * 1024,
  reference: 80,
  note: 300,
  reason: 300,
  /** Hasta cuántos días atrás puede ser la fecha del pago. */
  paidOnMaxDaysAgo: 120,
} as const;

/** Tipos de archivo que se aceptan y su extensión. */
export const PROOF_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export const PROOF_METHODS = [
  { value: "sinpe", label: "SINPE Móvil" },
  { value: "transferencia", label: "Transferencia" },
  { value: "otro", label: "Otro" },
] as const;

export const proofMethodLabel = (value: string) =>
  PROOF_METHODS.find((m) => m.value === value)?.label ?? (value || "—");

/** Motivos rápidos para rechazar un comprobante (también se puede escribir otro). */
export const REJECT_REASONS = [
  "El monto está incompleto",
  "No se lee bien el comprobante",
  "No encontramos el pago en la cuenta",
  "El comprobante no corresponde a este mes",
] as const;

interface ProofLike { status: ProofStatus; uploadedAt: Date | string }

/** La revisión según los comprobantes: si alguno espera revisión, manda; si no, el último que se subió. */
export function reviewStatusOf(proofs: readonly ProofLike[]): ReviewStatus {
  if (!proofs.length) return "none";
  if (proofs.some((p) => p.status === "submitted")) return "submitted";
  let last = proofs[0];
  for (const p of proofs) if (new Date(p.uploadedAt).getTime() >= new Date(last.uploadedAt).getTime()) last = p;
  return last.status;
}

/** Lo que ve el dueño en cada mes. */
export type OwnerStatus = "pendiente" | "atrasada" | "revision" | "rechazado" | "verificado" | "sin_costo" | "anulada";

export const OWNER_STATUS_LABELS: Record<OwnerStatus, string> = {
  pendiente: "Pendiente",
  atrasada: "Atrasada",
  revision: "En revisión",
  rechazado: "Revisar comprobante",
  verificado: "Pago verificado",
  sin_costo: "Sin costo",
  anulada: "Anulada",
};

export function ownerStatusOf(invoice: { status: string; review?: { status?: ReviewStatus } | null }): OwnerStatus {
  if (invoice.status === "paid") return "verificado";
  if (invoice.status === "cortesia") return "sin_costo";
  if (invoice.status === "cancelled") return "anulada";
  const review = invoice.review?.status ?? "none";
  if (review === "submitted") return "revision";
  if (review === "rejected") return "rechazado";
  return invoice.status === "late" ? "atrasada" : "pendiente";
}

const isOpen = (status: string) => status === "pending" || status === "late";

/** Por qué no se puede subir un comprobante a esta factura, o null si se puede. */
export function uploadBlockedReason(invoice: { status: string; proofs?: readonly unknown[] | null }): string | null {
  if (invoice.status === "paid") return "Este mes ya está pagado.";
  if (!isOpen(invoice.status)) return "Este mes no se cobra.";
  if ((invoice.proofs?.length ?? 0) >= PROOF_LIMITS.perInvoice) {
    return `Ya hay ${PROOF_LIMITS.perInvoice} comprobantes en este mes. Si falta algo, escribinos por WhatsApp.`;
  }
  return null;
}

/** El dueño puede quitar un comprobante que todavía nadie revisó, de un mes sin pagar. */
export const canDeleteProof = (invoice: { status: string }, proof: { status: ProofStatus }) =>
  isOpen(invoice.status) && proof.status === "submitted";

/** El superadmin puede aprobar o rechazar mientras haya un comprobante esperando, en un mes sin pagar. */
export const canReview = (invoice: { status: string; review?: { status?: ReviewStatus } | null }) =>
  isOpen(invoice.status) && invoice.review?.status === "submitted";

/** Ruta del archivo en el almacén privado: siempre debajo del slug del negocio. */
export function proofPath(slug: string, y: number, m: number, random: string, ext: string): string {
  return `${slug}/mensualidad/${y}${String(m).padStart(2, "0")}-${random}.${ext}`;
}

/**
 * Qué archivo es de verdad, por sus primeros bytes (el tipo que manda el navegador se puede
 * falsear). Devuelve el tipo o null si no es una imagen o PDF de los aceptados.
 */
export function sniffProofType(bytes: Uint8Array): string | null {
  const at = (i: number, ...values: number[]) => values.every((v, k) => bytes[i + k] === v);
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  if (at(0, 0x25, 0x50, 0x44, 0x46)) return "application/pdf";
  return null;
}
