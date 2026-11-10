"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bug, Check, CircleAlert, Clock, Gift, Inbox, Lock, Tag, TriangleAlert, type LucideIcon } from "lucide-react";
import { PLAN_LABELS, formatCRC, type PlanKey } from "@/lib/billing";
import { suspensionReasonLabel } from "@/lib/suspension";

type BillingState = "suspendido" | "gratis" | "atrasado" | "vence" | "aldia";
type TodayKind = "late" | "dueSoon" | "suspended" | "request" | "errors";
type Filter = "todos" | "vence" | "atrasado" | "suspendido";

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  suspendedReason: string;
  billingState: BillingState;
  amount: number;
  listAmount: number;
  discountLabel: string;
  free: boolean;
  nextDue: string | null;
  lastAccessAt: string | null;
}

interface DashboardData {
  period: string;
  month: { expected: number; paid: number; pending: number; late: number; withoutInvoiceCount: number; withoutInvoiceExpected: number };
  attention: { dueSoon: number; late: number; suspended: number; pendingRequests: number; errors24h: number };
  today: { kind: TodayKind; title: string; detail: string; href: string }[];
  tenants: TenantRow[];
  automation: { enabled: boolean; cronConfigured: boolean; lastRunAt: string | null; lastRunSummary: string; lastRunError: string };
}

const STATE_CHIP: Record<BillingState, { label: string; className: string; icon: LucideIcon }> = {
  aldia: { label: "Al día", className: "sa-chip sa-chip-ok", icon: Check },
  vence: { label: "Vence pronto", className: "sa-chip sa-chip-warn", icon: Clock },
  atrasado: { label: "Atrasado", className: "sa-chip sa-chip-danger", icon: CircleAlert },
  suspendido: { label: "Suspendido", className: "sa-chip", icon: Lock },
  gratis: { label: "Sin costo", className: "sa-chip sa-chip-info", icon: Gift },
};

const TODAY_KIND: Record<TodayKind, { icon: LucideIcon; tone: string; action: string }> = {
  late: { icon: CircleAlert, tone: "sa-danger-text", action: "Ver negocio" },
  dueSoon: { icon: Clock, tone: "sa-warn-text", action: "Ver negocio" },
  suspended: { icon: Lock, tone: "sa-muted", action: "Ver negocio" },
  request: { icon: Inbox, tone: "sa-muted", action: "Revisar" },
  errors: { icon: Bug, tone: "sa-danger-text", action: "Ver errores" },
};

const FILTERS: { id: Filter; label: string; empty: string }[] = [
  { id: "todos", label: "Todos", empty: "Todavía no hay negocios registrados" },
  { id: "vence", label: "Por vencer", empty: "Ningún negocio tiene un cobro por vencer" },
  { id: "atrasado", label: "Atrasados", empty: "Ningún negocio está atrasado" },
  { id: "suspendido", label: "Suspendidos", empty: "Ningún negocio está suspendido" },
];

const CR_TIME_ZONE = "America/Costa_Rica";

