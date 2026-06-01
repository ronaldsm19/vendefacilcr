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

export interface ITenant {
  _id: string;
  slug: string;
  name: string;
  email: string;
  whatsappNumber: string;
  logoUrl: string;
  description: string;
  plan: "emprende" | "pro" | "premium";
  status: "active" | "inactive" | "suspended";
  theme: ITenantTheme;
  menuConfig: IMenuConfig;
  posConfig: { ivaEnabled: boolean; ivaRate: number; tipEnabled: boolean; serviceRate: number; tableCount: number };
  instagram: string;
  facebook: string;
  tiktok: string;
  youtube: string;
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
    status:          { type: String, enum: ["active", "inactive", "suspended"], default: "active" },
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
    posConfig: {
      ivaEnabled:  { type: Boolean, default: false },
      ivaRate:     { type: Number,  default: 13 },
      tipEnabled:  { type: Boolean, default: false },
      serviceRate: { type: Number,  default: 10 },
      tableCount:  { type: Number,  default: 0 },
    },
    instagram: { type: String, default: "" },
    facebook:  { type: String, default: "" },
    tiktok:    { type: String, default: "" },
    youtube:   { type: String, default: "" },
  },
  { timestamps: true }
);

export const Tenant =
  mongoose.models.Tenant || mongoose.model<ITenant>("Tenant", TenantSchema);
