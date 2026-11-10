import mongoose, { Schema } from "mongoose";

/** Quién vio un aviso y cuándo: una fila por aviso y persona. */
export interface INoticeRead {
  _id: string;
  noticeId: mongoose.Types.ObjectId;
  tenantId: mongoose.Types.ObjectId;
  /** Id del dueño (User) o del personal (StaffUser), como texto: vienen de colecciones distintas. */
  userId: string;
  userName: string;
  role: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  /** Veces que lo cerró (crece en los avisos que salen en cada inicio de sesión). */
  count: number;
}

const NoticeReadSchema = new Schema<INoticeRead>(
  {
    noticeId: { type: Schema.Types.ObjectId, ref: "TenantNotice", required: true },
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    userId: { type: String, required: true },
    userName: { type: String, default: "" },
    role: { type: String, default: "" },
    firstSeenAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    count: { type: Number, default: 1 },
  },
  { collection: "noticereads" },
);

NoticeReadSchema.index({ noticeId: 1, userId: 1 }, { unique: true });

export const NoticeRead =
  mongoose.models.NoticeRead || mongoose.model<INoticeRead>("NoticeRead", NoticeReadSchema);
