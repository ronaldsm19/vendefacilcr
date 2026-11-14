import mongoose, { Schema } from "mongoose";
import { ID_TYPES, type IdType } from "@/lib/customerId";

/**
 * Cliente que pidió factura. Se registra una vez y la próxima se busca por cédula o por nombre.
 *
 * Guarda justo lo que pide Hacienda del receptor en el comprobante electrónico 4.4 (tipo y número
 * de identificación, nombre, correo y actividad), para que la fase de factura electrónica no tenga
 * que volver a pedirle nada a nadie. Cada venta facturada congela su propia copia de estos datos,
 * así que editar o borrar un cliente no cambia lo que ya se le mandó.
 */
export interface ICustomer {
  _id: string;
  tenantId: string;
  idType: IdType;
  /** Solo dígitos. Único por negocio junto con idType. */
  idNumber: string;
  /** Nombre o razón social, como lo tiene Hacienda. */
  name: string;
  /** name en minúsculas y sin tildes: la búsqueda por nombre va contra este campo. */
  searchName: string;
  /** A donde va el comprobante. */
  email: string;
  /** Copias (por ejemplo, la contabilidad de la empresa). */
  ccEmails: string[];
  phone: string;
  /** Actividad económica del cliente según Hacienda, p. ej. "5610.0". */
  activityCode: string;
  activityName: string;
  /** "Régimen general", "Régimen simplificado"... Informativo, como lo devolvió Hacienda. */
  haciendaRegime: string;
  notes: string;
  invoiceCount: number;
  lastInvoiceAt: Date | null;
  /** Nombre de quien lo registró (la dueña o el cajero). */
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const MAX_CC_EMAILS = 3;

const CustomerSchema = new Schema(
  {
    tenantId:       { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    idType:         { type: String, enum: ID_TYPES, required: true },
    idNumber:       { type: String, required: true, trim: true, match: /^\d{9,12}$/ },
    name:           { type: String, required: true, trim: true, maxlength: 160 },
    searchName:     { type: String, default: "" },
    email:          { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    ccEmails:       {
      type: [{ type: String, trim: true, lowercase: true, maxlength: 160 }],
      default: [],
      validate: { validator: (v: string[]) => v.length <= MAX_CC_EMAILS, message: `Máximo ${MAX_CC_EMAILS} copias` },
    },
    phone:          { type: String, default: "", trim: true, maxlength: 30 },
    activityCode:   { type: String, default: "", trim: true, maxlength: 12 },
    activityName:   { type: String, default: "", trim: true, maxlength: 200 },
    haciendaRegime: { type: String, default: "", trim: true, maxlength: 60 },
    notes:          { type: String, default: "", trim: true, maxlength: 300 },
    invoiceCount:   { type: Number, default: 0, min: 0 },
    lastInvoiceAt:  { type: Date, default: null },
    createdBy:      { type: String, default: "", trim: true, maxlength: 60 },
  },
  { timestamps: true }
);

CustomerSchema.index({ tenantId: 1, idType: 1, idNumber: 1 }, { unique: true });
CustomerSchema.index({ tenantId: 1, idNumber: 1 });
CustomerSchema.index({ tenantId: 1, searchName: 1 });
CustomerSchema.index({ tenantId: 1, lastInvoiceAt: -1, updatedAt: -1 });

export const Customer =
  mongoose.models.Customer || mongoose.model<ICustomer>("Customer", CustomerSchema);
