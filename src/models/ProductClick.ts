import mongoose, { Schema } from "mongoose";

export interface IProductClick {
  _id: string;
  tenantId: string;
  productId: string;
  productName: string;
  timestamp: Date;
}

const ProductClickSchema = new Schema({
  tenantId:    { type: Schema.Types.ObjectId, ref: "Tenant", required: false, index: true },
  productId:   { type: String, required: true, index: true },
  productName: { type: String, required: true },
  timestamp:   { type: Date, default: Date.now, index: true },
});

export const ProductClick =
  mongoose.models.ProductClick ||
  mongoose.model("ProductClick", ProductClickSchema);
