import mongoose, { Schema } from "mongoose";

/** De dónde vino: el panel en el navegador, una falla del servidor o el agente de impresión. */
export type ErrorSource = "navegador" | "servidor" | "agente";
/** Aviso: un 4xx con mensaje para el usuario. Error: algo que no debería pasar. */
export type ErrorLevel = "aviso" | "error";
export type ErrorKind = "respuesta" | "sin_conexion" | "excepcion" | "agente_rechazado";

export const ERROR_SOURCES: ErrorSource[] = ["navegador", "servidor", "agente"];
export const ERROR_LEVELS: ErrorLevel[] = ["aviso", "error"];
export const ERROR_KINDS: ErrorKind[] = ["respuesta", "sin_conexion", "excepcion", "agente_rechazado"];

export const ERROR_RETENTION_DAYS = 90;
/** Errores idénticos del mismo negocio dentro de este tramo se guardan en un solo registro con contador. */
export const ERROR_BUCKET_MINUTES = 5;

export interface IErrorEvent {
  _id: string;
  tenantId: string | null;
  tenantSlug: string;
  source: ErrorSource;
  level: ErrorLevel;
  kind: ErrorKind;
  method: string;
  /** Ruta de la API con los ids reemplazados por :id, para que se agrupen. */
  route: string;
  status: number | null;
  /** El texto que vio el usuario (o el del error, si vino del servidor). */
  message: string;
  code: string;
  /** Pantalla del panel donde pasó, sin el slug del negocio. */
  page: string;
  userName: string;
  userRole: string;
  userAgent: string;
  stack: string;
  digest: string;
  appVersion: string;
  fingerprint: string;
  /** Inicio del tramo de ERROR_BUCKET_MINUTES. */
  bucket: Date;
  count: number;
  firstAt: Date;
  lastAt: Date;
  /** Primera vez que este error grave aparece en ERROR_RETENTION_DAYS: merece un correo. */
  firstSeen: boolean;
  notifiedAt: Date | null;
}

const ErrorEventSchema = new Schema(
  {
    tenantId:    { type: Schema.Types.ObjectId, ref: "Tenant", default: null },
    tenantSlug:  { type: String, default: "" },
    source:      { type: String, enum: ERROR_SOURCES, required: true },
    level:       { type: String, enum: ERROR_LEVELS, required: true },
    kind:        { type: String, enum: ERROR_KINDS, required: true },
    method:      { type: String, default: "" },
    route:       { type: String, default: "" },
    status:      { type: Number, default: null },
    message:     { type: String, default: "" },
    code:        { type: String, default: "" },
    page:        { type: String, default: "" },
    userName:    { type: String, default: "" },
    userRole:    { type: String, default: "" },
    userAgent:   { type: String, default: "" },
    stack:       { type: String, default: "" },
    digest:      { type: String, default: "" },
    appVersion:  { type: String, default: "" },
    fingerprint: { type: String, required: true },
    bucket:      { type: Date, required: true },
    count:       { type: Number, default: 1, min: 1 },
    firstAt:     { type: Date, required: true },
    lastAt:      { type: Date, required: true },
    firstSeen:   { type: Boolean, default: false },
    notifiedAt:  { type: Date, default: null },
  },
  { timestamps: false }
);

// Un registro por error, negocio y tramo: las repeticiones solo suben el contador.
ErrorEventSchema.index({ fingerprint: 1, tenantId: 1, bucket: 1 }, { unique: true });
// Se borran solos a los ERROR_RETENTION_DAYS.
ErrorEventSchema.index({ bucket: 1 }, { expireAfterSeconds: ERROR_RETENTION_DAYS * 24 * 60 * 60 });
ErrorEventSchema.index({ tenantId: 1, bucket: -1 });
ErrorEventSchema.index({ level: 1, lastAt: -1 });
ErrorEventSchema.index({ firstSeen: 1, notifiedAt: 1 });

export const ErrorEvent =
  mongoose.models.ErrorEvent || mongoose.model<IErrorEvent>("ErrorEvent", ErrorEventSchema);
