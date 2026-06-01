import mongoose, { Schema } from "mongoose";

export interface IProductSummary {
  productId: string;
  productName: string;
  unitsSold: number;
}

export interface IArqueoDenom {
  valor: number;
  cantidad: number;
  subtotal: number;
}

export interface IArqueo {
  denominaciones: IArqueoDenom[];
  totalContado: number;
  totalEsperado: number;
  diferencia: number;
}

export interface ICashClose {
  _id: string;
  tenantId: string;
  closeDate: Date;
  closedBy: string;
  salesTotal: number;
  paymentBreakdown: { efectivo: number; sinpe: number; tarjeta: number };
  expensesTotal: number;
  profit: number;
  productsSummary: IProductSummary[];
  arqueo?: IArqueo;
  createdAt: Date;
}

const ProductSummarySchema = new Schema(
  {
    productId:   { type: String, required: true },
    productName: { type: String, required: true },
    unitsSold:   { type: Number, required: true },
  },
  { _id: false }
);

const CashCloseSchema = new Schema(
  {
    tenantId:  { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    closeDate: { type: Date, required: true },
    closedBy:  { type: String, default: "" },
    salesTotal: { type: Number, required: true },
    paymentBreakdown: {
      efectivo: { type: Number, default: 0 },
      sinpe:    { type: Number, default: 0 },
      tarjeta:  { type: Number, default: 0 },
    },
    expensesTotal:   { type: Number, default: 0 },
    profit:          { type: Number, default: 0 },
    productsSummary: { type: [ProductSummarySchema], default: [] },
    arqueo: {
      type: {
        denominaciones: [{
          valor:    { type: Number, required: true },
          cantidad: { type: Number, required: true },
          subtotal: { type: Number, required: true },
        }],
        totalContado:  { type: Number, required: true },
        totalEsperado: { type: Number, required: true },
        diferencia:    { type: Number, required: true },
      },
      required: false,
      default: undefined,
    },
  },
  { timestamps: true }
);

export const CashClose =
  mongoose.models.CashClose || mongoose.model<ICashClose>("CashClose", CashCloseSchema);
