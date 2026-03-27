import mongoose, { Schema } from "mongoose";

export interface ISiteSettings {
  tenantId: string;
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
    about: {
      title:      { type: String, default: "Hechos con amor en Turrialba" },
      paragraph1: { type: String, default: "Dulce Pecado nació de un momento espontáneo, con muchas ganas de crear algo especial." },
      paragraph2: { type: String, default: "Hoy, cada postre y cada apretado gourmet está hecho con amor, buscando convertir lo simple en algo delicioso 🤍✨" },
      images:     { type: [String], default: [] },
    },
  },
  { timestamps: true }
);

export const SiteSettings =
  mongoose.models.SiteSettings || mongoose.model("SiteSettings", SiteSettingsSchema);
