import mongoose, { Schema } from "mongoose";
import { LineExtraSchema } from "@/models/LineExtra";
import type { LineExtra } from "@/lib/pricing";

export interface ISaleItem {
  productId: string;
  productName: string;
  unitPrice: number;      // precio BASE, sin extras
  quantity: number;
  lineTotal: number;      // (unitPrice + extras) × quantity
  extras?: LineExtra[];   // copia congelada; ventas viejas no lo tienen
}

export interface ISaleComandaClaim {
  comandaId: string;
  items: { index: number; qty: number }[]; // qty que ESTA venta cobró de cada índice
}

export interface ISale {
  _id: string;
  tenantId: string;
  ticketNumber: number;
  cashUserId: string;
  cashUserName: string;
  customerName: string;
  tableNumber: string;
  orderType: "LOCAL" | "PICKUP" | "EXPRESS";
  pickupTime?: string;
  deliveryAddress?: string;
  deliveryPhone?: string;
  deliveryFee?: number;
  tableId: string;        // _id de SalonTable, "" si la venta no viene de una mesa del Salón
  comandaIds: string[];   // comandas cobradas (total o parcialmente) en esta venta
  // Detalle exacto de qué índice/cantidad de cada comanda cobró ESTA venta (Fase 7), para poder
  // revertir el paidQty con precisión al eliminarla — Comanda.items[].paidQty es un acumulado
  // entre ventas y por sí solo no alcanza para saber cuánto le corresponde a una venta puntual.
  // Ventas anteriores a esta fase no lo tienen (fallback best-effort al eliminarlas).
  comandaClaims: ISaleComandaClaim[];
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
  notes?: string;
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
    extras:      { type: [LineExtraSchema], default: [] },
  },
  { _id: false }
);

const SaleComandaClaimSchema = new Schema(
  {
    comandaId: { type: String, required: true },
    items: {
      type: [{ index: { type: Number, required: true }, qty: { type: Number, required: true }, _id: false }],
      default: [],
    },
  },
  { _id: false }
);

const SaleSchema = new Schema(
  {
    tenantId:      { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    ticketNumber:  { type: Number, default: 0 },
    cashUserId:    { type: String, default: "" },
    cashUserName:  { type: String, default: "" },
    customerName:  { type: String, default: "" },
    tableNumber:   { type: String, default: "" },
    orderType:     { type: String, enum: ["LOCAL", "PICKUP", "EXPRESS"], default: "LOCAL" },
    pickupTime:    { type: String, default: "" },
    deliveryAddress: { type: String, default: "" },
    deliveryPhone: { type: String, default: "" },
    deliveryFee:   { type: Number, default: 0 },
    tableId:       { type: String, default: "" },
    comandaIds:    { type: [String], default: [] },
    comandaClaims: { type: [SaleComandaClaimSchema], default: [] },
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
    notes:    { type: String, default: "" },
    saleDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

SaleSchema.index({ tenantId: 1, saleDate: -1 });
SaleSchema.index({ tenantId: 1, comandaIds: 1 });

export const Sale =
  mongoose.models.Sale || mongoose.model<ISale>("Sale", SaleSchema);
