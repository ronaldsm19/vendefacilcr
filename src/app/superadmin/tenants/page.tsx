"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Search, Plus, Mail, Check, X, Ban, CircleMinus, Hourglass, BadgePercent, Gift, CircleAlert,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import SuspendTenantDialog from "@/components/superadmin/SuspendTenantDialog";
import type { SuspensionReason } from "@/lib/suspension";
import {
  priceFor, billingOf, formatCRC, DEFAULT_PLAN_PRICES, PLAN_LABELS, type PlanKey, type TenantBilling,
} from "@/lib/billing";

interface Tenant {
  _id: string;
  slug: string;
  name: string;
  email: string;
  plan: string;
  planLimits?: boolean;
  status: string;
  passwordChanged?: boolean;
  billing?: Partial<TenantBilling> | null;
  createdAt: string;
}

const STATUS_FILTERS = [
  { value: "", label: "Todos" },
  { value: "active", label: "Activos" },
  { value: "inactive", label: "Inactivos" },
  { value: "suspended", label: "Suspendidos" },
];
const PASSWORD_FILTERS = [
  { value: "", label: "Todas" },
  { value: "true", label: "Cambiada" },
  { value: "false", label: "Temporal" },
];

function StatusChip({ status }: { status: string }) {
  if (status === "active") return <span className="sa-chip sa-chip-ok"><Check aria-hidden />Activo</span>;
  if (status === "suspended") return <span className="sa-chip"><Ban aria-hidden />Suspendido</span>;
  if (status === "inactive") return <span className="sa-chip"><CircleMinus aria-hidden />Inactivo</span>;
  return <span className="sa-chip"><CircleMinus aria-hidden />{status}</span>;
}

