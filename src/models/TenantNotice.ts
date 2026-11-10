import mongoose, { Schema } from "mongoose";
import type { NoticeAudience, NoticeKind, NoticeRoles } from "@/lib/notices";

/** Aviso del superadmin a los negocios; se muestra dentro del panel de cada negocio. */
export interface ITenantNotice {
  _id: string;
  kind: NoticeKind;
  title: string;
  body: string;
  /** "all": todos los negocios; "tenants": solo los de tenantIds. */
  audience: NoticeAudience;
  tenantIds: mongoose.Types.ObjectId[];
  roles: NoticeRoles;
  /** Se vuelve a mostrar en cada inicio de sesión mientras esté vigente (no solo la primera vez). */
  showEveryLogin: boolean;
  expiresAt: Date | null;
  active: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const TenantNoticeSchema = new Schema<ITenantNotice>(
  {
    kind: { type: String, enum: ["info", "cobro", "urgente"], required: true },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    body: { type: String, required: true, trim: true, maxlength: 600 },
    audience: { type: String, enum: ["all", "tenants"], required: true },
    tenantIds: [{ type: Schema.Types.ObjectId, ref: "Tenant" }],
    roles: { type: String, enum: ["owner", "all"], default: "owner" },
    showEveryLogin: { type: Boolean, default: false },
    expiresAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true, collection: "tenantnotices" },
);

TenantNoticeSchema.index({ active: 1, createdAt: -1 });

export const TenantNotice =
  mongoose.models.TenantNotice || mongoose.model<ITenantNotice>("TenantNotice", TenantNoticeSchema);
