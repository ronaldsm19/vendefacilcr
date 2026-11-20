import {
  BookCheck, BookOpen, Boxes, CircleHelp, ClipboardList, Clock, Contact, CreditCard, FlaskConical, House,
  LayoutGrid, MonitorCheck, Package, Palette, PiggyBank, Plus, Receipt, Settings, ShoppingBag,
  ShoppingCart, Tag, TrendingUp, UserCircle, Users, UsersRound, Wallet, Warehouse,
  type LucideIcon,
} from "lucide-react";
import type { PlanKey } from "@/lib/billing";
import { can, planNeededFor, seesLockedSections, type Feature, type Role } from "@/lib/permissions";

/**
 * El menú del panel de cada negocio, agrupado por lo que la gente va a hacer. Antes eran 19 opciones
 * en una sola lista y los dueños no encontraban dónde estaba cada cosa. Lo leen el menú, el buscador
 * (Ctrl+K), la ruta de arriba de cada pantalla y los accesos rápidos de Inicio, así que una sección
 * nueva se agrega acá una sola vez.
 */

export interface NavItem {
  /** Primer segmento después de /<negocio>/admin ("" es Inicio). */
  segment: string;
  label: string;
  icon: LucideIcon;
  feature: Feature;
  /** Qué se hace ahí, en una frase. Sale en el buscador. */
  desc: string;
}

export interface NavGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

export const NAV_HOME: NavItem = {
  segment: "", label: "Inicio", icon: House, feature: "dashboard",
  desc: "Cómo va el día, los accesos rápidos y los primeros pasos.",
};

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "vender", label: "Vender", icon: ShoppingCart, items: [
      { segment: "pos", label: "Punto de venta", icon: MonitorCheck, feature: "pos", desc: "Cobrar en el mostrador: elegís los productos, cobrás y sale el tiquete. Podés tener varias cuentas abiertas a la vez." },
      { segment: "salon", label: "Salón", icon: LayoutGrid, feature: "salon", desc: "Tus mesas: quién está sentado, qué pidió y cuánto lleva." },
      { segment: "comandas", label: "Comandas", icon: ClipboardList, feature: "comandas", desc: "Los pedidos que van a cocina y en qué estado están." },
      { segment: "pedidos", label: "Pedidos y ventas", icon: ShoppingBag, feature: "pedidos", desc: "Todo lo que se vendió: por WhatsApp, en caja o en mesa." },
      { segment: "clientes", label: "Clientes", icon: Contact, feature: "clientes", desc: "Los clientes que piden factura, para buscarlos por cédula o por nombre." },
      { segment: "cierre-de-caja", label: "Cierre de caja", icon: BookCheck, feature: "cierre-de-caja", desc: "Abrir la caja en la mañana y cerrarla al final del día." },
    ],
  },
  {
    id: "productos", label: "Productos", icon: Boxes, items: [
      { segment: "productos", label: "Productos", icon: Package, feature: "productos", desc: "Lo que vendés: precios, fotos, extras, códigos de barras y disponibilidad." },
      { segment: "inventario", label: "Inventario", icon: Warehouse, feature: "inventario", desc: "Cuánto te queda de cada producto y qué hay que reponer." },
      { segment: "recetas", label: "Recetas", icon: BookOpen, feature: "recetas", desc: "Qué lleva cada producto, para saber cuánto te cuesta hacerlo." },
      { segment: "materiales", label: "Materiales", icon: FlaskConical, feature: "materiales", desc: "Los ingredientes y materiales que comprás para producir." },
    ],
  },
  {
    id: "finanzas", label: "Finanzas", icon: PiggyBank, items: [
      { segment: "finanzas", label: "Finanzas", icon: TrendingUp, feature: "finanzas", desc: "Cuánto entró, cuánto salió y cuánto te quedó." },
      { segment: "gastos", label: "Gastos", icon: Receipt, feature: "gastos", desc: "Anotar lo que pagás: proveedores, luz, alquiler." },
    ],
  },
  {
    id: "equipo", label: "Equipo", icon: UsersRound, items: [
      { segment: "usuarios", label: "Usuarios", icon: Users, feature: "usuarios", desc: "Tus cajeros y meseros, cada uno con su usuario y su PIN." },
      { segment: "jornada", label: "Jornada laboral", icon: Clock, feature: "jornada", desc: "Las horas que marca cada persona al entrar y al salir." },
      { segment: "planilla", label: "Planilla", icon: Wallet, feature: "planilla", desc: "Lo que le toca a cada quien según sus horas." },
    ],
  },
];

