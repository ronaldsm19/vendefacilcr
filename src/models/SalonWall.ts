import mongoose, { Schema } from "mongoose";

export type WallOrientation = "horizontal" | "vertical";
export type WallType        = "wall" | "counter";

export interface ISalonWall {
  _id: string;
  tenantId: string;
  areaId: string;
  x: number;
  y: number;
  length: number;        // % of canvas width/height depending on orientation
  orientation: WallOrientation;
  wallType: WallType;
}

const SalonWallSchema = new Schema(
  {
    tenantId:    { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    areaId:      { type: Schema.Types.ObjectId, ref: "TableArea", required: true },
    x:           { type: Number, default: 50 },
    y:           { type: Number, default: 50 },
    length:      { type: Number, default: 25 },
    orientation: { type: String, enum: ["horizontal", "vertical"], default: "horizontal" },
    wallType:    { type: String, enum: ["wall", "counter"], default: "wall" },
  },
  { timestamps: true }
);

SalonWallSchema.index({ tenantId: 1, areaId: 1 });

export const SalonWall =
  mongoose.models.SalonWall || mongoose.model<ISalonWall>("SalonWall", SalonWallSchema);
