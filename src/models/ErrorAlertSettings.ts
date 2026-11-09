import mongoose, { Schema } from "mongoose";

/** Configuración de los correos de alerta de errores. Hay una sola, global, editable desde el superadmin. */
export interface IErrorAlertSettings {
  _id: string;
  key: "global";
  enabled: boolean;
  recipients: string[];
  /** Correo de pico: tantos errores (nivel error) o más... */
  spikeThreshold: number;
  /** ...dentro de esta ventana. */
  spikeWindowMinutes: number;
  /** Tiempo mínimo entre dos correos de pico. */
  cooldownMinutes: number;
  /** Correo la primera vez que aparece un error grave que no se había visto. */
  notifyNewErrors: boolean;
  lastSpikeAlertAt: Date | null;
  lastNewErrorAlertAt: Date | null;
  lastSentAt: Date | null;
  lastSendError: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const ERROR_ALERT_DEFAULTS = {
  enabled: true,
  recipients: [] as string[],
  spikeThreshold: 10,
  spikeWindowMinutes: 15,
  cooldownMinutes: 60,
  notifyNewErrors: true,
};

export const ERROR_ALERT_LIMITS = {
  maxRecipients: 5,
  spikeThreshold: { min: 1, max: 1000 },
  spikeWindowMinutes: { min: 5, max: 1440 },
  cooldownMinutes: { min: 5, max: 1440 },
};

const ErrorAlertSettingsSchema = new Schema(
  {
    key:                 { type: String, enum: ["global"], required: true, unique: true },
    enabled:             { type: Boolean, default: ERROR_ALERT_DEFAULTS.enabled },
    recipients:          { type: [String], default: [] },
    spikeThreshold:      { type: Number, default: ERROR_ALERT_DEFAULTS.spikeThreshold },
    spikeWindowMinutes:  { type: Number, default: ERROR_ALERT_DEFAULTS.spikeWindowMinutes },
    cooldownMinutes:     { type: Number, default: ERROR_ALERT_DEFAULTS.cooldownMinutes },
    notifyNewErrors:     { type: Boolean, default: ERROR_ALERT_DEFAULTS.notifyNewErrors },
    lastSpikeAlertAt:    { type: Date, default: null },
    lastNewErrorAlertAt: { type: Date, default: null },
    lastSentAt:          { type: Date, default: null },
    lastSendError:       { type: String, default: "" },
    updatedBy:           { type: String, default: "" },
  },
  { timestamps: true, collection: "erroralertsettings" }
);

export const ErrorAlertSettings =
  mongoose.models.ErrorAlertSettings ||
  mongoose.model<IErrorAlertSettings>("ErrorAlertSettings", ErrorAlertSettingsSchema);
