/**
 * Avisos de Ennea a los negocios: los escribe el superadmin y aparecen dentro del panel de cada
 * negocio. Tipos y textos compartidos entre el servidor y las pantallas.
 */

export type NoticeKind = "info" | "cobro" | "urgente";
/** Quién lo ve dentro del negocio: solo el dueño, o también cajeros y meseros. */
export type NoticeRoles = "owner" | "all";
export type NoticeAudience = "all" | "tenants";

export const NOTICE_KINDS: { value: NoticeKind; label: string; hint: string }[] = [
  { value: "info", label: "Informativo", hint: "Novedades, mantenimientos, recordatorios generales." },
  { value: "cobro", label: "Cobro", hint: "Lleva la mensualidad del negocio y cómo pagar. Solo lo ve el dueño." },
  { value: "urgente", label: "Urgente", hint: "Se destaca en rojo." },
];

export const NOTICE_LIMITS = { title: 80, body: 600, tenants: 200 };

export function isNoticeKind(value: unknown): value is NoticeKind {
  return NOTICE_KINDS.some((k) => k.value === value);
}

export const noticeKindLabel = (kind: string) => NOTICE_KINDS.find((k) => k.value === kind)?.label ?? kind;

/** Marca que deja el login para que el panel muestre los avisos "en cada inicio de sesión". */
export const LOGIN_NOTICES_FLAG = "vf_login_notices";
