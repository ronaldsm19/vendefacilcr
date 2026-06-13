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

export interface ICashWithdrawal {
  amount: number;
  leftAmount: number;
  note?: string;
  date: Date;
}

export interface ISaleListItem {
  ticketNumber: number;
  total: number;
}

export interface ICashClose {
  _id: string;
  tenantId: string;
  closeDate: Date;
  closedBy: string;
  closeNumber?: number;
  salesTotal: number;
  paymentBreakdown: { efectivo: number; sinpe: number; tarjeta: number };
  expensesTotal: number;
  profit: number;
  productsSummary: IProductSummary[];
  arqueo?: IArqueo;
  openingAmount: number;
  withdrawals: ICashWithdrawal[];
  withdrawalsTotal: number;
  cashLeft: number;
  salesList: ISaleListItem[];
  notes?: string;
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
    closeNumber: { type: Number },
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
    openingAmount: { type: Number, default: 0 },
    withdrawals: {
      type: [{
        amount:     { type: Number, required: true },
        leftAmount: { type: Number, required: true },
        note:       { type: String, default: "" },
        date:       { type: Date, required: true },
      }],
      default: [],
    },
    withdrawalsTotal: { type: Number, default: 0 },
    cashLeft:         { type: Number, default: 0 },
    salesList: {
      type: [{
        ticketNumber: { type: Number, default: 0 },
        total:        { type: Number, required: true },
      }],
      default: [],
    },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

export const CashClose =
  mongoose.models.CashClose || mongoose.model<ICashClose>("CashClose", CashCloseSchema);
