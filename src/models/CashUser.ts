import mongoose, { Schema } from "mongoose";

export interface ICashUser {
  _id: string;
  tenantId: string;
  name: string;
  createdAt: Date;
}

const CashUserSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name:     { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export const CashUser =
  mongoose.models.CashUser || mongoose.model<ICashUser>("CashUser", CashUserSchema);
