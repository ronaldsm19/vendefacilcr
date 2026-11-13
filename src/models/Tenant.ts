import mongoose, { Schema } from "mongoose";

export interface ITenantTheme {
  primaryColor: string;   // e.g. "#FF6B9D"
  secondaryColor: string; // e.g. "#FF8C42"
  accentColor: string;    // e.g. "#FFD166"
  backgroundColor?: string;
  logoShape?: "circle" | "rounded" | "square" | "none";
  logoBgColor?: string;
  heroImageUrl?: string;
  fontFamily?: "default" | "playfair" | "montserrat" | "nunito" | "lato";
  darkMode?: boolean;
}

export interface IMenuConfig {
  columns: 1 | 2 | 3;
  showImage: boolean;
  showPrice: boolean;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  bgImageUrl: string;
  bgBlur: number;
  title: string;
  description: string;
  fontFamily: "default" | "playfair" | "montserrat" | "nunito" | "lato";
}

export interface ITicketConfig {
  businessName: string;
  location: string;
  address: string;
  phone: string;
  email: string;
  ownerName: string;
  taxId: string;
  taxRegime: string;
  footerMessage: string;
  terminalNumber: string;
  ticketPrefix: string;
  ticketNextNumber: number;
}

export interface IComandaConfig {
  warnMinutes: number;   // badge amarillo desde este valor (Fase 3)
  alertMinutes: number;  // badge rojo desde este valor (Fase 3)
  nextNumber: number;    // consecutivo de comanda, $inc atómico en Fase 3
}

export interface ITenant {
  _id: string;
  slug: string;
  name: string;
  email: string;
  whatsappNumber: string;
  logoUrl: string;
  description: string;
  plan: "emprende" | "pro" | "premium";
  /**
   * Si se le aplican los límites de su plan (secciones y tope de productos). Los negocios creados
   * antes de los límites no tienen el campo y conservan todo lo que tenían, salvo lo que siempre fue
   * de Premium; los nuevos nacen con true. Lo cambia el superadmin.
   */
  planLimits: boolean;
  status: "active" | "inactive" | "suspended";
  /** Por qué no está activo (lo elige el superadmin). "" mientras está activo. */
  suspendedReason: "" | "falta_pago" | "solicitud" | "otro";
  /** Mensaje opcional para el dueño, que ve en la pantalla de suspensión. */
  suspendedMessage: string;
  suspendedAt: Date | null;
  /** Precio especial del negocio: descuento o sin costo (lo define el superadmin). */
  billing: {
    discountType: "none" | "percent" | "amount";
    discountValue: number;
    discountUntil: Date | null;
    discountLabel: string;
    free: boolean;
    freeUntil: Date | null;
    freeReason: string;
    /** Cuándo se le avisó que su periodo sin costo termina (una sola vez por fecha de fin). */
    freeEndNoticeAt: Date | null;
    /** Programa Restaurantes Fundadores: primer mes del programa; null = no está (ver lib/billing). */
    founderStart: Date | null;
  };
  theme: ITenantTheme;
  menuConfig: IMenuConfig;
  posConfig: { ivaEnabled: boolean; ivaRate: number; serviceEnabled: boolean; serviceRate: number; tipEnabled: boolean };
  ticketConfig: ITicketConfig;
  comandaConfig: IComandaConfig;
  instagram: string;
  facebook: string;
  tiktok: string;
  youtube: string;
  passwordChanged: boolean;
  printAgentToken: string;              // 64 hex; "" = sin token
  printAgentLastSeenAt: Date | null;
  saleDeletePasswordHash: string;       // bcrypt; "" = sin configurar (Fase 7)
  createdAt: Date;
  updatedAt: Date;
}

