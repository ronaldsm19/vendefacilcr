import mongoose, { Schema } from "mongoose";
import { PRODUCTS_SECTION_LIMITS as L, type ProductsSectionText } from "@/lib/storeTexts";

export interface ISiteSettings {
  tenantId: string;
  hero: {
    tagline: string;
    subtagline: string;
    badge: string;
  };
  about: {
    title: string;
    paragraph1: string;
    paragraph2: string;
    images: string[];
  };
  /** Textos de la sección de productos de la tienda (vacío = texto neutro, ver src/lib/storeTexts.ts). */
  productsSection?: ProductsSectionText;
}

const SiteSettingsSchema = new Schema(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: false, index: true },
    hero: {
      tagline:    { type: String, default: "" },
      subtagline: { type: String, default: "" },
      badge:      { type: String, default: "" },
    },
    about: {
      title:      { type: String, default: "" },
      paragraph1: { type: String, default: "" },
      paragraph2: { type: String, default: "" },
      images:     { type: [String], default: [] },
    },
    productsSection: {
      eyebrow:     { type: String, default: "", maxlength: L.eyebrow },
      title:       { type: String, default: "", maxlength: L.title },
      highlight:   { type: String, default: "", maxlength: L.highlight },
      description: { type: String, default: "", maxlength: L.description },
      badge:       { type: String, default: "", maxlength: L.badge },
    },
  },
  { timestamps: true }
);

export const SiteSettings =
  mongoose.models.SiteSettings || mongoose.model("SiteSettings", SiteSettingsSchema);
