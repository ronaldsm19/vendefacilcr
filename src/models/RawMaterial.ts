import mongoose, { Schema } from "mongoose";

export type RawMaterialType = "ingrediente" | "empaque" | "topping";

export interface IRawMaterial {
  _id: string;
  tenantId: string;
  name: string;
  type: RawMaterialType;
  unit: string;
  stock: number;
  minStock: number;
  costPerUnit?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const RawMaterialSchema = new Schema(
  {
    tenantId:    { type: Schema.Types.ObjectId, ref: "Tenant", required: false, index: true },
    name:        { type: String, required: [true, "El nombre es requerido"], trim: true },
    type:        { type: String, enum: ["ingrediente", "empaque", "topping"], default: "ingrediente" },
    unit:        { type: String, required: [true, "La unidad es requerida"], trim: true },
    stock:       { type: Number, default: 0, min: [0, "El stock no puede ser negativo"] },
    minStock:    { type: Number, default: 0, min: 0 },
    costPerUnit: { type: Number, min: 0 },
    notes:       { type: String },
  },
  { timestamps: true }
);

export const RawMaterial =
  mongoose.models.RawMaterial || mongoose.model<IRawMaterial>("RawMaterial", RawMaterialSchema);
