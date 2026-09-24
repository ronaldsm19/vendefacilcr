import mongoose, { Schema } from "mongoose";
import type { ComandaStatus } from "@/lib/tableStatus";
import type { ProductStation } from "@/lib/station";
import { LineExtraSchema } from "@/models/LineExtra";
import type { LineExtra } from "@/lib/pricing";

// Cada union se declara UNA sola vez: ComandaStatus en src/lib/tableStatus.ts (Fase 2, módulo
// puro que ya lo consume en isOpenComanda/computeTableStatusFromComandas) y ProductStation en
// src/lib/station.ts. Acá solo se re-exportan por ergonomía, para no tener dos definiciones
// estructuralmente iguales que se desincronicen al agregar un estado o una estación.
export type { ComandaStatus, ProductStation };
export const COMANDA_OPEN_STATUSES: ComandaStatus[] = ["enviada", "servida"];

export interface IComandaItem {
  productId: string;
  productName: string;
  unitPrice: number;      // snapshot al comandar (precio BASE, sin extras)
  quantity: number;       // entero >= 1
  station: ProductStation;// snapshot de Product.station
  note: string;           // nota por ítem, "" si no hay
  paidQty: number;        // default 0; lo usa Fase 5
  extras?: LineExtra[];   // copia congelada de los extras elegidos (aplican a toda la línea); comandas viejas no lo tienen
}

export interface IComanda {
  _id: string;
  tenantId: string;
  number: number;
  tableId: string;
  tableLabel: string;
  areaId: string;
  areaName: string;
  customerName: string;
  waiterId: string;
  waiterName: string;
  waiterRole: "admin" | "cajero" | "mesero";
  items: IComandaItem[];
  notes: string;
  status: ComandaStatus;
  version: number;
  sentAt: Date;
  servedAt: Date | null;
  servedBy: string;
  paidAt: Date | null;
  saleIds: string[];
  cancelledAt: Date | null;
  cancelledBy: string;
  cancelReason: string;
  createdAt: Date;
  updatedAt: Date;
}

const ComandaItemSchema = new Schema(
  {
    productId:   { type: Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true, trim: true },
    unitPrice:   { type: Number, required: true, min: 0 },
    quantity:    { type: Number, required: true, min: 1 },
    station:     { type: String, enum: ["cocina", "bebidas", "ninguna"], default: "cocina" },
    note:        { type: String, default: "", maxlength: 200 },
    paidQty:     { type: Number, default: 0, min: 0 },
    extras:      { type: [LineExtraSchema], default: [] },
  },
  { _id: false }
);

const ComandaSchema = new Schema(
  {
    tenantId:     { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    number:       { type: Number, required: true },
    tableId:      { type: Schema.Types.ObjectId, ref: "SalonTable", required: true },
    tableLabel:   { type: String, default: "" },
    areaId:       { type: Schema.Types.ObjectId, ref: "TableArea", required: true },
    areaName:     { type: String, default: "" },
    customerName: { type: String, default: "", trim: true, maxlength: 80 },
    waiterId:     { type: String, required: true },
    waiterName:   { type: String, required: true },
    waiterRole:   { type: String, enum: ["admin", "cajero", "mesero"], required: true },
    items:        { type: [ComandaItemSchema], default: [] },
    notes:        { type: String, default: "", maxlength: 500 },
    status:       { type: String, enum: ["enviada", "servida", "pagada", "anulada"], default: "enviada" },
    version:      { type: Number, default: 1, min: 1 },
    sentAt:       { type: Date, required: true },
    servedAt:     { type: Date, default: null },
    servedBy:     { type: String, default: "" },
    paidAt:       { type: Date, default: null },
    saleIds:      { type: [String], default: [] },
    cancelledAt:  { type: Date, default: null },
    cancelledBy:  { type: String, default: "" },
    cancelReason: { type: String, default: "", maxlength: 200 },
  },
  { timestamps: true }
);

ComandaSchema.index({ tenantId: 1, number: 1 }, { unique: true });
ComandaSchema.index({ tenantId: 1, tableId: 1, status: 1 });
ComandaSchema.index({ tenantId: 1, sentAt: -1 });
ComandaSchema.index({ tenantId: 1, waiterId: 1, sentAt: -1 });

export const Comanda =
  mongoose.models.Comanda || mongoose.model<IComanda>("Comanda", ComandaSchema);
