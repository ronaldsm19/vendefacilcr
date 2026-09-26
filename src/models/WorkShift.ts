import mongoose, { Schema } from "mongoose";
import type { StaffRole } from "@/models/StaffUser";

export type WorkShiftStatus = "abierta" | "cerrada";
export type WorkShiftClosedBy = "staff" | "admin";

export interface IWorkShiftEdit {
  at: Date;
  byName: string;
  note: string;
  fromStartedAt: Date;
  fromEndedAt: Date | null;
  toStartedAt: Date;
  toEndedAt: Date | null;
}

export interface IWorkShift {
  _id: string;
  tenantId: string;
  staffUserId: string;
  staffName: string;
  staffRole: StaffRole;
  startedAt: Date;
  endedAt: Date | null;
  minutes: number;
  status: WorkShiftStatus;
  closedBy: WorkShiftClosedBy;
  adjustedByName: string;
  adjustNote: string;
  edits: IWorkShiftEdit[];
  /**
   * Pago que ya cubrió este turno, o null si todavía se debe.
   *
   * Se marca el turno en vez de restar montos por período: con adelantos, pagos parciales y
   * correcciones de turnos, la resta se desincroniza enseguida y la dueña deja de confiar en
   * el número. Así "horas trabajadas, pagadas y pendientes" sale de contar y siempre cuadra.
   */
  payrollPaymentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const WorkShiftEditSchema = new Schema(
  {
    at:            { type: Date, required: true },
    byName:        { type: String, required: true },
    note:          { type: String, default: "" },
    fromStartedAt: { type: Date, required: true },
    fromEndedAt:   { type: Date, default: null },
    toStartedAt:   { type: Date, required: true },
    toEndedAt:     { type: Date, default: null },
  },
  { _id: false }
);

const WorkShiftSchema = new Schema(
  {
    tenantId:       { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    staffUserId:    { type: Schema.Types.ObjectId, ref: "StaffUser", required: true },
    staffName:      { type: String, required: true },
    staffRole:      { type: String, enum: ["cajero", "mesero"], required: true },
    startedAt:      { type: Date, required: true },
    endedAt:        { type: Date, default: null },
    minutes:        { type: Number, default: 0 },
    status:         { type: String, enum: ["abierta", "cerrada"], default: "abierta" },
    closedBy:       { type: String, enum: ["staff", "admin"], default: "staff" },
    adjustedByName: { type: String, default: "" },
    adjustNote:     { type: String, default: "" },
    // Historial de ediciones de entrada/salida hechas por el admin, en orden. El "from" de la primera
    // edición es lo que la persona marcó de verdad (o lo que puso el admin al cerrar un turno olvidado).
    edits:          { type: [WorkShiftEditSchema], default: [] },
    payrollPaymentId: { type: Schema.Types.ObjectId, ref: "PayrollPayment", default: null },
  },
  { timestamps: true }
);

WorkShiftSchema.index({ tenantId: 1, staffUserId: 1, startedAt: -1 });
// Planilla: los turnos cerrados que todavía se deben, por persona.
WorkShiftSchema.index({ tenantId: 1, staffUserId: 1, payrollPaymentId: 1, status: 1 });
WorkShiftSchema.index({ tenantId: 1, status: 1 });
WorkShiftSchema.index({ tenantId: 1, startedAt: -1 });
// Nunca dos turnos abiertos para el mismo staffUserId: único parcial, solo aplica a "abierta".
WorkShiftSchema.index(
  { tenantId: 1, staffUserId: 1 },
  { unique: true, partialFilterExpression: { status: "abierta" } }
);

export const WorkShift =
  mongoose.models.WorkShift || mongoose.model<IWorkShift>("WorkShift", WorkShiftSchema);
