import mongoose, { Schema } from "mongoose";

export type PrintJobType = "comanda" | "venta" | "cierre";
export type PrintJobStatus = "pending" | "printing" | "done" | "failed";
export type PrintJobStation = "cocina" | "bebidas" | "";

export interface IPrintJob {
  _id: string;
  tenantId: string;
  type: PrintJobType;
  payload: Record<string, unknown>;   // JSON exacto que entiende el agente
  status: PrintJobStatus;
  attempts: number;                    // veces que el agente lo reclamó
  lastError: string;
  claimedAt: Date | null;
  printedAt: Date | null;
  refId: string;                       // comandaId | saleId | cashCloseId
  station: PrintJobStation;            // solo para type "comanda"
  createdAt: Date;
  updatedAt: Date;
}

const PrintJobSchema = new Schema(
  {
    tenantId:  { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    type:      { type: String, enum: ["comanda", "venta", "cierre"], required: true },
    payload:   { type: Schema.Types.Mixed, required: true },
    status:    { type: String, enum: ["pending", "printing", "done", "failed"], default: "pending" },
    attempts:  { type: Number, default: 0, min: 0 },
    lastError: { type: String, default: "" },
    claimedAt: { type: Date, default: null },
    printedAt: { type: Date, default: null },
    refId:     { type: String, default: "" },
    station:   { type: String, enum: ["cocina", "bebidas", ""], default: "" },
  },
  { timestamps: true }
);

// Reclamo FIFO por tenant y estado
PrintJobSchema.index({ tenantId: 1, status: 1, createdAt: 1 });
// Listado admin (últimos 20)
PrintJobSchema.index({ tenantId: 1, createdAt: -1 });
// Limpieza automática: los jobs se borran 30 días después de creados
PrintJobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export const PrintJob =
  mongoose.models.PrintJob || mongoose.model<IPrintJob>("PrintJob", PrintJobSchema);