export const NAV_SETTINGS: NavItem = {
  segment: "configuracion", label: "Configuración", icon: Settings, feature: "configuracion",
  desc: "Logo y colores, portada, menú, ticket, comandas y caja.",
};

/** Lo de la cuenta del dueño: va en el menú de su nombre, abajo. */
export const NAV_ACCOUNT: NavItem[] = [
  { segment: "perfil", label: "Perfil", icon: UserCircle, feature: "perfil", desc: "Tus datos y tu contraseña." },
  { segment: "mensualidad", label: "Mensualidad", icon: CreditCard, feature: "mensualidad", desc: "Lo que le pagás a Ennea, cómo pagar y tus comprobantes." },
  { segment: "ayuda", label: "Ayuda", icon: CircleHelp, feature: "ayuda", desc: "Videos cortos que explican cómo se hace cada cosa en el panel." },
];

export const ACCOUNT_LABEL = "Mi cuenta";

/** Con pocas opciones (el mesero tiene tres) los grupos estorban: se muestran sueltas. */
const FLAT_UP_TO = 6;

/**
 * Lo que la gente busca por lo que quiere hacer, no por el nombre de la sección. `tab` abre esa
 * pestaña de Configuración.
 */
export interface NavAction {
  label: string;
  segment: string;
  tab?: string;
  /** Nombre de la pestaña, para la ruta ("Configuración › Marca"). */
  tabLabel?: string;
  icon: LucideIcon;
  keywords: string;
}

export const NAV_ACTIONS: NavAction[] = [
  { label: "Cobrar una venta", segment: "pos", icon: MonitorCheck, keywords: "vender cobrar caja venta pos tiquete mostrador cuenta cuentas otra cuenta varias pestaña" },
  { label: "Ver las comandas pendientes", segment: "comandas", icon: ClipboardList, keywords: "cocina pedidos mesa pendientes cobrar" },
  { label: "Agregar un producto", segment: "productos", icon: Plus, keywords: "nuevo producto crear menu precio foto" },
  { label: "Cambiar el logo o los colores", segment: "configuracion", tab: "marca", tabLabel: "Marca", icon: Palette, keywords: "logo color colores tema marca personalizar letra fuente" },
  { label: "Abrir o cerrar la caja", segment: "cierre-de-caja", icon: BookCheck, keywords: "caja apertura cierre efectivo turno arqueo" },
  { label: "Registrar un gasto", segment: "gastos", icon: Receipt, keywords: "gasto pago proveedor compra" },
  { label: "Agregar un mesero o cajero", segment: "usuarios", icon: Users, keywords: "usuario personal empleado mesero cajero pin" },
  { label: "Imprimir etiquetas con código de barras", segment: "productos", icon: Tag, keywords: "codigo barras etiqueta bascula peso imprimir" },
  { label: "Cambiar la foto de portada", segment: "configuracion", tab: "portada", tabLabel: "Portada", icon: Palette, keywords: "portada foto imagen tienda banner redes" },
  { label: "Ajustar el ticket", segment: "configuracion", tab: "ticket", tabLabel: "Ticket", icon: Receipt, keywords: "tiquete ticket impresora factura recibo" },
  { label: "Ver cuánto vendí", segment: "finanzas", icon: TrendingUp, keywords: "ventas ganancias reporte ingresos utilidad" },
  { label: "Ver las horas del personal", segment: "jornada", icon: Clock, keywords: "horas marcas entrada salida asistencia" },
  { label: "Pagar la mensualidad", segment: "mensualidad", icon: CreditCard, keywords: "pago mensualidad comprobante sinpe plan factura" },
  { label: "Cambiar mi contraseña", segment: "perfil", icon: UserCircle, keywords: "contrasena clave perfil seguridad" },
  { label: "Ver los videos de ayuda", segment: "ayuda", icon: CircleHelp, keywords: "ayuda video videos tutorial como se hace duda preguntas frecuentes aprender" },
];

