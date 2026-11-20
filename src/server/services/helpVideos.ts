import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { HelpVideo, type IHelpVideo } from "@/models/HelpVideo";
import { ServiceError } from "@/server/errors";
import { can, ROUTE_FEATURES } from "@/lib/permissions";
import {
  HELP_LIMITS, OPEN_HELP_SECTIONS, helpSectionRank, isHelpSection, youtubeId, type HelpSection,
} from "@/lib/helpVideos";
import type { AdminPayload } from "@/lib/auth";

/**
 * Videos de ayuda. El superadmin los carga y decide cuáles se muestran; cada persona del negocio ve
 * los visibles de las secciones que su rol puede abrir (el mesero no ve los de finanzas).
 */

type VideoLean = IHelpVideo & { _id: mongoose.Types.ObjectId };

function sorted(videos: VideoLean[]): VideoLean[] {
  return [...videos].sort((a, b) =>
    helpSectionRank(a.section) - helpSectionRank(b.section) || a.order - b.order || a.title.localeCompare(b.title, "es"));
}

/** ¿Esta persona puede ver los videos de esa sección? */
function sectionAllowed(session: AdminPayload, section: string): boolean {
  if (OPEN_HELP_SECTIONS.includes(section as HelpSection)) return true;
  const feature = ROUTE_FEATURES[section];
  return feature ? can(session, feature) : false;
}

/** Los videos que ve quien está en el panel. */
export async function helpVideosForSession(session: AdminPayload) {
  await connectToDatabase();
  const videos = await HelpVideo.find({ visible: true, youtubeId: { $ne: "" } }).lean() as unknown as VideoLean[];
  return {
    videos: sorted(videos)
      .filter((v) => sectionAllowed(session, v.section))
      .map((v) => ({ id: String(v._id), title: v.title, description: v.description, youtubeId: v.youtubeId, section: v.section })),
  };
}

// ── Superadmin ──────────────────────────────────────────────────────────────

function text(value: unknown, min: number, max: number, label: string): string {
  if (value === undefined || value === null) value = "";
  if (typeof value !== "string") throw new ServiceError(400, `${label}: texto inválido`);
  const t = value.trim();
  if (t.length < min) throw new ServiceError(400, `${label}: ${min === 1 ? "no puede estar vacío" : `mínimo ${min} caracteres`}`);
  if (t.length > max) throw new ServiceError(400, `${label}: hasta ${max} caracteres`);
  return t;
}

/** Lo que manda el formulario del superadmin, revisado. `partial` = solo los campos que vinieron. */
function parse(raw: Record<string, unknown>, partial: boolean) {
  const out: Partial<Pick<IHelpVideo, "title" | "description" | "youtubeId" | "section" | "order" | "visible">> = {};
  if (!partial || "title" in raw) out.title = text(raw.title, 3, HELP_LIMITS.title, "Título");
  if (!partial || "description" in raw) out.description = text(raw.description, 0, HELP_LIMITS.description, "Descripción");
  if (!partial || "url" in raw) {
    const url = typeof raw.url === "string" ? raw.url.trim() : "";
    if (url) {
      const id = youtubeId(url);
      if (!id) throw new ServiceError(400, "El enlace no es de un video de YouTube");
      out.youtubeId = id;
    } else {
      out.youtubeId = "";
    }
  }
  if (!partial || "section" in raw) {
    if (!isHelpSection(raw.section)) throw new ServiceError(400, "Sección inválida");
    out.section = raw.section;
  }
  if (!partial || "order" in raw) {
    const order = raw.order === undefined || raw.order === "" ? 0 : Number(raw.order);
    if (!Number.isInteger(order) || order < 0 || order > HELP_LIMITS.order) throw new ServiceError(400, "Orden inválido");
    out.order = order;
  }
  if (!partial || "visible" in raw) {
    if (raw.visible !== undefined && typeof raw.visible !== "boolean") throw new ServiceError(400, "Falta indicar si se muestra");
    out.visible = raw.visible === true;
  }
  return out;
}

function assertShowable(v: { visible?: boolean; youtubeId?: string }) {
  if (v.visible && !v.youtubeId) throw new ServiceError(400, "Para mostrarlo, pegá primero el enlace del video");
}

export async function listHelpVideos() {
  await connectToDatabase();
  const videos = await HelpVideo.find({}).lean() as unknown as VideoLean[];
  return {
    videos: sorted(videos).map((v) => ({
      id: String(v._id), title: v.title, description: v.description, youtubeId: v.youtubeId,
      section: v.section, order: v.order, visible: v.visible, createdBy: v.createdBy, updatedAt: v.updatedAt,
    })),
  };
}

export async function createHelpVideo(raw: Record<string, unknown>, createdBy: string) {
  const data = parse(raw, false);
  assertShowable(data);
  await connectToDatabase();
  const video = await HelpVideo.create({ ...data, createdBy });
  return { id: String(video._id) };
}

export async function updateHelpVideo(id: string, raw: Record<string, unknown>) {
  if (!mongoose.isValidObjectId(id)) throw new ServiceError(404, "Video no encontrado");
  const data = parse(raw, true);
  await connectToDatabase();
  const current = await HelpVideo.findById(id).select("visible youtubeId").lean() as unknown as Pick<IHelpVideo, "visible" | "youtubeId"> | null;
  if (!current) throw new ServiceError(404, "Video no encontrado");
  assertShowable({ visible: data.visible ?? current.visible, youtubeId: data.youtubeId ?? current.youtubeId });
  await HelpVideo.updateOne({ _id: id }, { $set: data });
  return { ok: true };
}

export async function deleteHelpVideo(id: string) {
  if (!mongoose.isValidObjectId(id)) throw new ServiceError(404, "Video no encontrado");
  await connectToDatabase();
  const r = await HelpVideo.deleteOne({ _id: id });
  if (!r.deletedCount) throw new ServiceError(404, "Video no encontrado");
  return { ok: true };
}
