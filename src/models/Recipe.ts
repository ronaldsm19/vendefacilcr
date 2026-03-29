import mongoose, { Schema } from "mongoose";

export interface IRecipeIngredient {
  rawMaterialId: string;
  rawMaterialName: string;
  quantity: number;
  unit: string;
}

export interface IRecipe {
  _id: string;
  tenantId: string;
  name: string;
  description?: string;
  yield: number;
  sellingPrice: number;
  ingredients: IRecipeIngredient[];
  createdAt: Date;
  updatedAt: Date;
}

const RecipeIngredientSchema = new Schema(
  {
    rawMaterialId:   { type: Schema.Types.ObjectId, ref: "RawMaterial", required: true },
    rawMaterialName: { type: String, required: true },
    quantity:        { type: Number, required: true, min: [0.001, "La cantidad debe ser positiva"] },
    unit:            { type: String, required: true },
  },
  { _id: false }
);

const RecipeSchema = new Schema(
  {
    tenantId:     { type: Schema.Types.ObjectId, ref: "Tenant", required: false, index: true },
    name:         { type: String, required: [true, "El nombre es requerido"], trim: true },
    description:  { type: String },
    yield:        { type: Number, default: 1, min: [1, "El rendimiento debe ser al menos 1"] },
    sellingPrice: { type: Number, default: 0, min: 0 },
    ingredients:  { type: [RecipeIngredientSchema], default: [] },
  },
  { timestamps: true }
);

export const Recipe =
  mongoose.models.Recipe || mongoose.model<IRecipe>("Recipe", RecipeSchema);
