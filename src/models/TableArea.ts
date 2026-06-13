import mongoose, { Schema } from "mongoose";

export interface ITableArea {
  _id: string;
  tenantId: string;
  name: string;
  color: string;
  order: number;
}

const TableAreaSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    name:     { type: String, required: true },
    color:    { type: String, default: "#6366f1" },
    order:    { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const TableArea =
  mongoose.models.TableArea || mongoose.model<ITableArea>("TableArea", TableAreaSchema);
