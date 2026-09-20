export type Role = "admin" | "cajero" | "mesero";
export type StaffRole = Exclude<Role, "admin">;

export const ROLES: Role[] = ["admin", "cajero", "mesero"];
export const STAFF_ROLES: StaffRole[] = ["cajero", "mesero"];
export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrador",
  cajero: "Cajero",
  mesero: "Mesero",
};

export const ERROR_FORBIDDEN = "No tenés permiso para esta acción";
export const ERROR_PREMIUM = "Disponible en el plan Premium";

export type Feature =
  | "dashboard"
  | "productos"            // ver
  | "productos:editar"     // crear, editar, borrar, importar, categorías, stock
  | "inventario"
  | "materiales"
  | "recetas"
  | "pedidos"
  | "gastos"
  | "finanzas"
  | "pos"
  | "cierre-de-caja"
  | "salon"                // ver
  | "salon:editar"         // diseño, estados manuales, reservas
  | "configuracion"
  | "perfil"
  | "usuarios"
  | "comandas";            // reservado para Fase 3

export const PERMISSIONS: Record<Feature, Role[]> = {
  dashboard:          ["admin"],
  productos:          ["admin", "cajero"],
  "productos:editar": ["admin"],
  inventario:         ["admin"],
  materiales:         ["admin"],
  recetas:            ["admin"],
  pedidos:            ["admin", "cajero"],
  gastos:             ["admin"],
  finanzas:           ["admin"],
  pos:                ["admin", "cajero"],
  "cierre-de-caja":   ["admin", "cajero"],
  salon:              ["admin", "cajero", "mesero"],
  "salon:editar":     ["admin", "cajero"],
  configuracion:      ["admin"],
  perfil:             ["admin"],
  usuarios:           ["admin"],
  comandas:           ["admin", "cajero", "mesero"],
};

/** Features que además exigen plan premium (menú oculto + 403 en API). */
export const PREMIUM_FEATURES: Feature[] = ["usuarios", "comandas"];

export function can(session: { role: Role } | null | undefined, feature: Feature): boolean {
  if (!session) return false;
  return PERMISSIONS[feature].includes(session.role);
}

export function hasRole(session: { role: Role } | null | undefined, ...roles: Role[]): boolean {
  return !!session && roles.includes(session.role);
}

export function isPremiumPlan(plan: string | undefined | null): boolean {
  return plan === "premium";
}

/** Ruta inicial de cada rol, relativa a `base` = `/${slug}/admin`. */
export function homePathFor(role: Role, base: string): string {
  if (role === "cajero") return `${base}/pos`;
  if (role === "mesero") return `${base}/salon`;
  return base;
}

/** Primer segmento después de `/${slug}/admin` → feature. Rutas desconocidas → null (no se bloquean). */
export const ROUTE_FEATURES: Record<string, Feature> = {
  "":               "dashboard",
  productos:        "productos",
  inventario:       "inventario",
  materiales:       "materiales",
  recetas:          "recetas",
  pedidos:          "pedidos",
  gastos:           "gastos",
  finanzas:         "finanzas",
  pos:              "pos",
  "cierre-de-caja": "cierre-de-caja",
  salon:            "salon",
  configuracion:    "configuracion",
  perfil:           "perfil",
  usuarios:         "usuarios",
};

export function featureForPath(pathname: string, base: string): Feature | null {
  if (!pathname.startsWith(base)) return null;
  const rest = pathname.slice(base.length).replace(/^\//, "");
  const segment = rest.split("/")[0] ?? "";
  if (segment === "login") return null;
  return ROUTE_FEATURES[segment] ?? null;
}
