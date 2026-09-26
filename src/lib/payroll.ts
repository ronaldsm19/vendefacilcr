// Planilla: tipos, etiquetas y fórmulas compartidas entre pantallas, servicios y endpoints.
// Igual que src/lib/pricing.ts, este archivo NO importa mongoose ni Next: lo usa tanto una
// ruta de API como un componente "use client", y el servidor y la pantalla calculan con las
// MISMAS funciones — lo que se ve es exactamente lo que se va a guardar.
//
// Esto es un control interno de pagos, no una planilla legal: no calcula CCSS, no liquida
// aguinaldo ni vacaciones, y no produce documentos tributarios.

// ── Tarifa ────────────────────────────────────────────────────────────────────

export type PayMode = "hora" | "dia" | "quincena" | "mes";
export const PAY_MODES: PayMode[] = ["hora", "dia", "quincena", "mes"];

export const PAY_MODE_LABELS: Record<PayMode, string> = {
  hora: "Por hora",
  dia: "Por día",
  quincena: "Fijo quincenal",
  mes: "Fijo mensual",
};

export const PAY_MODE_SUFFIX: Record<PayMode, string> = {
  hora: "/hora",
  dia: "/día",
  quincena: " por quincena",
  mes: " por mes",
};

export interface StaffPay {
  mode: PayMode;
  /** Colones enteros: por hora, por día, o el fijo del período según `mode`. */
  rate: number;
  /** Si además del sueldo le toca parte del 10% de servicio. */
  includesService: boolean;
  notes: string;
}

export const DEFAULT_STAFF_PAY: StaffPay = {
  mode: "hora",
  rate: 0,
  includesService: false,
  notes: "",
};

/** Tope de cordura para la tarifa: más que esto es un dedo de más, no un sueldo. */
export const MAX_PAY_RATE = 10_000_000;

/** Normaliza lo que haya guardado: los empleados creados antes de Planilla no traen `pay`. */
export function readStaffPay(raw: unknown): StaffPay {
  const p = (raw ?? {}) as Partial<StaffPay>;
  const mode = PAY_MODES.includes(p.mode as PayMode) ? (p.mode as PayMode) : DEFAULT_STAFF_PAY.mode;
  const rate =
    typeof p.rate === "number" && Number.isFinite(p.rate) && p.rate >= 0 ? Math.round(p.rate) : 0;
  return {
    mode,
    rate,
    includesService: p.includesService === true,
    notes: typeof p.notes === "string" ? p.notes.slice(0, 200) : "",
  };
}

/**
 * Monto que corresponde por la tarifa.
 *
 * Por hora se prorratea al minuto, porque media hora trabajada es media hora que se debe. Por
 * día se cuentan días distintos con turno, no turnos: quien entra, sale a almorzar y vuelve
 * trabajó un día, no dos. Los fijos no miran las horas — son fijos por definición.
 */
export function amountForPay(pay: StaffPay, minutes: number, days: number): number {
  if (pay.rate <= 0) return 0;
  switch (pay.mode) {
    case "hora":
      return Math.round((pay.rate * minutes) / 60);
    case "dia":
      return pay.rate * days;
    case "quincena":
    case "mes":
      return pay.rate;
  }
}

export function payRateLabel(pay: StaffPay): string {
  if (pay.rate <= 0) return "Sin tarifa";
  return `₡${pay.rate.toLocaleString("es-CR")}${PAY_MODE_SUFFIX[pay.mode]}`;
}

// ── Pagos ─────────────────────────────────────────────────────────────────────

export type PayMethod = "efectivo" | "sinpe" | "transferencia" | "otro";
export const PAY_METHODS: PayMethod[] = ["efectivo", "sinpe", "transferencia", "otro"];
export const PAY_METHOD_LABELS: Record<PayMethod, string> = {
  efectivo: "Efectivo",
  sinpe: "SINPE Móvil",
  transferencia: "Transferencia",
  otro: "Otro",
};
/** Métodos donde tiene sentido pedir referencia y guardar el pantallazo. */
export const METHODS_WITH_PROOF: PayMethod[] = ["sinpe", "transferencia"];

export type PayLineKind = "horas" | "servicio" | "propina" | "bono" | "adelanto" | "deduccion" | "otro";
export const PAY_LINE_KINDS: PayLineKind[] = [
  "horas",
  "servicio",
  "propina",
  "bono",
  "adelanto",
  "deduccion",
  "otro",
];
export const PAY_LINE_LABELS: Record<PayLineKind, string> = {
  horas: "Horas trabajadas",
  servicio: "10% de servicio",
  propina: "Propinas",
  bono: "Bono",
  adelanto: "Adelanto",
  deduccion: "Deducción",
  otro: "Otro",
};
/** Conceptos que restan: se guardan en negativo. */
export const NEGATIVE_KINDS: PayLineKind[] = ["adelanto", "deduccion"];

export function isNegativeKind(kind: PayLineKind): boolean {
  return NEGATIVE_KINDS.includes(kind);
}

