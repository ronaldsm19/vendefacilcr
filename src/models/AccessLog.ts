import mongoose, { Schema } from "mongoose";

export interface IAccessLog {
  _id: string;
  tenantId: string;
  tenantSlug: string;
  userEmail: string;
  ip: string;
  userAgent?: string;
  success: boolean;
  event: "login" | "visit";
  path?: string;
  createdAt: Date;
}

const AccessLogSchema = new Schema(
  {
    tenantId:   { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    tenantSlug: { type: String, required: true },
    userEmail:  { type: String, default: "" },
    ip:         { type: String, required: true },
    userAgent:  { type: String },
    success:    { type: Boolean, required: true },
    event:      { type: String, enum: ["login", "visit"], default: "login" },
    path:       { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AccessLogSchema.index({ createdAt: -1 });
AccessLogSchema.index({ tenantSlug: 1, createdAt: -1 });

export const AccessLog =
  mongoose.models.AccessLog || mongoose.model<IAccessLog>("AccessLog", AccessLogSchema);
