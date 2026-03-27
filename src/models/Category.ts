import mongoose, { Schema } from "mongoose";

export interface ICategory {
  _id: string;
  tenantId: string;
  label: string;
  createdAt: Date;
}

const CategorySchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: false, index: true },
    label:    { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export const Category =
  mongoose.models.Category || mongoose.model("Category", CategorySchema);
