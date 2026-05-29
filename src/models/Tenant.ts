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
    instagram: { type: String, default: "" },
    facebook:  { type: String, default: "" },
    tiktok:    { type: String, default: "" },
    youtube:   { type: String, default: "" },
  },
  { timestamps: true }
);

export const Tenant =
  mongoose.models.Tenant || mongoose.model<ITenant>("Tenant", TenantSchema);