const TenantSchema = new Schema(
  {
    slug:            { type: String, required: true, unique: true, lowercase: true, trim: true },
    name:            { type: String, required: true, trim: true },
    email:           { type: String, required: true, trim: true, lowercase: true },
    whatsappNumber:  { type: String, required: true, trim: true },
    logoUrl:         { type: String, default: "" },
    description:     { type: String, default: "" },
    plan:            { type: String, enum: ["emprende", "pro", "premium"], default: "emprende" },
    // false por defecto a propósito: así un negocio viejo leído y vuelto a guardar no queda
    // limitado sin que nadie lo decida. Los negocios nuevos lo reciben en true al crearse.
    planLimits:      { type: Boolean, default: false },
    status:          { type: String, enum: ["active", "inactive", "suspended"], default: "active" },
    suspendedReason: { type: String, enum: ["", "falta_pago", "solicitud", "otro"], default: "" },
    suspendedMessage: { type: String, default: "", maxlength: 300 },
    suspendedAt:     { type: Date, default: null },
    billing: {
      discountType:    { type: String, enum: ["none", "percent", "amount"], default: "none" },
      discountValue:   { type: Number, default: 0, min: 0 },
      discountUntil:   { type: Date, default: null },
      discountLabel:   { type: String, default: "", maxlength: 60 },
      free:            { type: Boolean, default: false },
      freeUntil:       { type: Date, default: null },
      freeReason:      { type: String, default: "", maxlength: 60 },
      freeEndNoticeAt: { type: Date, default: null },
      founderStart:    { type: Date, default: null },
    },
    theme: {
      primaryColor:    { type: String, default: "#6366F1" },
      secondaryColor:  { type: String, default: "#8B5CF6" },
      accentColor:     { type: String, default: "#F59E0B" },
      backgroundColor: { type: String, default: "#FFFFFF" },
      logoShape:       { type: String, enum: ["circle", "rounded", "square", "none"], default: "circle" },
      logoBgColor:     { type: String, default: "" },
      heroImageUrl:    { type: String, default: "" },
      fontFamily:      { type: String, enum: ["default", "playfair", "montserrat", "nunito", "lato"], default: "default" },
      darkMode:        { type: Boolean, default: false },
    },
    menuConfig: {
      columns:        { type: Number, enum: [1, 2, 3], default: 2 },
      showImage:      { type: Boolean, default: true },
      showPrice:      { type: Boolean, default: true },
      primaryColor:   { type: String, default: "" },
      secondaryColor: { type: String, default: "" },
      accentColor:    { type: String, default: "" },
      bgImageUrl:     { type: String, default: "" },
      bgBlur:         { type: Number, default: 0, min: 0, max: 100 },
      title:          { type: String, default: "" },
      description:    { type: String, default: "" },
      fontFamily:     { type: String, enum: ["default", "playfair", "montserrat", "nunito", "lato"], default: "default" },
    },
    // Cobros del punto de venta: los fija el dueño en Configuración → Caja y valen para todos los
    // roles; el punto de venta solo los lee (ver src/lib/pricing.ts).
    posConfig: {
      ivaEnabled:     { type: Boolean, default: false },
      ivaRate:        { type: Number,  default: 13, min: 0, max: 100 },
      serviceEnabled: { type: Boolean, default: false },
      serviceRate:    { type: Number,  default: 10, min: 0, max: 100 },
      tipEnabled:     { type: Boolean, default: false },
    },
    ticketConfig: {
      businessName:     { type: String, default: "" },
      location:         { type: String, default: "" },
      address:          { type: String, default: "" },
      phone:            { type: String, default: "" },
      email:            { type: String, default: "" },
      ownerName:        { type: String, default: "" },
      taxId:            { type: String, default: "" },
      taxRegime:        { type: String, default: "Régimen Simplificado" },
      footerMessage:    { type: String, default: "¡Gracias por su compra!" },
      terminalNumber:   { type: String, default: "1" },
      ticketPrefix:     { type: String, default: "" },
      ticketNextNumber: { type: Number, default: 1, min: 1 },
    },
    comandaConfig: {
      warnMinutes:  { type: Number, default: 15, min: 1, max: 600 },
      alertMinutes: { type: Number, default: 30, min: 1, max: 600 },
      nextNumber:   { type: Number, default: 1, min: 1 },
    },
    instagram: { type: String, default: "" },
    facebook:  { type: String, default: "" },
    tiktok:    { type: String, default: "" },
    youtube:   { type: String, default: "" },
    passwordChanged: { type: Boolean, default: false },
    printAgentToken:      { type: String, default: "", select: false },
    printAgentLastSeenAt: { type: Date, default: null },
    saleDeletePasswordHash: { type: String, default: "", select: false },
  },
  { timestamps: true }
);

TenantSchema.index({ printAgentToken: 1 });

export const Tenant =
  mongoose.models.Tenant || mongoose.model<ITenant>("Tenant", TenantSchema);
