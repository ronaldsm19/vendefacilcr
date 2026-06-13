import mongoose, { Schema } from "mongoose";

export interface ICashWithdrawal {
  amount: number;
  leftAmount: number;
  note?: string;
  date: Date;
}

export interface ICashSession {
  _id: string;
  tenantId: string;
  status: "open" | "closed";
  openedAt: Date;
  openingAmount: number;
  previousCashLeft?: number;
  countedAmount?: number;
  openingDifference?: number;
  withdrawals: ICashWithdrawal[];
  closedAt?: Date;
  cashLeft?: number;
  closeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CashSessionSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    status:   { type: String, enum: ["open", "closed"], required: true, default: "open" },
    openedAt: { type: Date, required: true, default: Date.now },
    openingAmount: { type: Number, required: true, default: 0 },
    previousCashLeft:  { type: Number },
    countedAmount:     { type: Number },
    openingDifference: { type: Number },
    withdrawals: {
      type: [{
        amount:     { type: Number, required: true },
        leftAmount: { type: Number, required: true },
        note:       { type: String, default: "" },
        date:       { type: Date, required: true },
      }],
      default: [],
    },
    closedAt: { type: Date },
    cashLeft: { type: Number },
    closeId:  { type: Schema.Types.ObjectId, ref: "CashClose" },
  },
  { timestamps: true }
);

CashSessionSchema.index({ tenantId: 1, status: 1 });

export const CashSession =
  mongoose.models.CashSession || mongoose.model<ICashSession>("CashSession", CashSessionSchema);
