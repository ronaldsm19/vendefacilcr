import mongoose, { Schema } from "mongoose";
import { DEFAULT_PLAN_PRICES } from "@/lib/billing";
import type { ProofStatus, ReviewStatus } from "@/lib/mensualidad";

/**
 * Factura mensual de un negocio. Guarda el precio como quedó ese mes (lista, descuento, final): si
 * después cambia el descuento o el precio de lista, las facturas viejas no se alteran.
 * "cortesia" = mes sin costo: no se cobra ni se recuerda, pero queda registrado cuánto se regaló.
 *
 * Desde Mensualidad el dueño sube los comprobantes del pago (`proofs`) y el superadmin los revisa
 * (`review`); aprobarlos es registrar el pago.
 */
export type PaymentStatus = "pending" | "paid" | "late" | "cancelled" | "cortesia";

/** @deprecated Los precios viven en la configuración de cobros (BillingSettings.prices). */
export const PLAN_AMOUNTS: Record<string, number> = { ...DEFAULT_PLAN_PRICES };

/** Un comprobante que subió el dueño (pantallazo o PDF en el almacén privado). */
export interface IPaymentProof {
  _id: mongoose.Types.ObjectId;
  /** Ruta en el bucket privado; se ve con un enlace firmado que vence. */
  path: string;
  contentType: string;
  /** La fecha en que el dueño dice que pagó. */
  paidOn: Date;
  method: string;
  reference: string;
  note: string;
  uploadedAt: Date;
  uploadedBy: string;
  status: ProofStatus;
  rejectReason: string;
}

/** La revisión de los comprobantes (ver src/lib/mensualidad.ts). */
export interface IPaymentReview {
  status: ReviewStatus;
  /** Cuándo se subió el último comprobante: ordena la fila de "Por revisar". */
  submittedAt: Date | null;
  reviewedAt: Date | null;
  reviewedBy: string;
  /** Motivo del último rechazo. */
  reason: string;
  /** Cuándo el dueño cerró el aviso con el resultado de la revisión. */
  ownerSeenAt: Date | null;
}

export interface IPayment {
  _id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  plan: "emprende" | "pro" | "premium";
  periodYear: number;
  periodMonth: number;
  /** Lo que paga (con descuento). */
  amount: number;
  /** Precio de lista de ese mes. Las facturas anteriores a los descuentos no lo tienen: vale amount. */
  listAmount?: number;
  discountAmount?: number;
  discountLabel?: string;
  status: PaymentStatus;
  dueDate: Date;
  paidAt?: Date;
  method?: string;
  reference?: string;
  notes?: string;
  /** Correos ya enviados, para no repetirlos. */
  reminders?: { beforeAt?: Date | null; dueAt?: Date | null; suspendedAt?: Date | null };
  /** Las facturas de antes de Mensualidad no los tienen. */
  proofs?: IPaymentProof[];
  review?: IPaymentReview;
  createdAt: Date;
  updatedAt: Date;
}

const ProofSchema = new Schema(
  {
    path:         { type: String, required: true },
    contentType:  { type: String, required: true },
    paidOn:       { type: Date, required: true },
    method:       { type: String, default: "" },
    reference:    { type: String, default: "" },
    note:         { type: String, default: "" },
    uploadedAt:   { type: Date, required: true },
    uploadedBy:   { type: String, default: "" },
    status:       { type: String, enum: ["submitted", "approved", "rejected"], default: "submitted" },
    rejectReason: { type: String, default: "" },
  },
  { _id: true },
);

const PaymentSchema = new Schema(
  {
    tenantId:    { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    tenantName:  { type: String, required: true },
    tenantSlug:  { type: String, required: true },
    plan:        { type: String, enum: ["emprende", "pro", "premium"], required: true },
    periodYear:  { type: Number, required: true },
    periodMonth: { type: Number, required: true, min: 1, max: 12 },
    amount:      { type: Number, required: true, min: 0 },
    listAmount:  { type: Number, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    discountLabel:  { type: String, default: "" },
    status:      { type: String, enum: ["pending", "paid", "late", "cancelled", "cortesia"], default: "pending", index: true },
    dueDate:     { type: Date, required: true },
    paidAt:      { type: Date },
    method:      { type: String, default: "" },
    reference:   { type: String, default: "" },
    notes:       { type: String },
    reminders: {
      beforeAt:    { type: Date, default: null },
      dueAt:       { type: Date, default: null },
      suspendedAt: { type: Date, default: null },
    },
    proofs: { type: [ProofSchema], default: [] },
    review: {
      status:      { type: String, enum: ["none", "submitted", "approved", "rejected"], default: "none" },
      submittedAt: { type: Date, default: null },
      reviewedAt:  { type: Date, default: null },
      reviewedBy:  { type: String, default: "" },
      reason:      { type: String, default: "" },
      ownerSeenAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

// One invoice per tenant per month
PaymentSchema.index({ tenantId: 1, periodYear: 1, periodMonth: 1 }, { unique: true });
// La fila de comprobantes por revisar del superadmin.
PaymentSchema.index({ "review.status": 1, "review.submittedAt": 1 });

export const Payment =
  mongoose.models.Payment || mongoose.model<IPayment>("Payment", PaymentSchema);