/** Lo que paga el negocio hoy: el precio de lista de su plan menos el descuento o la cortesía vigentes. */
function MonthlyFee({ tenant, prices, today }: { tenant: Tenant; prices: Record<PlanKey, number>; today: Date }) {
  const price = priceFor(tenant.plan, billingOf(tenant), prices, today);
  if (price.free) {
    return (
      <span className="sa-chip sa-chip-info" title={price.discountLabel}>
        <Gift aria-hidden />Sin costo
      </span>
    );
  }
  return (
    <>
      <span className="sa-num">{formatCRC(price.amount)}</span>
      {price.discountAmount > 0 && (
        <span className="mt-1 flex justify-end">
          <span className="sa-chip sa-chip-info max-w-[168px]" title={price.discountLabel}>
            <BadgePercent aria-hidden />
            <span className="truncate">{price.discountLabel}</span>
          </span>
        </span>
      )}
    </>
  );
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [total, setTotal]     = useState(0);
  const [prices, setPrices]   = useState<Record<PlanKey, number>>(DEFAULT_PLAN_PRICES);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [status, setStatus]   = useState("");
  const [pwFilter, setPwFilter] = useState("");
  const [page, setPage]       = useState(1);
  const [toggling, setToggling] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [notice, setNotice]   = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [suspending, setSuspending] = useState<Tenant | null>(null);
  const [suspendError, setSuspendError] = useState("");
  // El día con el que se calcula la mensualidad se fija al abrir la pantalla.
  const [today] = useState(() => new Date());

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page) });
    if (search) q.set("search", search);
    if (status) q.set("status", status);
    if (pwFilter) q.set("passwordChanged", pwFilter);
    fetch(`/api/superadmin/tenants?${q}`)
      .then((r) => r.json())
      .then((d) => {
        setTenants(d.tenants ?? []);
        setTotal(d.total ?? 0);
        setPrices(d.prices ?? DEFAULT_PLAN_PRICES);
      })
      .finally(() => setLoading(false));
  }, [search, status, pwFilter, page]);

  useEffect(() => { load(); }, [load]);

  async function patchStatus(tenant: Tenant, body: Record<string, unknown>): Promise<string | null> {
    setToggling(tenant._id);
    try {
      const res = await fetch(`/api/superadmin/tenants/${tenant._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        return d.error ?? "No se pudo cambiar el estado";
      }
      load();
      return null;
    } catch {
      return "Error de red al cambiar el estado";
    } finally {
      setToggling(null);
    }
  }

  async function toggleStatus(tenant: Tenant) {
    if (tenant.status === "active") {
      setSuspendError("");
      setSuspending(tenant);
      return;
    }
    if (!confirm(`¿Activar a ${tenant.name}? Vuelven el panel, la app y la tienda en línea.`)) return;
    const error = await patchStatus(tenant, { status: "active" });
    if (error) setNotice({ type: "error", text: error });
  }

  async function confirmSuspend(data: { suspendedReason: SuspensionReason; suspendedMessage: string }) {
    if (!suspending) return;
    const error = await patchStatus(suspending, { status: "suspended", ...data });
    if (error) setSuspendError(error);
    else setSuspending(null);
  }

  async function resendInvite(tenant: Tenant) {
    if (!confirm(
      `¿Reenviar la invitación a ${tenant.name} (${tenant.email})?\n\n` +
      `Se generará una contraseña temporal NUEVA y la anterior dejará de funcionar.`
    )) return;
    setResendingId(tenant._id);
    setNotice(null);
    try {
      const res = await fetch(`/api/superadmin/tenants/${tenant._id}/resend-invite`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice({ type: "error", text: d.error ?? "No se pudo reenviar la invitación" });
        return;
      }
      if (d.emailSent) {
        setNotice({ type: "ok", text: `Invitación reenviada a ${d.email} con una nueva contraseña temporal.` });
      } else {
        const reason = d.emailError ? ` (${d.emailError})` : "";
        setNotice({ type: "error", text: `No se pudo enviar el correo a ${d.email}${reason}. Contraseña temporal nueva: ${d.tempPassword}` });
      }
      load();
    } catch {
      setNotice({ type: "error", text: "Error de red al reenviar la invitación" });
    } finally {
      setResendingId(null);
    }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="sa-page">
      <header className="sa-page-head">
        <div>
          <h1 className="sa-title">Negocios</h1>
          <p className="sa-subtitle"><span className="sa-num">{total}</span> registrados</p>
        </div>
        <Link href="/superadmin/tenants/nuevo" className="sa-btn sa-btn-primary">
          <Plus className="w-4 h-4" aria-hidden /> Nuevo negocio
        </Link>
      </header>

      {notice && (
        <div className={`sa-alert ${notice.type === "ok" ? "sa-alert-ok" : "sa-alert-danger"}`} role="status">
          {notice.type === "ok" ? <Check aria-hidden /> : <CircleAlert aria-hidden />}
          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="sa-icon-btn -my-1.5 shrink-0" aria-label="Cerrar aviso">
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>
      )}

      <section className="sa-card" aria-label="Lista de negocios">
        {/* Filtros: en celular cada grupo baja a su propio renglón. */}
        <div className="sa-card-head">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--sa-ink-2)]" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Buscar por nombre, slug o email..."
              aria-label="Buscar por nombre, slug o email"
              className="sa-input pl-9!"
            />
          </div>
          <div className="sa-seg" role="group" aria-label="Estado">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={status === f.value}
                onClick={() => { setStatus(f.value); setPage(1); }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span id="filtro-contrasena" className="sa-eyebrow">Contraseña</span>
            <div className="sa-seg" role="group" aria-labelledby="filtro-contrasena">
              {PASSWORD_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={pwFilter === f.value}
                  onClick={() => { setPwFilter(f.value); setPage(1); }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="sa-empty">Cargando...</div>
        ) : tenants.length === 0 ? (
          <div className="sa-empty">Sin negocios</div>
        ) : (
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th scope="col">Negocio</th>
                  <th scope="col">Plan</th>
                  <th scope="col" className="sa-right">Mensualidad</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Contraseña</th>
                  {/* La fecha de registro se muestra cuando hay ancho de sobra; en pantallas más angostas cede su lugar a las acciones. */}
                  <th scope="col" className="hidden min-[1380px]:table-cell">Registro</th>
                  <th scope="col" className="sa-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t._id}>
                    <td>
                      <div className="min-w-[160px]">
                        <Link href={`/superadmin/tenants/${t._id}`} className="sa-link">{t.name}</Link>
                        <div className="sa-help [overflow-wrap:anywhere]">{t.slug} · {t.email}</div>
                      </div>
                    </td>
                    <td>
                      {PLAN_LABELS[t.plan as PlanKey] ?? t.plan}
                      {!t.planLimits && <div className="sa-help whitespace-nowrap">Sin límites del plan</div>}
                    </td>
                    <td className="sa-right">
                      <MonthlyFee tenant={t} prices={prices} today={today} />
                    </td>
                    <td><StatusChip status={t.status} /></td>
                    <td>
                      {t.passwordChanged ? (
                        <span className="sa-chip sa-chip-ok"><Check aria-hidden />Cambiada</span>
                      ) : (
                        <span className="sa-chip sa-chip-warn"><Hourglass aria-hidden />Temporal</span>
                      )}
                    </td>
                    <td className="hidden min-[1380px]:table-cell">
                      <span className="sa-muted sa-num whitespace-nowrap">
                        {new Date(t.createdAt).toLocaleDateString("es-CR")}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/superadmin/tenants/${t._id}`}
                          className="sa-btn sa-btn-sm sa-btn-ghost"
                          aria-label={`Ver ${t.name}`}
                        >
                          Ver
                        </Link>
                        <button
                          type="button"
                          onClick={() => toggleStatus(t)}
                          disabled={toggling === t._id}
                          className={`sa-btn sa-btn-sm ${t.status === "active" ? "sa-btn-ghost-danger" : "sa-btn-ghost"}`}
                        >
                          {toggling === t._id ? "..." : t.status === "active" ? "Suspender" : "Activar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => resendInvite(t)}
                          disabled={resendingId === t._id}
                          title="Reenviar invitación (nueva contraseña temporal)"
                          aria-label={`Reenviar invitación a ${t.name}`}
                          className="sa-btn sa-btn-sm sa-btn-ghost relative"
                        >
                          <Mail className="w-4 h-4" aria-hidden />
                          {/* El texto solo cabe en pantallas anchas; en las demás queda el sobre con su etiqueta. */}
                          {resendingId === t._id ? "..." : <span className="sr-only 2xl:not-sr-only">Reenviar</span>}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--sa-line)] px-5 py-3">
            <span className="sa-muted sa-num">Página {page} de {totalPages}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="sa-btn sa-btn-sm sa-btn-secondary"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden /> Anterior
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="sa-btn sa-btn-sm sa-btn-secondary"
              >
                Siguiente <ChevronRight className="w-4 h-4" aria-hidden />
              </button>
            </div>
          </div>
        )}
      </section>

      {suspending && (
        <SuspendTenantDialog
          tenantName={suspending.name}
          saving={toggling === suspending._id}
          error={suspendError}
          onCancel={() => setSuspending(null)}
          onConfirm={confirmSuspend}
        />
      )}
    </div>
  );
}