export interface VisibleItem extends NavItem {
  href: string;
  /** El plan que le falta al negocio, si la sección se muestra con candado. */
  lockedPlan: PlanKey | null;
  groupId: string | null;
  groupLabel: string | null;
  account: boolean;
}

export interface VisibleGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  items: VisibleItem[];
}

export interface VisibleNav {
  home: VisibleItem | null;
  groups: VisibleGroup[];
  /** true: las opciones van sueltas, sin grupos. */
  flat: boolean;
  settings: VisibleItem | null;
  account: VisibleItem[];
  /** Todas las secciones que puede abrir, en el orden del menú. */
  all: VisibleItem[];
}

export interface NavScope {
  role: Role;
  plan: string;
  planLimits: boolean;
}

export function hrefFor(base: string, segment: string, tab?: string): string {
  const path = segment ? `${base}/${segment}` : base;
  return tab ? `${path}?tab=${encodeURIComponent(tab)}` : path;
}

/**
 * Lo que esta persona ve en el menú. Lo que su rol no puede usar no aparece; lo que el plan no
 * incluye aparece con candado solo para el dueño de un negocio con límites, igual que antes.
 */
export function visibleNav(scope: NavScope, base: string): VisibleNav {
  const showLocked = seesLockedSections(scope);
  const make = (item: NavItem, group: NavGroup | null, account = false): VisibleItem | null => {
    if (!can(scope, item.feature)) return null;
    const lockedPlan = planNeededFor(scope, item.feature);
    if (lockedPlan && !showLocked) return null;
    return { ...item, href: hrefFor(base, item.segment), lockedPlan, groupId: group?.id ?? null, groupLabel: group?.label ?? null, account };
  };

  const groups: VisibleGroup[] = NAV_GROUPS.map((g) => ({
    id: g.id, label: g.label, icon: g.icon,
    items: g.items.map((i) => make(i, g)).filter((i): i is VisibleItem => i !== null),
  })).filter((g) => g.items.length > 0);

  const grouped = groups.flatMap((g) => g.items);
  const home = make(NAV_HOME, null);
  const settings = make(NAV_SETTINGS, null);
  const account = NAV_ACCOUNT.map((i) => make(i, null, true)).filter((i): i is VisibleItem => i !== null);

  return {
    home,
    groups,
    flat: grouped.length <= FLAT_UP_TO,
    settings,
    account,
    all: [...(home ? [home] : []), ...grouped, ...(settings ? [settings] : []), ...account],
  };
}

export function isActiveItem(item: { href: string; segment: string }, pathname: string, base: string): boolean {
  if (!item.segment) return pathname === base || pathname === `${base}/`;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** La sección abierta, o null (una ruta fuera del menú). */
export function activeItem(nav: VisibleNav, pathname: string, base: string): VisibleItem | null {
  return nav.all.find((i) => isActiveItem(i, pathname, base)) ?? null;
}

/**
 * Dónde vive una sección, como se lee en la ruta de arriba y en el buscador: "Vender › Punto de venta".
 * Con el menú sin grupos no se nombra el grupo, y si el grupo se llama igual que la sección
 * ("Productos › Productos") se dice una sola vez.
 */
export function locationOf(item: VisibleItem, flat: boolean, tabLabel?: string): string[] {
  const parts: string[] = [];
  if (item.account) parts.push(ACCOUNT_LABEL);
  else if (item.groupLabel && !flat && item.groupLabel !== item.label) parts.push(item.groupLabel);
  parts.push(item.label);
  if (tabLabel) parts.push(tabLabel);
  return parts;
}
