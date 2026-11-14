import {
  idNumberError, isEmail, isIdType, normalizeIdNumber, searchKey, type CustomerView, type IdType,
} from "@/lib/customerId";
import { MAX_CC_EMAILS, type ICustomer } from "@/models/Customer";

/** Lo que el panel puede escribir de un cliente. Los contadores y el autor los pone el servidor. */
export interface CustomerInput {
  idType: IdType;
  idNumber: string;
  name: string;
  searchName: string;
  email: string;
  ccEmails: string[];
  phone: string;
  activityCode: string;
  activityName: string;
  haciendaRegime: string;
  notes: string;
}

type Parsed<T> = { ok: true; data: T } | { ok: false; error: string };

function text(value: unknown, max: number): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/**
 * Valida el cuerpo de un alta (todo) o de una edición (solo lo que venga). Devuelve los campos ya
 * normalizados: cédula sin separadores, correos en minúsculas y la clave de búsqueda del nombre.
 */
export function parseCustomerInput(body: Record<string, unknown>, partial: false): Parsed<CustomerInput>;
export function parseCustomerInput(body: Record<string, unknown>, partial: true): Parsed<Partial<CustomerInput>>;
export function parseCustomerInput(
  body: Record<string, unknown>,
  partial: boolean,
): Parsed<Partial<CustomerInput>> {
  const out: Partial<CustomerInput> = {};
  const has = (key: string) => !partial || body[key] !== undefined;

  if (has("idType") || has("idNumber")) {
    if (!isIdType(body.idType)) return { ok: false, error: "Elegí el tipo de identificación" };
    const digits = normalizeIdNumber(String(body.idNumber ?? ""));
    const error = idNumberError(body.idType, digits);
    if (error) return { ok: false, error };
    out.idType = body.idType;
    out.idNumber = digits;
  }

  if (has("name")) {
    const name = text(body.name, 160);
    if (!name) return { ok: false, error: "Escribí el nombre o la razón social" };
    out.name = name;
    out.searchName = searchKey(name);
  }

  if (has("email")) {
    const email = text(body.email, 160).toLowerCase();
    if (!isEmail(email)) return { ok: false, error: "Escribí un correo válido: ahí le llega la factura" };
    out.email = email;
  }

  if (has("ccEmails")) {
    const raw = Array.isArray(body.ccEmails) ? body.ccEmails : [];
    const list = [...new Set(raw.map((e) => text(e, 160).toLowerCase()).filter(Boolean))];
    if (list.length > MAX_CC_EMAILS) return { ok: false, error: `Podés poner hasta ${MAX_CC_EMAILS} correos de copia` };
    const bad = list.find((e) => !isEmail(e));
    if (bad) return { ok: false, error: `El correo de copia "${bad}" no es válido` };
    out.ccEmails = list.filter((e) => e !== out.email);
  }

  if (has("phone")) out.phone = text(body.phone, 30);
  if (has("activityCode")) out.activityCode = text(body.activityCode, 12);
  if (has("activityName")) out.activityName = text(body.activityName, 200);
  if (has("haciendaRegime")) out.haciendaRegime = text(body.haciendaRegime, 60);
  if (has("notes")) out.notes = String(body.notes ?? "").trim().slice(0, 300);

  return { ok: true, data: out };
}

/** Lo que viaja al panel: sin tenantId ni la clave interna de búsqueda. */
export function toCustomerView(doc: ICustomer): CustomerView {
  const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);
  return {
    _id: String(doc._id),
    idType: doc.idType,
    idNumber: doc.idNumber,
    name: doc.name,
    email: doc.email,
    ccEmails: doc.ccEmails ?? [],
    phone: doc.phone ?? "",
    activityCode: doc.activityCode ?? "",
    activityName: doc.activityName ?? "",
    haciendaRegime: doc.haciendaRegime ?? "",
    notes: doc.notes ?? "",
    invoiceCount: doc.invoiceCount ?? 0,
    createdBy: doc.createdBy ?? "",
    lastInvoiceAt: iso(doc.lastInvoiceAt),
    createdAt: iso(doc.createdAt) ?? "",
    updatedAt: iso(doc.updatedAt) ?? "",
  };
}

export function isDuplicateKey(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}
