import { Schema } from "mongoose";
import { MAX_EXTRA_NAME, MAX_EXTRA_QTY } from "@/lib/pricing";

/**
 * Copia congelada de un extra elegido en una línea de comanda, venta o pedido. Se guarda el precio
 * que tenía el extra al momento de comandar o vender, no una referencia al catálogo.
 */
export const LineExtraSchema = new Schema(
  {
    name:  { type: String, required: true, trim: true, maxlength: MAX_EXTRA_NAME },
    price: { type: Number, required: true, min: 0 },
    // Porciones del extra por unidad de la línea (documentos viejos no lo traen: cuentan como 1).
    qty:   { type: Number, default: 1, min: 1, max: MAX_EXTRA_QTY },
  },
  { _id: false }
);
