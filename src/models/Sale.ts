import mongoose, { Schema } from "mongoose";

export interface ISaleItem {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface ISale {
  _id: string;
  tenantId: string;
  cashUserId: string;
  cashUserName: string;
  customerName: string;
  tableNumber: string;
  items: ISaleItem[];
  subtotal: number;
  ivaEnabled: boolean;
  ivaRate: number;
  ivaAmount: number;
  serviceEnabled: boolean;
  serviceRate: number;
  serviceAmount: number;
  tipEnabled: boolean;
  tipAmount: number;
  total: number;
  paymentMethod: "efectivo" | "sinpe" | "tarjeta" | "mixto";
  mixedPayment: { efectivo: number; sinpe: number; tarjeta: number };
  saleDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SaleItemSchema = new Schema(
  {
    productId:   { type: String, required: true },
    productName: { type: String, required: true },
    unitPrice:   { type: Number, required: true },
    quantity:    { type: Number, required: true, min: 1 },
    lineTotal:   { type: Number, required: true },
  },
  { _id: false }
);

const SaleSchema = new Schema(
  {
    tenantId:      { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    cashUserId:    { type: String, default: "" },
    cashUserName:  { type: String, default: "" },
    customerName:  { type: String, default: "" },
    tableNumber:   { type: String, default: "" },
    items:         { type: [SaleItemSchema], required: true },
    subtotal:      { type: Number, required: true },
    ivaEnabled:    { type: Boolean, default: false },
    ivaRate:       { type: Number, default: 13 },
    ivaAmount:     { type: Number, default: 0 },
    serviceEnabled: { type: Boolean, default: false },
    serviceRate:   { type: Number, default: 10 },
    serviceAmount: { type: Number, default: 0 },
    tipEnabled:    { type: Boolean, default: false },
    tipAmount:     { type: Number, default: 0 },
    total:         { type: Number, required: true },
    paymentMethod: { type: String, enum: ["efectivo", "sinpe", "tarjeta", "mixto"], required: true },
    mixedPayment: {
      efectivo: { type: Number, default: 0 },
      sinpe:    { type: Number, default: 0 },
      tarjeta:  { type: Number, default: 0 },
    },
    saleDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

SaleSchema.index({ tenantId: 1, saleDate: -1 });

export const Sale =
  mongoose.models.Sale || mongoose.model<ISale>("Sale", SaleSchema);
