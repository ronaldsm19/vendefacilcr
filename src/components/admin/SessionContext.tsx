"use client";

import { createContext, useContext } from "react";
import type { Role } from "@/lib/permissions";

export interface AdminSession {
  role: Role;
  userId: string;
  name: string;
  email: string;
  plan: string;
  isPremium: boolean;
  tenantSlug: string;
  tenantName: string;
}

const SessionContext = createContext<AdminSession | null>(null);
export const AdminSessionProvider = SessionContext.Provider;

/** Sesión del panel ya verificada por AdminShell. Nunca es null dentro de <AdminShell> fuera de /login. */
export function useAdminSession(): AdminSession {
  const s = useContext(SessionContext);
  if (!s) throw new Error("useAdminSession debe usarse dentro de AdminShell");
  return s;
}
