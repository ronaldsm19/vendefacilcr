import mongoose, { Schema } from "mongoose";

export type TableStatus = "libre" | "ocupada" | "reservada";
export type TableShape  = "round" | "square" | "rectangle" | "barstool";

export interface ISalonTable {
  _id: string;
  tenantId: string;
  areaId: string;
  shape: TableShape;
  x: number;        // % of canvas width
  y: number;        // % of canvas height
  seats: number;
  label: string;
  status: TableStatus;
  statusNote: string;
}

const SalonTableSchema = new Schema(
  {
    tenantId:   { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    areaId:     { type: Schema.Types.ObjectId, ref: "TableArea", required: true },
    shape:      { type: String, enum: ["round", "square", "rectangle", "barstool"], default: "round" },
    x:          { type: Number, default: 50 },
    y:          { type: Number, default: 50 },
    seats:      { type: Number, default: 4 },
    label:      { type: String, default: "" },
    status:     { type: String, enum: ["libre", "ocupada", "reservada"], default: "libre" },
    statusNote: { type: String, default: "" },
  },
  { timestamps: true }
);

SalonTableSchema.index({ tenantId: 1, areaId: 1 });

export const SalonTable =
  mongoose.models.SalonTable || mongoose.model<ISalonTable>("SalonTable", SalonTableSchema);
