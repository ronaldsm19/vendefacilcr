import mongoose, { Schema } from "mongoose";
import { DEFAULT_PLAN_PRICES } from "@/lib/billing";

/**
 * Configuración del cobro automático (una sola, global). La edita el superadmin en Cobros.
 *
 * Arranca APAGADO: al encenderlo, solo maneja facturas desde el mes siguiente (startPeriod), así
 * las facturas viejas que quedaron "pendientes" sin marcar nunca disparan una suspensión.
 */

export interface IPaymentInstructions {
  sinpeNumber: string;
  sinpeName: string;
  iban: string;
  ibanName: string;
  /** WhatsApp para mandar el comprobante. */
  whatsapp: string;
  notes: string;
}

export interface IBillingSettings {
  key: "global";
  enabled: boolean;
  /** Primer mes (yyyymm) que maneja el cobro automático. null = nunca se encendió. */
  startPeriod: number | null;
  prices: { emprende: number; pro: number; premium: number };
  /** Días antes del vencimiento para el primer recordatorio. */
  reminderDays: number;
  /** Días después del vencimiento antes de suspender. */
  graceDays: number;
  autoSuspend: boolean;
  payment: IPaymentInstructions;
  lastRunAt: Date | null;
  lastRunSummary: string;
  lastRunError: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const BILLING_DEFAULTS = {
  enabled: false,
  startPeriod: null,
  prices: { ...DEFAULT_PLAN_PRICES },
  reminderDays: 3,
  graceDays: 3,
  autoSuspend: true,
  payment: { sinpeNumber: "", sinpeName: "", iban: "", ibanName: "", whatsapp: "", notes: "" },
};

export const BILLING_LIMITS = {
  price: { min: 0, max: 1_000_000 },
  reminderDays: { min: 1, max: 10 },
  graceDays: { min: 0, max: 15 },
};

/** El día de cobro es el 1 para todos (decisión del 2026-11-09). */
export const BILLING_DUE_DAY = 1;

const BillingSettingsSchema = new Schema<IBillingSettings>(
  {
    key: { type: String, enum: ["global"], default: "global", unique: true },
    enabled: { type: Boolean, default: false },
    startPeriod: { type: Number, default: null },
    prices: {
      emprende: { type: Number, default: DEFAULT_PLAN_PRICES.emprende },
      pro: { type: Number, default: DEFAULT_PLAN_PRICES.pro },
      premium: { type: Number, default: DEFAULT_PLAN_PRICES.premium },
    },
    reminderDays: { type: Number, default: 3 },
    graceDays: { type: Number, default: 3 },
    autoSuspend: { type: Boolean, default: true },
    payment: {
      sinpeNumber: { type: String, default: "" },
      sinpeName: { type: String, default: "" },
      iban: { type: String, default: "" },
      ibanName: { type: String, default: "" },
      whatsapp: { type: String, default: "" },
      notes: { type: String, default: "" },
    },
    lastRunAt: { type: Date, default: null },
    lastRunSummary: { type: String, default: "" },
    lastRunError: { type: String, default: "" },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true, collection: "billingsettings" },
);

export const BillingSettings =
  mongoose.models.BillingSettings || mongoose.model<IBillingSettings>("BillingSettings", BillingSettingsSchema);
