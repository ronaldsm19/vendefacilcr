import mongoose, { Schema } from "mongoose";

export interface ITenantRequest {
  _id: string;
  businessName: string;
  slug: string;
  ownerName: string;
  email: string;
  whatsappNumber: string;
  plan: "emprende" | "pro" | "premium";
  status: "pending" | "approved" | "rejected";
  notes?: string;
  reviewedAt?: Date;
  reviewedBy?: string;
  tenantId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const TenantRequestSchema = new Schema(
  {
    businessName:  { type: String, required: true, trim: true },
    slug:          { type: String, required: true, trim: true, lowercase: true },
    ownerName:     { type: String, required: true, trim: true },
    email:         { type: String, required: true, trim: true, lowercase: true },
    whatsappNumber:{ type: String, required: true, trim: true },
    plan:          { type: String, enum: ["emprende", "pro", "premium"], default: "emprende" },
    status:        { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    notes:         { type: String },
    reviewedAt:    { type: Date },
    reviewedBy:    { type: String },
    tenantId:      { type: Schema.Types.ObjectId, ref: "Tenant" },
  },
  { timestamps: true }
);

export const TenantRequest =
  mongoose.models.TenantRequest || mongoose.model<ITenantRequest>("TenantRequest", TenantRequestSchema);
