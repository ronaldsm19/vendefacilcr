import mongoose, { Schema } from "mongoose";

export type ExpenseCategory =
  | "materia_prima"
  | "empaque"
  | "herramientas"
  | "marketing"
  | "otros";

export interface IExpenseItem {
  description: string;
  amount: number;
}

export interface IExpense {
  _id: string;
  tenantId: string;
  title: string;
  items: IExpenseItem[];
  total: number;
  date: Date;
  category: ExpenseCategory;
  receiptImage?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseItemSchema = new Schema(
  {
    description: { type: String, required: true },
    amount:      { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const ExpenseSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: false, index: true },
    title:        { type: String, required: true, trim: true },
    items:        { type: [ExpenseItemSchema], default: [] },
    total:        { type: Number, required: true, min: 0 },
    date:         { type: Date, default: Date.now },
    category:     {
      type: String,
      enum: ["materia_prima", "empaque", "herramientas", "marketing", "otros"],
      default: "materia_prima",
    },
    receiptImage: { type: String },
    notes:        { type: String },
  },
  { timestamps: true }
);

export const Expense =
  mongoose.models.Expense || mongoose.model("Expense", ExpenseSchema);
