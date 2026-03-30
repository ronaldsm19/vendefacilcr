import mongoose, { Schema } from "mongoose";

export interface IProductionIngredient {
  rawMaterialId: string;
  rawMaterialName: string;
  quantity: number;
  unit: string;
}

export interface IProduction {
  _id: string;
  tenantId: string;
  recipeId: string;
  recipeName: string;
  batches: number;
  unitsProduced: number;
  notes?: string;
  ingredientsUsed: IProductionIngredient[];
  createdAt: Date;
}

const ProductionIngredientSchema = new Schema(
  {
    rawMaterialId:   { type: Schema.Types.ObjectId, ref: "RawMaterial", required: true },
    rawMaterialName: { type: String, required: true },
    quantity:        { type: Number, required: true },
    unit:            { type: String, required: true },
  },
  { _id: false }
);

const ProductionSchema = new Schema(
  {
    tenantId:        { type: Schema.Types.ObjectId, ref: "Tenant", required: false, index: true },
    recipeId:        { type: Schema.Types.ObjectId, ref: "Recipe", required: true },
    recipeName:      { type: String, required: true },
    batches:         { type: Number, required: true, min: 1 },
    unitsProduced:   { type: Number, required: true, min: 1 },
    notes:           { type: String },
    ingredientsUsed: { type: [ProductionIngredientSchema], default: [] },
  },
  { timestamps: true }
);

export const Production =
  mongoose.models.Production || mongoose.model<IProduction>("Production", ProductionSchema);
