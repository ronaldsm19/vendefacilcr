import { PLAN_KEYS, PLAN_LABELS, type PlanKey } from "@/lib/billing";
import { EMPRENDE_MAX_PRODUCTS } from "@/lib/planes";

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
  | "productos:ajustar"    // precio, extras y disponibilidad de un producto que ya existe
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
  | "mensualidad"          // lo que el negocio le paga a Ennea y sus comprobantes
  | "usuarios"
  | "comandas"             // reservado para Fase 3
  | "jornada"             // control de jornada laboral (marcaje + reportes)
  | "planilla";           // pagos al personal según sus horas

export const PERMISSIONS: Record<Feature, Role[]> = {
  dashboard:          ["admin"],
  // Ver el catálogo lo necesita todo el personal: el precio de un producto se lo preguntan al
  // mesero en la mesa.
  productos:          ["admin", "cajero", "mesero"],
  // La caja ajusta precio, extras y disponibilidad de lo que ya existe, porque es quien está
  // delante cuando sube un costo, cambia una porción o se acaba algo a media tarde. Crear,
  // borrar e importar siguen siendo del dueño: son las acciones de las que no se vuelve.
  "productos:ajustar": ["admin", "cajero"],
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
  // Lo que paga el negocio es cosa del dueño: el personal no lo ve.
  mensualidad:        ["admin"],
  usuarios:           ["admin"],
  comandas:           ["admin", "cajero", "mesero"],
  jornada:            ["admin", "cajero"],
  planilla:           ["admin"],
};

/**
 * Plan mínimo de cada sección, igual a lo que publica el landing (src/lib/planes.ts). Lo que no
 * aparece acá está en todos los planes.
 */
export const FEATURE_MIN_PLAN: Partial<Record<Feature, PlanKey>> = {
  pos:              "pro",
  "cierre-de-caja": "pro",
  salon:            "pro",
  "salon:editar":   "pro",
  gastos:           "pro",
  materiales:       "pro",
  recetas:          "pro",
  finanzas:         "pro",
  jornada:          "premium",
  usuarios:         "premium",
  comandas:         "premium",
  planilla:         "premium",
};

/**
 * Las que exigen Premium desde antes de que existieran los límites por plan: se le piden a todo
 * negocio. El resto de FEATURE_MIN_PLAN, solo a los que tienen los límites aplicados.
 */
export const PREMIUM_FEATURES: Feature[] = ["usuarios", "comandas", "planilla"];

/**
 * El plan de un negocio y si se le aplican los límites. Los negocios creados antes de los límites
 * (planLimits = false) conservan todo lo que tenían, menos lo que siempre fue de Premium.
 */
export interface PlanScope {
  plan: string | null | undefined;
  planLimits: boolean;
}

function planRank(plan: string | null | undefined): number {
  return Math.max(0, PLAN_KEYS.indexOf(plan as PlanKey));
}

/** El plan que le falta al negocio para usar la sección, o null si el suyo ya la incluye. */
export function planNeededFor(scope: PlanScope, feature: Feature): PlanKey | null {
  const min = FEATURE_MIN_PLAN[feature];
  if (!min) return null;
  if (!scope.planLimits && !PREMIUM_FEATURES.includes(feature)) return null;
  return planRank(scope.plan) >= planRank(min) ? null : min;
}

export function planAllows(scope: PlanScope, feature: Feature): boolean {
  return planNeededFor(scope, feature) === null;
}

export function planRequiredMessage(plan: PlanKey): string {
  return `Disponible en el plan ${PLAN_LABELS[plan]}`;
}

/** Cuántos productos puede tener el negocio, o null si su plan no tiene tope. */
export function productLimit(scope: PlanScope): number | null {
  return scope.planLimits && planRank(scope.plan) === 0 ? EMPRENDE_MAX_PRODUCTS : null;
}

/**
 * Al dueño de un negocio con límites se le muestran las secciones de otros planes con candado,
 * para que sepa que existen. Al resto se le ocultan, como siempre.
 */
export function seesLockedSections(session: { role: Role; planLimits: boolean }): boolean {
  return session.planLimits && session.role === "admin";
}

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
  mensualidad:      "mensualidad",
  usuarios:         "usuarios",
  comandas:         "comandas",
  jornada:          "jornada",
  planilla:         "planilla",
};

/** Nombre de cada sección, como sale en el menú del panel. */
export const SECTION_LABELS: Record<string, string> = {
  "":               "Dashboard",
  productos:        "Productos",
  inventario:       "Inventario",
  materiales:       "Materiales",
  recetas:          "Recetas",
  pedidos:          "Pedidos y ventas",
  gastos:           "Gastos",
  finanzas:         "Finanzas",
  pos:              "Punto de venta",
  "cierre-de-caja": "Cierre de caja",
  jornada:          "Jornada laboral",
  planilla:         "Planilla",
  salon:            "Salón",
  comandas:         "Comandas",
  usuarios:         "Usuarios",
  configuracion:    "Configuración",
  perfil:           "Perfil",
  mensualidad:      "Mensualidad",
};

/** Las secciones del menú que el plan del negocio no incluye, con el plan que piden. */
export function lockedSections(scope: PlanScope): { label: string; plan: PlanKey }[] {
  return Object.entries(ROUTE_FEATURES).flatMap(([segment, feature]) => {
    const plan = planNeededFor(scope, feature);
    return plan ? [{ label: SECTION_LABELS[segment] ?? segment, plan }] : [];
  });
}

export function featureForPath(pathname: string, base: string): Feature | null {
  if (!pathname.startsWith(base)) return null;
  const rest = pathname.slice(base.length).replace(/^\//, "");
  const segment = rest.split("/")[0] ?? "";
  if (segment === "login") return null;
  return ROUTE_FEATURES[segment] ?? null;
}
