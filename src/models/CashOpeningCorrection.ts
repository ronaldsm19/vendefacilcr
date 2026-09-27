import { Schema } from "mongoose";

export const MAX_OPENING_CORRECTION_NOTE = 200;

/**
 * Corrección de lo que se digitó al abrir la caja. En la primera apertura del negocio lo digitado
 * es la caja inicial (`openingAmount`); en las demás, la caja inicial es lo que quedó en el cierre
 * anterior y lo digitado es el conteo (`countedAmount`). Queda el monto anterior y quién lo cambió,
 * para que una corrección nunca borre el rastro.
 */
export interface ICashOpeningCorrection {
  field: "openingAmount" | "countedAmount";
  /** Sin dato si el campo estaba vacío. */
  previousAmount?: number;
  newAmount: number;
  byName: string;
  byRole: string;
  note?: string;
  date: Date;
}

export const CashOpeningCorrectionSchema = new Schema(
  {
    field:          { type: String, enum: ["openingAmount", "countedAmount"], required: true },
    previousAmount: { type: Number },
    newAmount:      { type: Number, required: true, min: 0 },
    byName:         { type: String, default: "" },
    byRole:         { type: String, default: "" },
    note:           { type: String, default: "", maxlength: MAX_OPENING_CORRECTION_NOTE },
    date:           { type: Date, required: true },
  },
  { _id: false }
);
