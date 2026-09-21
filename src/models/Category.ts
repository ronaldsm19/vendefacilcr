import mongoose, { Schema } from "mongoose";

export interface ICategory {
  _id: string;
  tenantId: string;
  label: string;
  order: number;
  createdAt: Date;
}

const CategorySchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: false, index: true },
    label:    { type: String, required: true, trim: true },
    order:    { type: Number, default: 0 },
  },
  { timestamps: true }
);

CategorySchema.index({ tenantId: 1, order: 1 });

export const Category =
  mongoose.models.Category || mongoose.model("Category", CategorySchema);
