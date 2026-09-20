import type { ComandaConfigData } from "@/lib/comandaConfig";

export type BadgeLevel = "ok" | "warn" | "alert";
export type ComandaThresholds = Pick<ComandaConfigData, "warnMinutes" | "alertMinutes">;

export function minutesBetween(from: Date | string, to: Date | string): number {
  return Math.max(0, Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 60000));
}
/** Reloj por comanda: sentAt → servedAt, o → ahora si sigue enviada. Null si no aplica. */
export function comandaMinutes(c: { status: string; sentAt: Date | string; servedAt?: Date | string | null }, now: Date | string = new Date()): number | null {
  if (c.status === "enviada") return minutesBetween(c.sentAt, now);
  if (c.status === "servida" && c.servedAt) return minutesBetween(c.sentAt, c.servedAt);
  return null;
}
export function badgeLevel(minutes: number, t: ComandaThresholds): BadgeLevel {
  if (minutes >= t.alertMinutes) return "alert";
  if (minutes >= t.warnMinutes) return "warn";
  return "ok";
}
export const BADGE_COLORS: Record<BadgeLevel, { bg: string; text: string }> = {
  ok:    { bg: "#16a34a", text: "#ffffff" },
  warn:  { bg: "#f59e0b", text: "#1a1a2e" },
  alert: { bg: "#dc2626", text: "#ffffff" },
};
