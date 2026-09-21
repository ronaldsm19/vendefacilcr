import mongoose, { Schema } from "mongoose";
import type { StaffRole } from "@/models/StaffUser";

export type WorkShiftStatus = "abierta" | "cerrada";
export type WorkShiftClosedBy = "staff" | "admin";

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
  createdAt: Date;
  updatedAt: Date;
}

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
  },
  { timestamps: true }
);

WorkShiftSchema.index({ tenantId: 1, staffUserId: 1, startedAt: -1 });
WorkShiftSchema.index({ tenantId: 1, status: 1 });
WorkShiftSchema.index({ tenantId: 1, startedAt: -1 });
// Nunca dos turnos abiertos para el mismo staffUserId: único parcial, solo aplica a "abierta".
WorkShiftSchema.index(
  { tenantId: 1, staffUserId: 1 },
  { unique: true, partialFilterExpression: { status: "abierta" } }
);

export const WorkShift =
  mongoose.models.WorkShift || mongoose.model<IWorkShift>("WorkShift", WorkShiftSchema);
