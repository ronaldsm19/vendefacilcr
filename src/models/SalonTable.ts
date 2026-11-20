import mongoose, { Schema } from "mongoose";

export type TableStatus = "libre" | "ocupada" | "por_limpiar" | "reservada";
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
  occupiedAt: Date | null;   // set al pasar a "ocupada"
  dirtyAt: Date | null;      // set al pasar a "por_limpiar"
  cleanedAt: Date | null;    // set al pasar de "por_limpiar" a "libre"
  cleanedBy: string;         // session.name de quien limpió
  /**
   * Candado suave de cobro (Fase 2 POS multi-cuenta): mientras una caja está cobrando esta mesa,
   * las demás la ven "en cobro por …" y no la pueden cobrar. Es un lease: se renueva con heartbeat
   * y expira solo si la caja se cae (ver src/lib/cobroLock.ts). null = libre para cobrar.
   */
  cobroLock?: {
    by: string;        // userId de quien cobra
    byName: string;    // nombre que se muestra ("en cobro por …")
    at: Date;          // cuándo lo tomó
    expiresAt: Date;   // vence si no se renueva
  } | null;
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
    status:     { type: String, enum: ["libre", "ocupada", "por_limpiar", "reservada"], default: "libre" },
    statusNote: { type: String, default: "" },
    occupiedAt: { type: Date, default: null },
    dirtyAt:    { type: Date, default: null },
    cleanedAt:  { type: Date, default: null },
    cleanedBy:  { type: String, default: "" },
    cobroLock:  {
      type: new Schema(
        { by: String, byName: String, at: Date, expiresAt: Date },
        { _id: false }
      ),
      default: null,
    },
  },
  { timestamps: true }
);

SalonTableSchema.index({ tenantId: 1, areaId: 1 });
SalonTableSchema.index({ tenantId: 1, status: 1 });

export const SalonTable =
  mongoose.models.SalonTable || mongoose.model<ISalonTable>("SalonTable", SalonTableSchema);
