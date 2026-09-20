import { PrintJob, type IPrintJob, type PrintJobType, type PrintJobStation } from "@/models/PrintJob";
import { Tenant } from "@/models/Tenant";
import type { ProductStation } from "@/lib/station";                              // Fase 3
import type { SaleAgentPayload, CashCloseAgentPayload } from "@/lib/printBridge"; // solo tipos
import type { IComandaItem } from "@/models/Comanda";

export const PRINT_JOB_LEASE_MS = 2 * 60 * 1000;
export const PRINT_JOB_MAX_ATTEMPTS = 5;

/** Alias del tipo de Fase 3; no declarar un union nuevo. */
export type ComandaStation = ProductStation;

/** Payload exacto de un job type "comanda" (contrato con vfprintagent). */
export interface ComandaPrintPayload {
  docType: "comanda";
  station: "cocina" | "bebidas";
  stationLabel: "COCINA" | "BEBIDAS";
  numero: number;
  version: number;
  fecha: string;               // ISO 8601
  mesa: string;
  area: string;
  cliente: string;             // "" si no hay
  mesero: string;
  items: { cantidad: number; nombre: string; nota: string }[];
  notas: string;
  negocio: { nombre: string };
  /** true → el agente marca el ticket "REIMPRESIÓN" en vez de "ACTUALIZADA v{n}" (botón Reimprimir; nunca al crear o editar de verdad). */
  reimpresion?: true;
}

/** Payloads de los otros tipos (documentados; no se generan en Fase 4). */
export type VentaPrintPayload = SaleAgentPayload;         // lo que acepta POST /imprimir
export type CierrePrintPayload = CashCloseAgentPayload;   // lo que acepta POST /cierre

/** Forma mínima de la comanda que necesita la cola (estructural, no acoplada a IComanda). */
export interface ComandaForPrint {
  _id: unknown;
  tenantId: unknown;
  number: number;
  version: number;
  tableLabel: string;
  areaName: string;
  customerName?: string;
  waiterName: string;
  notes?: string;
  items: { productName: string; quantity: number; station: ProductStation; note?: string }[];
}

const STATION_ORDER: ("cocina" | "bebidas")[] = ["cocina", "bebidas"];
// Local a propósito: el ticket exige mayúsculas ("COCINA"/"BEBIDAS") y `STATION_LABELS`
// de `@/lib/station` (Fase 3) trae "Cocina"/"Bebidas", que son las etiquetas de la UI.
const STATION_LABEL = { cocina: "COCINA", bebidas: "BEBIDAS" } as const;

export function resolveBusinessName(t: { name?: string; ticketConfig?: { businessName?: string } } | null): string {
  return t?.ticketConfig?.businessName?.trim() || t?.name?.trim() || "Mi negocio";
}

/** Firma normalizada de los ítems de una estación: mismo contenido → misma firma, sin importar el orden. */
function stationSignature(items: IComandaItem[], station: "cocina" | "bebidas"): string {
  return items
    .filter((i) => i.station === station && i.quantity > 0)
    .map((i) => `${String(i.productId)}:${i.quantity}:${(i.note ?? "").trim()}`)
    .sort()
    .join("|");
}

/**
 * Estaciones cuyos ítems (producto, cantidad o nota) cambiaron entre dos versiones de una
 * comanda. Se usa al editar, para reimprimir solo lo que le importa a esa estación — cocina
 * no necesita un ticket nuevo si lo único que cambió fue algo de la mesa de bebidas.
 */
export function changedStations(oldItems: IComandaItem[], newItems: IComandaItem[]): ("cocina" | "bebidas")[] {
  return STATION_ORDER.filter((st) => stationSignature(oldItems, st) !== stationSignature(newItems, st));
}

export interface BuildComandaPrintOpts {
  fecha?: Date;
  /** Limita a estas estaciones (p. ej. solo las que cambiaron al editar); por defecto, todas. */
  stations?: ("cocina" | "bebidas")[];
  /** true → cada payload lleva `reimpresion: true` (botón Reimprimir de una copia, no una edición real). */
  isReprint?: boolean;
}

/** Pura: un payload por estación con ítems; omite "ninguna" y estaciones vacías o filtradas. */
export function buildComandaPrintPayloads(
  c: ComandaForPrint,
  businessName: string,
  opts: BuildComandaPrintOpts = {}
): ComandaPrintPayload[] {
  const fecha = opts.fecha ?? new Date();
  const stations = opts.stations ?? STATION_ORDER;
  return stations.flatMap((station) => {
    const items = c.items
      .filter((i) => i.station === station && i.quantity > 0)
      .map((i) => ({ cantidad: i.quantity, nombre: i.productName, nota: (i.note ?? "").trim() }));
    if (!items.length) return [];
    return [{
      docType: "comanda" as const,
      station,
      stationLabel: STATION_LABEL[station],
      numero: c.number,
      version: c.version,
      fecha: fecha.toISOString(),
      mesa: c.tableLabel,
      area: c.areaName ?? "",
      cliente: (c.customerName ?? "").trim(),
      mesero: c.waiterName,
      items,
      notas: (c.notes ?? "").trim(),
      negocio: { nombre: businessName },
      ...(opts.isReprint ? { reimpresion: true as const } : {}),
    }];
  });
}

/** Inserta un job genérico. Base para "venta"/"cierre" en fases posteriores. */
export async function enqueuePrintJob(input: {
  tenantId: string; type: PrintJobType; payload: object; refId?: string; station?: PrintJobStation;
}): Promise<IPrintJob> {
  const doc = await PrintJob.create({
    tenantId: input.tenantId, type: input.type, payload: input.payload,
    refId: input.refId ?? "", station: input.station ?? "",
  });
  return doc.toObject() as IPrintJob;
}

/**
 * Encola los tickets de una comanda (uno por estación con ítems, o solo las de `opts.stations`
 * si se pasa). Devuelve los jobs creados ([] si el tenant no es premium, no hay ítems imprimibles,
 * o `opts.stations` no dejó ninguna estación con algo que decir).
 * Lanza si Mongo falla: el caller decide si lo traga (crear/editar) o lo propaga (reimprimir).
 */
export async function enqueueComandaPrint(c: ComandaForPrint, opts: BuildComandaPrintOpts = {}): Promise<IPrintJob[]> {
  const tenantId = String(c.tenantId);
  const tenant = await Tenant.findById(tenantId).select("name plan ticketConfig.businessName").lean() as
    | { name?: string; plan?: string; ticketConfig?: { businessName?: string } } | null;
  if (!tenant || tenant.plan !== "premium") return [];

  const payloads = buildComandaPrintPayloads(c, resolveBusinessName(tenant), opts);
  if (!payloads.length) return [];

  const docs = await PrintJob.insertMany(
    payloads.map((p) => ({ tenantId, type: "comanda", payload: p, refId: String(c._id), station: p.station })),
    { ordered: true }   // cocina primero, bebidas después (el orden FIFO lo fija el sort por createdAt + _id)
  );
  return docs.map((d) => d.toObject() as IPrintJob);
}
