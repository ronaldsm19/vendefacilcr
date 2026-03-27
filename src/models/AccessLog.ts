import mongoose, { Schema } from "mongoose";

export interface IAccessLog {
  _id: string;
  tenantId: string;
  tenantSlug: string;
  userEmail: string;
  ip: string;
  userAgent?: string;
  success: boolean;
  createdAt: Date;
}

const AccessLogSchema = new Schema(
  {
    tenantId:   { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    tenantSlug: { type: String, required: true },
    userEmail:  { type: String, required: true },
    ip:         { type: String, required: true },
    userAgent:  { type: String },
    success:    { type: Boolean, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AccessLogSchema.index({ createdAt: -1 });

export const AccessLog =
  mongoose.models.AccessLog || mongoose.model<IAccessLog>("AccessLog", AccessLogSchema);
