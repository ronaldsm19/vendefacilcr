import mongoose, { Schema } from "mongoose";

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
  },
  { timestamps: true }
);

export const SiteSettings =
  mongoose.models.SiteSettings || mongoose.model("SiteSettings", SiteSettingsSchema);