function todayLabel(): string {
  const text = new Date().toLocaleDateString("es-CR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: CR_TIME_ZONE });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function timeAgo(iso: string | null, now: number): string {
  if (!iso) return "Nunca";
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return days === 1 ? "hace 1 día" : `hace ${days} días`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? "hace 1 mes" : `hace ${months} meses`;
  return "hace más de un año";
}

function fullDate(iso: string): string {
  return new Date(iso).toLocaleString("es-CR", { dateStyle: "medium", timeStyle: "short", timeZone: CR_TIME_ZONE });
}

/** Por qué el cobro automático no está corriendo bien, o null si no hay nada que avisar. */
function automationWarning(automation: DashboardData["automation"]): string | null {
  if (!automation.enabled) return "El cobro automático está apagado: las facturas y los recordatorios no salen solos.";
  if (!automation.cronConfigured) return "El cobro automático está encendido, pero falta la variable CRON_SECRET en Vercel: la corrida diaria no va a correr sola.";
  if (automation.lastRunError) return `La última corrida del cobro automático tuvo un problema: ${automation.lastRunError}`;
  return null;
}

// ── Cobrado en el mes ───────────────────────────────────────────────────────

function MoneyRow({ icon: Icon, label, amount, tone }: { icon: LucideIcon; label: string; amount: number; tone: string }) {
  return (
    <div className={`flex items-center justify-between gap-3 py-2.5 ${amount > 0 ? tone : "sa-muted"}`}>
      <dt className="flex items-center gap-2"><Icon className="h-4 w-4" aria-hidden />{label}</dt>
      <dd className="sa-num m-0 font-semibold">{formatCRC(amount)}</dd>
    </div>
  );
}

function MoneyPanel({ period, month }: Pick<DashboardData, "period" | "month">) {
  const monthName = period.split(" ")[0];
  const percent = month.expected > 0 ? Math.min(100, Math.round((month.paid / month.expected) * 100)) : 0;
  const missing = month.withoutInvoiceCount;

  return (
    <section className="sa-card sa-card-raised sa-card-pad flex min-w-0 flex-col gap-4 lg:col-span-2 xl:col-span-1" aria-labelledby="dash-cobrado">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="dash-cobrado" className="sa-eyebrow">Cobrado en {monthName}</h2>
        <Link href="/superadmin/cobros" className="sa-link text-[13px]">Ver cobros</Link>
      </div>

      <p className="m-0 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="sa-stat-value" style={{ fontSize: 36, lineHeight: 1.05 }}>{formatCRC(month.paid)}</span>
        <span className="sa-muted sa-num">de {formatCRC(month.expected)} esperados</span>
      </p>

      <div>
        <div role="img" aria-label={`${percent} por ciento cobrado`} className="h-2 overflow-hidden rounded bg-[var(--sa-muted-bg)]">
          <div className="h-full bg-[var(--sa-ok)]" style={{ width: `${percent}%` }} />
        </div>
        <p className={`sa-num m-0 mt-2 text-[13px] font-semibold ${percent > 0 ? "sa-ok-text" : "sa-muted"}`}>{percent} % cobrado</p>
      </div>

      <dl className="sa-divide m-0 border-t border-[var(--sa-line)] text-[13px]">
        <MoneyRow icon={Clock} label="Pendiente" amount={month.pending} tone="sa-warn-text" />
        <MoneyRow icon={CircleAlert} label="Atrasado" amount={month.late} tone="sa-danger-text" />
      </dl>

      {missing > 0 && (
        <p className="sa-help m-0">
          {missing === 1 ? "1 negocio activo todavía no tiene" : `${missing} negocios activos todavía no tienen`} factura de {monthName}
          {month.withoutInvoiceExpected > 0 && <span className="sa-num"> ({formatCRC(month.withoutInvoiceExpected)} por facturar)</span>}.
        </p>
      )}
    </section>
  );
}

// ── Requiere atención ───────────────────────────────────────────────────────

function AttentionPanel({ attention }: Pick<DashboardData, "attention">) {
  const rows: { label: string; n: number; href: string; icon: LucideIcon; tone: string }[] = [
    { label: "Cobros por vencer", n: attention.dueSoon, href: "/superadmin/pagos", icon: Clock, tone: "sa-warn-text" },
    { label: "Atrasados", n: attention.late, href: "/superadmin/pagos", icon: CircleAlert, tone: "sa-danger-text" },
    { label: "Suspendidos", n: attention.suspended, href: "/superadmin/tenants", icon: Lock, tone: "sa-strong" },
    { label: "Solicitudes nuevas", n: attention.pendingRequests, href: "/superadmin/solicitudes", icon: Inbox, tone: "sa-strong" },
    { label: "Errores en 24 h", n: attention.errors24h, href: "/superadmin/errores", icon: Bug, tone: "sa-danger-text" },
  ];

  return (
    <section className="sa-card flex min-w-0 flex-col" aria-labelledby="dash-atencion">
      <h2 id="dash-atencion" className="sa-eyebrow px-5 pb-3 pt-4">Requiere atención</h2>
      <ul className="sa-divide m-0 list-none border-t border-[var(--sa-line)] p-0">
        {rows.map(({ label, n, href, icon: Icon, tone }, i) => {
          // El color va en cada parte y no en el enlace: dentro de .sa los enlaces heredan el color.
          const color = n > 0 ? tone : "sa-muted";
          return (
            <li key={label}>
              <Link
                href={href}
                className={`flex items-center gap-3 px-5 py-3 hover:bg-[var(--sa-subtle)] ${i === rows.length - 1 ? "rounded-b-[calc(var(--sa-radius-panel)_-_1px)]" : ""}`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${color}`} aria-hidden />
                <span className={`min-w-0 flex-1 ${n > 0 ? "font-medium" : "sa-muted"}`}>{label}</span>
                <span className={`sa-num text-lg font-semibold leading-none ${color}`}>{n}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ── Para hoy ────────────────────────────────────────────────────────────────

function TodayPanel({ items }: { items: DashboardData["today"] }) {
  return (
    <section className="sa-card flex min-w-0 flex-col" aria-labelledby="dash-hoy">
      <h2 id="dash-hoy" className="sa-eyebrow px-5 pb-3 pt-4">Para hoy</h2>
      {items.length === 0 ? (
        <p className="sa-empty m-0 border-t border-[var(--sa-line)]">Nada pendiente por hoy</p>
      ) : (
        <ul className="sa-divide m-0 list-none border-t border-[var(--sa-line)] p-0">
          {items.map((item, i) => {
            const { icon: Icon, tone, action } = TODAY_KIND[item.kind];
            return (
              <li key={`${item.kind}-${i}`} className="flex items-start gap-3 px-5 py-3">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="sa-strong m-0 break-words">{item.title}</p>
                  <p className="sa-muted sa-num m-0 text-[13px]">{item.detail}</p>
                </div>
                <Link href={item.href} className="sa-link shrink-0 whitespace-nowrap text-[13px]" aria-label={`${action}: ${item.title}`}>
                  {action}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ── Negocios ────────────────────────────────────────────────────────────────

function Monthly({ tenant }: { tenant: TenantRow }) {
  if (tenant.free) {
    return (
      <span className="sa-chip sa-chip-info" title={`${tenant.discountLabel} · precio de lista ${formatCRC(tenant.listAmount)}`}>
        <Gift aria-hidden />Sin costo
      </span>
    );
  }
  if (!tenant.discountLabel) return <span className="font-semibold">{formatCRC(tenant.amount)}</span>;
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="whitespace-nowrap">
        <span className="sr-only">Precio de lista: </span>
        <s className="sa-muted mr-2 text-xs">{formatCRC(tenant.listAmount)}</s>
        <span className="sr-only">Paga: </span>
        <span className="font-semibold">{formatCRC(tenant.amount)}</span>
      </span>
      <span className="sa-chip sa-chip-info max-w-[240px]" title={tenant.discountLabel}>
        <Tag aria-hidden /><span className="min-w-0 truncate">{tenant.discountLabel}</span>
      </span>
    </div>
  );
}

function TenantsPanel({ tenants, now }: { tenants: TenantRow[]; now: number }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("todos");

  const matches = (f: Filter) => (f === "todos" ? tenants : tenants.filter((t) => t.billingState === f));
  const visible = matches(filter);
  const emptyText = FILTERS.find((f) => f.id === filter)?.empty;

  return (
    <section className="sa-card min-w-0" aria-labelledby="dash-negocios">
      <div className="sa-card-head">
        <div className="flex items-baseline gap-2.5">
          <h2 id="dash-negocios" className="sa-h2">Negocios</h2>
          <span className="sa-muted sa-num text-[13px]">{tenants.length} en total</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="sa-seg" role="group" aria-label="Filtrar por estado de cobro">
            {FILTERS.map((f) => (
              <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label} <span className="sa-num font-normal">{matches(f.id).length}</span>
              </button>
            ))}
          </div>
          <Link href="/superadmin/tenants" className="sa-link text-[13px]">Ver todos</Link>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="sa-empty">{emptyText}</div>
      ) : (
        <div className="sa-table-wrap">
          <table className="sa-table min-w-[860px]">
            <thead>
              <tr>
                <th>Negocio</th>
                <th>Plan</th>
                <th className="sa-right">Mensualidad</th>
                <th>Estado de cobro</th>
                <th>Próximo cobro</th>
                <th>Último acceso</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => {
                const href = `/superadmin/tenants/${t.id}`;
                const chip = STATE_CHIP[t.billingState];
                const ChipIcon = chip.icon;
                return (
                  <tr key={t.id} className="sa-row-clickable" onClick={() => router.push(href)}>
                    <td>
                      {/* El enlace ya navega: que el clic no llegue también a la fila. */}
                      <Link href={href} className="sa-strong hover:underline" onClick={(e) => e.stopPropagation()}>{t.name}</Link>
                      <div className="sa-muted text-xs">/{t.slug}</div>
                    </td>
                    <td className="whitespace-nowrap">{PLAN_LABELS[t.plan as PlanKey] ?? t.plan}</td>
                    <td className="sa-right sa-num"><Monthly tenant={t} /></td>
                    <td>
                      <span className={chip.className}>
                        <ChipIcon aria-hidden />{t.status === "inactive" ? "Inactivo" : chip.label}
                      </span>
                      {t.status === "suspended" && t.suspendedReason && (
                        <div className="sa-muted mt-1 text-xs">{suspensionReasonLabel(t.suspendedReason)}</div>
                      )}
                    </td>
                    <td className="sa-num whitespace-nowrap">
                      {t.nextDue
                        ? (t.billingState === "atrasado" ? `Venció el ${t.nextDue}` : t.nextDue)
                        : <><span className="sa-muted" aria-hidden>—</span><span className="sr-only">No aplica</span></>}
                    </td>
                    <td className="sa-num whitespace-nowrap" title={t.lastAccessAt ? fullDate(t.lastAccessAt) : undefined}>
                      {t.lastAccessAt ? timeAgo(t.lastAccessAt, now) : <span className="sa-muted">Nunca</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── Pantalla ────────────────────────────────────────────────────────────────

export default function SuperadminDashboard() {
  const router = useRouter();
  // `at` es la hora en que llegaron los datos: contra ella se calcula "hace 2 días".
  const [loaded, setLoaded] = useState<{ data: DashboardData; at: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/superadmin/dashboard")
      .then((res) => {
        if (res.status === 401) {
          router.replace("/superadmin/login");
          return null;
        }
        if (!res.ok) throw new Error(`Respuesta ${res.status}`);
        return res.json() as Promise<DashboardData>;
      })
      .then((data) => {
        if (data && !cancelled) setLoaded({ data, at: Date.now() });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => { cancelled = true; };
  }, [attempt, router]);

  const retry = () => {
    setFailed(false);
    setAttempt((n) => n + 1);
  };

  const warning = loaded ? automationWarning(loaded.data.automation) : null;

  return (
    <div className="sa-page">
      <header className="sa-page-head">
        <div>
          <h1 className="sa-title">Qué atender hoy</h1>
          <p className="sa-subtitle">{todayLabel()}</p>
        </div>
      </header>

      {failed ? (
        <div className="sa-alert sa-alert-danger" role="alert">
          <CircleAlert aria-hidden />
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <span>No se pudo cargar el panel. Revisá la conexión y probá de nuevo.</span>
            <button type="button" className="sa-btn sa-btn-secondary sa-btn-sm" onClick={retry}>Reintentar</button>
          </div>
        </div>
      ) : !loaded ? (
        <p className="sa-muted m-0" role="status">Cargando...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <MoneyPanel period={loaded.data.period} month={loaded.data.month} />
            <AttentionPanel attention={loaded.data.attention} />
            <TodayPanel items={loaded.data.today} />
          </div>

          {warning && (
            <div className="sa-alert sa-alert-warn" role="status">
              <TriangleAlert aria-hidden />
              <p className="m-0 min-w-0 flex-1 break-words">
                {warning}{" "}
                <Link href="/superadmin/cobros" className="sa-link whitespace-nowrap">Ir a Cobros</Link>
              </p>
            </div>
          )}

          <TenantsPanel tenants={loaded.data.tenants} now={loaded.at} />
        </>
      )}
    </div>
  );
}
