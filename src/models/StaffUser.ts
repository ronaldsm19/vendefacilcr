import mongoose, { Schema } from "mongoose";

export type StaffRole = "cajero" | "mesero";

export interface IStaffUser {
  _id: string;
  tenantId: string;
  name: string;
  username: string;
  pinHash: string;
  role: StaffRole;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const USERNAME_RE = /^[a-z0-9._]{3,20}$/;
export const PIN_RE = /^\d{4}$/;

const StaffUserSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name:     { type: String, required: true, trim: true, maxlength: 60 },
    username: { type: String, required: true, trim: true, lowercase: true, match: USERNAME_RE },
    pinHash:  { type: String, required: true },
    role:     { type: String, enum: ["cajero", "mesero"], required: true },
    active:   { type: Boolean, default: true },
  },
  { timestamps: true }
);

StaffUserSchema.index({ tenantId: 1, username: 1 }, { unique: true });

export const StaffUser =
  mongoose.models.StaffUser || mongoose.model<IStaffUser>("StaffUser", StaffUserSchema);
