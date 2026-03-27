import mongoose, { Schema } from "mongoose";

export type PaymentStatus = "pending" | "paid" | "late";

export const PLAN_AMOUNTS: Record<string, number> = {
  emprende: 12900,
  pro:      17900,
  premium:  24900,
};

export interface IPayment {
  _id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  plan: "emprende" | "pro" | "premium";
  periodYear: number;
  periodMonth: number;
  amount: number;
  status: PaymentStatus;
  dueDate: Date;
  paidAt?: Date;
  notes?: string;
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
    status:      { type: String, enum: ["pending", "paid", "late"], default: "pending", index: true },
    dueDate:     { type: Date, required: true },
    paidAt:      { type: Date },
    notes:       { type: String },
  },
  { timestamps: true }
);

// One invoice per tenant per month
PaymentSchema.index({ tenantId: 1, periodYear: 1, periodMonth: 1 }, { unique: true });

export const Payment =
  mongoose.models.Payment || mongoose.model<IPayment>("Payment", PaymentSchema);
