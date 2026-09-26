import mongoose, { Schema } from "mongoose";
import { PAY_LINE_KINDS, PAY_METHODS, type PayLine, type PayMethod, type PayMode } from "@/lib/payroll";

/**
 * Un pago hecho a una persona del personal.
 *
 * Es un registro de dinero: NUNCA se borra. Si estuvo mal, se anula (`voidedAt`), lo que
 * devuelve sus turnos al montón de lo que se debe. Borrarlo dejaría horas marcadas como
 * pagadas que nadie puede rastrear, y una dueña que no sabe si ya pagó o no.
 *
 * Todo lo que describe a la persona y a la tarifa queda congelado acá al momento de pagar,
 * igual que los extras de una comanda: cambiar la tarifa mañana no puede reescribir lo que ya
 * se pagó ayer.
 */

export interface IPayrollPayment {
  _id: string;
  tenantId: string;
  staffUserId: string;
  staffName: string;
  staffRole: string;
  basis: { mode: PayMode; rate: number; minutes: number; days: number };
  periodFrom: Date;
  periodTo: Date;
  lines: PayLine[];
  /** Suma de `lines`. El servidor siempre lo recalcula; nunca se confía en el cliente. */
  total: number;
  method: PayMethod;
  reference: string;
  /** Ruta del pantallazo del SINPE dentro del almacén privado. Nunca una dirección pública. */
  proofImage: string;
  /** Ruta del comprobante en PDF dentro del almacén privado. */
  receiptPath: string;
  paidAt: Date;
  createdByName: string;
  notes: string;
  voidedAt: Date | null;
  voidedByName: string;
  voidReason: string;
  createdAt: Date;
  updatedAt: Date;
}

const PayLineSchema = new Schema(
  {
    kind:   { type: String, enum: PAY_LINE_KINDS, required: true },
    label:  { type: String, required: true, trim: true, maxlength: 80 },
    amount: { type: Number, required: true },
  },
  { _id: false }
);

const PayrollPaymentSchema = new Schema(
  {
    tenantId:      { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    staffUserId:   { type: Schema.Types.ObjectId, ref: "StaffUser", required: true },
    staffName:     { type: String, required: true },
    staffRole:     { type: String, required: true },
    basis: {
      mode:    { type: String, required: true },
      rate:    { type: Number, required: true },
      minutes: { type: Number, required: true },
      days:    { type: Number, default: 0 },
    },
    periodFrom:    { type: Date, required: true },
    periodTo:      { type: Date, required: true },
    lines:         { type: [PayLineSchema], default: [] },
    total:         { type: Number, required: true, min: 0 },
    method:        { type: String, enum: PAY_METHODS, required: true },
    reference:     { type: String, default: "", trim: true, maxlength: 80 },
    proofImage:    { type: String, default: "" },
    receiptPath:   { type: String, default: "" },
    paidAt:        { type: Date, required: true },
    createdByName: { type: String, default: "", trim: true, maxlength: 80 },
    notes:         { type: String, default: "", trim: true, maxlength: 500 },
    voidedAt:      { type: Date, default: null },
    voidedByName:  { type: String, default: "" },
    voidReason:    { type: String, default: "", trim: true, maxlength: 200 },
  },
  { timestamps: true }
);

PayrollPaymentSchema.index({ tenantId: 1, staffUserId: 1, paidAt: -1 });
PayrollPaymentSchema.index({ tenantId: 1, paidAt: -1 });

export const PayrollPayment =
  mongoose.models.PayrollPayment ||
  mongoose.model<IPayrollPayment>("PayrollPayment", PayrollPaymentSchema);