export interface PayLine {
  kind: PayLineKind;
  label: string;
  /** Colones enteros CON SIGNO: adelantos y deducciones en negativo. */
  amount: number;
}

/** Total a partir de las líneas. Única fórmula: la usan el servidor y la pantalla. */
export function totalOfLines(lines: { amount: number }[]): number {
  return lines.reduce((s, l) => s + Math.round(l.amount), 0);
}

// ── Lo que devuelven los endpoints ────────────────────────────────────────────

export interface PayrollRow {
  staffUserId: string;
  name: string;
  role: "cajero" | "mesero";
  phone: string;
  pay: StaffPay;
  /** Minutos cerrados del período que se está viendo, pagados o no. */
  periodMinutes: number;
  /** Minutos cerrados sin pagar de TODO el tiempo: una quincena vieja sigue debiéndose. */
  unpaidMinutes: number;
  /** Días distintos con turno cerrado sin pagar. Es la base cuando se paga por día. */
  unpaidDays: number;
  dueAmount: number;
  /** Turnos abiertos ahora: sus horas todavía no cuentan. */
  openShifts: number;
  lastPayment: { _id: string; paidAt: string; total: number } | null;
}

export interface PayrollOverview {
  rows: PayrollRow[];
  totals: { due: number; unpaidMinutes: number; paidInPeriod: number };
}

export interface UnpaidShift {
  _id: string;
  startedAt: string;
  endedAt: string;
  minutes: number;
  /** Día calendario de Costa Rica en que EMPEZÓ, YYYY-MM-DD. */
  day: string;
}

export interface PaymentView {
  _id: string;
  staffUserId: string;
  staffName: string;
  staffRole: string;
  basis: { mode: PayMode; rate: number; minutes: number; days: number };
  periodFrom: string;
  periodTo: string;
  lines: PayLine[];
  total: number;
  method: PayMethod;
  reference: string;
  proofImage: string;
  receiptPdf: string;
  paidAt: string;
  createdByName: string;
  notes: string;
  voidedAt: string | null;
  voidedByName: string;
  voidReason: string;
  /** Turnos que cubrió, para el detalle y el comprobante. */
  shifts?: UnpaidShift[];
}

export interface StaffPayrollDetailData {
  staff: { _id: string; name: string; role: string; phone: string; pay: StaffPay };
  unpaidShifts: UnpaidShift[];
  payments: PaymentView[];
}

// ── Formato ───────────────────────────────────────────────────────────────────

export function money(n: number): string {
  const v = Math.round(n);
  return `${v < 0 ? "−" : ""}₡${Math.abs(v).toLocaleString("es-CR")}`;
}

/**
 * Número a letras en español, para el comprobante. Los comprobantes de pago llevan el monto
 * escrito además de en cifras: es lo que hace difícil alterar un cero a mano.
 */
export function numberToWords(n: number): string {
  const v = Math.round(Math.abs(n));
  if (v === 0) return "cero colones";

  const UNITS = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve",
    "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve"];
  const TENS = ["", "", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
  const HUNDREDS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos",
    "seiscientos", "setecientos", "ochocientos", "novecientos"];

  function underThousand(x: number): string {
    if (x === 0) return "";
    if (x === 100) return "cien";
    const h = Math.floor(x / 100);
    const rest = x % 100;
    const head = HUNDREDS[h];
    if (rest === 0) return head;
    let tail: string;
    if (rest < 20) tail = UNITS[rest];
    else if (rest < 30) tail = rest === 20 ? "veinte" : `veinti${UNITS[rest - 20]}`;
    else {
      const t = Math.floor(rest / 10);
      const u = rest % 10;
      tail = u === 0 ? TENS[t] : `${TENS[t]} y ${UNITS[u]}`;
    }
    return head ? `${head} ${tail}` : tail;
  }

  /**
   * Apócope: delante de un sustantivo masculino, "uno" pierde la o. Acá siempre hay uno
   * detrás —"mil", "millones", "colones"— así que se aplica siempre: veintiún mil, treinta y
   * un colones, ciento un colones.
   */
  function apocopate(s: string): string {
    if (s === "veintiuno") return "veintiún";
    if (s.endsWith("veintiuno")) return `${s.slice(0, -9)}veintiún`;
    if (s === "uno") return "un";
    if (s.endsWith(" uno")) return `${s.slice(0, -4)} un`;
    return s;
  }

  const millions = Math.floor(v / 1_000_000);
  const thousands = Math.floor((v % 1_000_000) / 1000);
  const rest = v % 1000;

  const parts: string[] = [];
  if (millions === 1) parts.push("un millón");
  else if (millions > 1) parts.push(`${apocopate(underThousand(millions))} millones`);
  if (thousands === 1) parts.push("mil");
  else if (thousands > 1) parts.push(`${apocopate(underThousand(thousands))} mil`);
  if (rest > 0) parts.push(apocopate(underThousand(rest)));

  return `${parts.join(" ")} colones`;
}

/** Teléfono a formato de enlace de WhatsApp. Ocho dígitos = número tico, se le antepone 506. */
export function whatsappNumber(raw: string): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 8) return `506${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return digits;
  return null;
}
