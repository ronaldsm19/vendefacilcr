import mongoose, { Schema } from "mongoose";
import { DEFAULT_STAFF_PAY, PAY_MODES, type StaffPay } from "@/lib/payroll";

export type StaffRole = "cajero" | "mesero";

export interface IStaffUser {
  _id: string;
  tenantId: string;
  name: string;
  username: string;
  pinHash: string;
  role: StaffRole;
  active: boolean;
  /** Tarifa actual. Cada pago congela la suya, así que cambiarla no reescribe el historial. */
  pay: StaffPay;
  /** Para mandarle el comprobante por WhatsApp. Se guarda como lo escriben; se normaliza al usarlo. */
  phone: string;
  createdAt: Date;
  updatedAt: Date;
}

export const USERNAME_RE = /^[a-z0-9._]{3,20}$/;
export const PIN_RE = /^\d{4}$/;

const StaffPaySchema = new Schema(
  {
    mode:            { type: String, enum: PAY_MODES, default: "hora" },
    rate:            { type: Number, default: 0, min: 0 },
    includesService: { type: Boolean, default: false },
    notes:           { type: String, default: "", trim: true, maxlength: 200 },
  },
  { _id: false }
);

const StaffUserSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name:     { type: String, required: true, trim: true, maxlength: 60 },
    username: { type: String, required: true, trim: true, lowercase: true, match: USERNAME_RE },
    pinHash:  { type: String, required: true },
    role:     { type: String, enum: ["cajero", "mesero"], required: true },
    active:   { type: Boolean, default: true },
    pay:      { type: StaffPaySchema, default: () => ({ ...DEFAULT_STAFF_PAY }) },
    phone:    { type: String, default: "", trim: true, maxlength: 30 },
  },
  { timestamps: true }
);

StaffUserSchema.index({ tenantId: 1, username: 1 }, { unique: true });

export const StaffUser =
  mongoose.models.StaffUser || mongoose.model<IStaffUser>("StaffUser", StaffUserSchema);
