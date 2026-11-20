import mongoose, { Schema } from "mongoose";
import { HELP_LIMITS, HELP_SECTIONS, type HelpSection } from "@/lib/helpVideos";

/**
 * Video de ayuda que carga el superadmin; lo ven todos los negocios en su panel mientras esté
 * visible. Se puede guardar sin enlace (para dejar la lista lista) pero no mostrarse sin él.
 */
export interface IHelpVideo {
  _id: string;
  title: string;
  description: string;
  /** Id de YouTube (11 caracteres); "" mientras el video no esté subido. */
  youtubeId: string;
  section: HelpSection;
  /** Orden dentro de su sección: menor primero. */
  order: number;
  visible: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const HelpVideoSchema = new Schema<IHelpVideo>(
  {
    title: { type: String, required: true, trim: true, maxlength: HELP_LIMITS.title },
    description: { type: String, default: "", trim: true, maxlength: HELP_LIMITS.description },
    youtubeId: { type: String, default: "", match: /^([A-Za-z0-9_-]{11})?$/ },
    section: { type: String, enum: HELP_SECTIONS.map((s) => s.key), required: true },
    order: { type: Number, default: 0, min: 0, max: HELP_LIMITS.order },
    visible: { type: Boolean, default: false },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true, collection: "helpvideos" },
);

HelpVideoSchema.index({ visible: 1, section: 1, order: 1 });

export const HelpVideo =
  mongoose.models.HelpVideo || mongoose.model<IHelpVideo>("HelpVideo", HelpVideoSchema);
