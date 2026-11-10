import mongoose, { Schema } from "mongoose";
import { DEFAULT_PLAN_PRICES } from "@/lib/billing";

/**
 * Factura mensual de un negocio. Guarda el precio como quedó ese mes (lista, descuento, final): si
 * después cambia el descuento o el precio de lista, las facturas viejas no se alteran.
 * "cortesia" = mes sin costo: no se cobra ni se recuerda, pero queda registrado cuánto se regaló.
 */
export type PaymentStatus = "pending" | "paid" | "late" | "cancelled" | "cortesia";

/** @deprecated Los precios viven en la configuración de cobros (BillingSettings.prices). */
export const PLAN_AMOUNTS: Record<string, number> = { ...DEFAULT_PLAN_PRICES };

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
  createdAt: Date;
  updatedAt: Date;
}

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
  },
  { timestamps: true }
);

// One invoice per tenant per month
PaymentSchema.index({ tenantId: 1, periodYear: 1, periodMonth: 1 }, { unique: true });

export const Payment =
  mongoose.models.Payment || mongoose.model<IPayment>("Payment", PaymentSchema);
