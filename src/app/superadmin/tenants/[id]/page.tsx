"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Save, ExternalLink, Megaphone, TriangleAlert, Trash2, Check, X, Ban, CircleMinus,
} from "lucide-react";
import Link from "next/link";
import TenantErrorsCard from "@/components/superadmin/errores/TenantErrorsCard";
import TenantBillingCard from "@/components/superadmin/cobros/TenantBillingCard";
import { SUSPENSION_REASONS, SUSPENSION_MESSAGE_MAX, suspensionReasonLabel } from "@/lib/suspension";
import { formatCRC, DEFAULT_PLAN_PRICES, PLAN_KEYS, PLAN_LABELS, type PlanKey } from "@/lib/billing";
import { lockedSections, productLimit } from "@/lib/permissions";
import { ownerStatusOf, type ReviewStatus } from "@/lib/mensualidad";
import { PaymentStateChip } from "@/components/superadmin/pagos/paymentStatus";
import ProofReviewDialog from "@/components/superadmin/pagos/ProofReviewDialog";

interface Tenant {
  _id: string;
  slug: string;
  name: string;
  email: string;
  whatsappNumber: string;
  logoUrl: string;
  description: string;
  plan: string;
  /** Si se le aplican los límites de su plan; los negocios de antes no lo tienen. */
  planLimits?: boolean;
  status: string;
  suspendedReason?: string;
  suspendedMessage?: string;
  suspendedAt?: string | null;
  createdAt: string;
}

interface Payment {
  _id: string;
  periodYear: number;
  periodMonth: number;
  amount: number;
  status: string;
  dueDate: string;
  paidAt?: string;
  notes?: string;
  proofs?: { _id: string; status: string }[];
  review?: { status?: ReviewStatus };
}

interface AccessLog {
  _id: string;
  userEmail: string;
  ip: string;
  success: boolean;
  createdAt: string;
}

interface TenantDetail {
  tenant: Tenant;
  payments: Payment[];
  accessLogs: AccessLog[];
  productCount?: number;
}

/** Nombres en una frase: "A", "A y B", "A, B y C". */
function listaDe(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

/** Qué significa, para este negocio, tener o no los límites de su plan. */
function limitsHelp(plan: string, planLimits: boolean, productCount: number): string {
  const label = PLAN_LABELS[plan as PlanKey] ?? plan;
  const withLimits = lockedSections({ plan, planLimits: true }).map((s) => s.label);
  const always = new Set(lockedSections({ plan, planLimits: false }).map((s) => s.label));
  const limit = productLimit({ plan, planLimits: true });
  const overLimit = limit !== null && productCount > limit
    ? ` Tiene ${productCount} productos: los conserva, pero no puede agregar más mientras pase de ${limit}.`
    : "";

  if (planLimits) {
    const locked = withLimits.length ? ` Le salen con candado: ${listaDe(withLimits)}.` : "";
    const cap = limit !== null ? ` Hasta ${limit} productos.` : "";
    return `Ve solo lo que incluye el plan ${label}.${locked}${cap}${overLimit}`;
  }
  const wouldLose = withLimits.filter((s) => !always.has(s));
  const sections = wouldLose.length ? ` dejaría de ver ${listaDe(wouldLose)}` : "";
  const cap = limit !== null ? `${sections ? ", y" : ""} tendría un tope de ${limit} productos` : "";
  const lose = sections || cap
    ? ` Si los aplicás con el plan ${label},${sections}${cap}.${overLimit}`
    : ` Con el plan ${label} no pierde nada al aplicarlos.`;
  return `Negocio de antes de los límites: conserva todo lo que tenía, menos lo que siempre fue de Premium.${lose}`;
}

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

type TabId = "resumen" | "cobros" | "actividad";
const TABS: { id: TabId; label: string }[] = [
  { id: "resumen", label: "Resumen" },
  { id: "cobros", label: "Cobros" },
  { id: "actividad", label: "Actividad" },
];

function StatusChip({ status }: { status: string }) {
  if (status === "active") return <span className="sa-chip sa-chip-ok"><Check aria-hidden />Activo</span>;
  if (status === "suspended") return <span className="sa-chip"><Ban aria-hidden />Suspendido</span>;
  if (status === "inactive") return <span className="sa-chip"><CircleMinus aria-hidden />Inactivo</span>;
  return <span className="sa-chip"><CircleMinus aria-hidden />{status}</span>;
}

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData]       = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [form, setForm]       = useState<Partial<Tenant>>({});
  const [tab, setTab]         = useState<TabId>("resumen");

  const [showDelete, setShowDelete]     = useState(false);
  const [confirmSlug, setConfirmSlug]   = useState("");
  const [deleting, setDeleting]         = useState(false);
  const [deleteError, setDeleteError]   = useState("");

  const [reviewing, setReviewing]       = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState("");

  /** Después de revisar un comprobante: solo se refresca el historial, sin pisar lo que se esté editando. */
  const reloadPayments = useCallback(() => {
    fetch(`/api/superadmin/tenants/${id}`)
      .then((r) => r.json())
      .then((d) => setData((cur) => (cur ? { ...cur, payments: d.payments ?? cur.payments } : cur)))
      .catch(() => {});
  }, [id]);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/superadmin/tenants/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        const t = d.tenant as Tenant;
        setForm({
          name: t.name, email: t.email, whatsappNumber: t.whatsappNumber,
          logoUrl: t.logoUrl, description: t.description,
          plan: t.plan, planLimits: t.planLimits === true, status: t.status,
          // Si está activo, el motivo arranca en "falta de pago" por si lo suspenden desde acá.
          suspendedReason: t.suspendedReason || "falta_pago",
          suspendedMessage: t.suspendedMessage ?? "",
        });
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // La ventana de borrar se cierra con Esc, salvo mientras se está borrando.
  useEffect(() => {
    if (!showDelete) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !deleting) setShowDelete(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showDelete, deleting]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg("");
    const res = await fetch(`/api/superadmin/tenants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      setSaveMsg("Guardado correctamente");
      load();
      setTimeout(() => setSaveMsg(""), 3000);
    } else {
      const d = await res.json();
      setSaveMsg(d.error ?? "Error al guardar");
    }
  }

  async function handleDelete() {
    if (!data) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/superadmin/tenants/${id}`, { method: "DELETE" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(d.error ?? "No se pudo eliminar el negocio");
        return;
      }
      router.push("/superadmin/tenants");
      router.refresh();
    } catch {
      setDeleteError("Error de red al eliminar el negocio");
    } finally {
      setDeleting(false);
    }
  }

  // Flechas, Inicio y Fin mueven el foco entre pestañas, como en cualquier lista de pestañas.
  function onTabKey(e: React.KeyboardEvent<HTMLDivElement>) {
    const current = TABS.findIndex((t) => t.id === tab);
    let next = -1;
    if (e.key === "ArrowRight") next = (current + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (current - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    setTab(TABS[next].id);
    document.getElementById(`tab-${TABS[next].id}`)?.focus();
  }

  if (loading) {
    return (
      <div className="sa-page">
        <p className="sa-empty">Cargando...</p>
      </div>
    );
  }

  if (!data?.tenant) {
    return (
      <div className="sa-page">
        <div className="sa-empty">
          <p className="sa-danger-text">Negocio no encontrado</p>
          <p className="mt-2">
            <Link href="/superadmin/tenants" className="sa-link inline-flex items-center gap-1.5">
              <ArrowLeft className="w-4 h-4" aria-hidden /> Volver a negocios
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const { tenant, payments, accessLogs, productCount = 0 } = data;
  const paidCount = payments.filter((p) => p.status === "paid").length;
  const lateCount = payments.filter((p) => p.status === "late").length;

  return (
    <div className="sa-page">
      {/* Encabezado: siempre visible, sin importar la pestaña */}
      <header className="sa-page-head">
        <div className="min-w-0">
          <p className="mb-2 text-[13px]">
            <Link href="/superadmin/tenants" className="sa-link inline-flex items-center gap-1.5">
              <ArrowLeft className="w-4 h-4" aria-hidden /> Volver a negocios
            </Link>
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="sa-title">{tenant.name}</h1>
            <StatusChip status={tenant.status} />
          </div>
          <p className="sa-subtitle [overflow-wrap:anywhere]">{tenant.slug} · {tenant.email}</p>
          {tenant.status !== "active" && (
            <p className="sa-muted mt-1 text-[13px]">
              <span className="sa-strong">{suspensionReasonLabel(tenant.suspendedReason)}</span>
              {tenant.suspendedAt && ` · desde el ${new Date(tenant.suspendedAt).toLocaleDateString("es-CR")}`}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/${tenant.slug}/admin`}
            target="_blank"
            rel="noopener noreferrer"
            className="sa-btn sa-btn-secondary"
          >
            <ExternalLink className="w-4 h-4" aria-hidden />
            Ver panel del negocio
          </a>
          <Link href={`/superadmin/avisos?negocio=${id}`} className="sa-btn sa-btn-secondary">
            <Megaphone className="w-4 h-4" aria-hidden />
            Enviar aviso
          </Link>
        </div>
      </header>

      <div className="sa-tabs" role="tablist" aria-label="Secciones del negocio" onKeyDown={onTabKey}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Las tres pestañas quedan montadas (solo se ocultan) para no perder lo escrito al cambiar de una a otra. */}

      {/* ── Resumen ── */}
      <div role="tabpanel" id="panel-resumen" aria-labelledby="tab-resumen" hidden={tab !== "resumen"} className="flex flex-col gap-6">
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
          <section className="sa-card xl:col-span-2">
            <div className="sa-card-head">
              <h2 className="sa-h2">Información del negocio</h2>
            </div>
            <form onSubmit={handleSave} className="flex flex-col gap-4 p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Nombre">
                  <input
                    value={form.name ?? ""}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="sa-input"
                  />
                </Field>
                <Field label="Email">
                  <input
                    type="email"
                    value={form.email ?? ""}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="sa-input"
                  />
                </Field>
                <Field label="WhatsApp">
                  <input
                    value={form.whatsappNumber ?? ""}
                    onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
                    className="sa-input"
                  />
                </Field>
                <Field label="Logo URL">
                  <input
                    value={form.logoUrl ?? ""}
                    onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                    className="sa-input"
                  />
                </Field>
              </div>
              <Field label="Descripción">
                <textarea
                  rows={2}
                  value={form.description ?? ""}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="sa-input resize-none"
                />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Plan">
                  <select
                    value={form.plan ?? ""}
                    onChange={(e) => setForm({ ...form, plan: e.target.value })}
                    className="sa-input"
                  >
                    {PLAN_KEYS.map((k) => (
                      <option key={k} value={k}>{PLAN_LABELS[k]} — {formatCRC(DEFAULT_PLAN_PRICES[k])}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Estado">
                  <select
                    value={form.status ?? ""}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="sa-input"
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                    <option value="suspended">Suspendido</option>
                  </select>
                </Field>
              </div>
              <label className="sa-check sa-inset p-4">
                <input
                  type="checkbox"
                  checked={!!form.planLimits}
                  onChange={(e) => setForm({ ...form, planLimits: e.target.checked })}
                />
                <span>
                  <span className="sa-strong block">Aplicar los límites del plan</span>
                  <span className="sa-help block mt-0.5">
                    {limitsHelp(form.plan ?? tenant.plan, !!form.planLimits, productCount)}
                  </span>
                </span>
              </label>
              {form.status !== "active" && (
                <div className="sa-inset grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
                  <Field label="Motivo">
                    <select
                      value={form.suspendedReason ?? "falta_pago"}
                      onChange={(e) => setForm({ ...form, suspendedReason: e.target.value })}
                      className="sa-input"
                    >
                      {SUSPENSION_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Mensaje para el dueño (opcional)">
                    <textarea
                      rows={2} maxLength={SUSPENSION_MESSAGE_MAX}
                      value={form.suspendedMessage ?? ""}
                      onChange={(e) => setForm({ ...form, suspendedMessage: e.target.value })}
                      className="sa-input resize-none"
                    />
                  </Field>
                  <p className="sa-help sm:col-span-2">
                    Panel, app y tienda en línea quedan bloqueados en menos de un minuto, también las sesiones
                    abiertas. El motivo y el mensaje solo los ve el dueño.
                  </p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" disabled={saving} className="sa-btn sa-btn-primary">
                  <Save className="w-4 h-4" aria-hidden />
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>
                {saveMsg && (
                  <p className={saveMsg.includes("Error") ? "sa-error" : "sa-success"} role="status">
                    {saveMsg}
                  </p>
                )}
              </div>
            </form>
          </section>

          <section className="sa-card">
            <div className="sa-card-head">
              <h2 className="sa-h2">Detalles</h2>
            </div>
            <dl className="sa-divide">
              <div className="flex items-center justify-between gap-3 px-5 py-3">
                <dt className="sa-muted">Plan</dt>
                <dd className="sa-strong">{PLAN_LABELS[tenant.plan as PlanKey] ?? tenant.plan}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-5 py-3">
                <dt className="sa-muted">Límites del plan</dt>
                <dd className={tenant.planLimits ? "sa-strong" : "sa-muted"}>{tenant.planLimits ? "Aplicados" : "Sin aplicar"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-5 py-3">
                <dt className="sa-muted">Productos</dt>
                <dd className="sa-num">{productCount}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-5 py-3">
                <dt className="sa-muted">Slug</dt>
                <dd className="sa-mono [overflow-wrap:anywhere]">{tenant.slug}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-5 py-3">
                <dt className="sa-muted">Registro</dt>
                <dd className="sa-num">{new Date(tenant.createdAt).toLocaleDateString("es-CR")}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-5 py-3">
                <dt className="sa-muted">Pagos al día</dt>
                <dd className={`sa-num font-semibold ${paidCount > 0 ? "sa-ok-text" : ""}`}>{paidCount}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-5 py-3">
                <dt className="sa-muted">Atrasados</dt>
                <dd className={`sa-num font-semibold ${lateCount > 0 ? "sa-danger-text" : ""}`}>{lateCount}</dd>
              </div>
            </dl>
          </section>
        </div>

        {/* Zona de peligro */}
        <section className="sa-alert sa-alert-danger" aria-labelledby="zona-peligro">
          <TriangleAlert aria-hidden />
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div className="min-w-[220px] flex-1">
              <h2 id="zona-peligro" className="text-sm font-semibold">Zona de peligro</h2>
              <p className="mt-1">
                Eliminar este negocio borra <strong className="font-semibold">permanentemente</strong> todos sus datos:
                usuarios, productos, ventas, pedidos, gastos, finanzas, recetas, inventario, cierres de caja, imágenes y
                configuración. Esta acción no se puede deshacer.
              </p>
            </div>
            <button
              type="button"
              className="sa-btn sa-btn-danger"
              onClick={() => { setShowDelete(true); setConfirmSlug(""); setDeleteError(""); }}
            >
              <Trash2 className="w-4 h-4" aria-hidden />
              Eliminar negocio
            </button>
          </div>
        </section>
      </div>

      {/* ── Cobros ── */}
      <div role="tabpanel" id="panel-cobros" aria-labelledby="tab-cobros" hidden={tab !== "cobros"} className="flex flex-col gap-6">
        <TenantBillingCard tenantId={id} tenantEmail={tenant.email} />

        <section className="sa-card">
          <div className="sa-card-head">
            <h2 className="sa-h2">Historial de pagos</h2>
          </div>
          {paymentNotice && (
            <div className="sa-alert sa-alert-ok mx-5 mb-3" role="status"><Check aria-hidden /><span>{paymentNotice}</span></div>
          )}
          {payments.length === 0 ? (
            <div className="sa-empty">Sin pagos registrados</div>
          ) : (
            <div className="sa-table-wrap">
              <table className="sa-table">
                <thead>
                  <tr>
                    <th scope="col">Período</th>
                    <th scope="col" className="sa-right">Monto</th>
                    <th scope="col">Vence</th>
                    <th scope="col">Pagado</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Comprobante</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => {
                    const state = ownerStatusOf(p);
                    const count = p.proofs?.length ?? 0;
                    return (
                      <tr key={p._id}>
                        <td className="sa-num whitespace-nowrap">{MONTHS[p.periodMonth - 1]} {p.periodYear}</td>
                        <td className="sa-right sa-num whitespace-nowrap">{formatCRC(p.amount)}</td>
                        <td>
                          <span className="sa-muted sa-num">{new Date(p.dueDate).toLocaleDateString("es-CR")}</span>
                        </td>
                        <td>
                          <span className="sa-muted sa-num">
                            {p.paidAt ? new Date(p.paidAt).toLocaleDateString("es-CR") : "—"}
                          </span>
                        </td>
                        <td><PaymentStateChip status={state} /></td>
                        <td>
                          {count === 0 ? (
                            <span className="sa-muted" aria-label="Sin comprobante">—</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => { setPaymentNotice(""); setReviewing(p._id); }}
                              className={`sa-btn sa-btn-sm ${state === "revision" ? "sa-btn-primary" : "sa-btn-ghost"}`}
                            >
                              {state === "revision" ? "Revisar" : count === 1 ? "Ver" : `Ver (${count})`}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {reviewing && (
        <ProofReviewDialog
          paymentId={reviewing}
          onClose={() => setReviewing(null)}
          onChanged={(message) => { setReviewing(null); setPaymentNotice(message); reloadPayments(); }}
        />
      )}

      {/* ── Actividad ── */}
      <div role="tabpanel" id="panel-actividad" aria-labelledby="tab-actividad" hidden={tab !== "actividad"} className="flex flex-col gap-6">
        <TenantErrorsCard tenantId={id} />

        <section className="sa-card">
          <div className="sa-card-head">
            <h2 className="sa-h2">Últimos accesos</h2>
          </div>
          {accessLogs.length === 0 ? (
            <div className="sa-empty">Sin registros de acceso</div>
          ) : (
            <div className="sa-table-wrap">
              <table className="sa-table">
                <thead>
                  <tr>
                    <th scope="col">Usuario</th>
                    <th scope="col">IP</th>
                    <th scope="col">Resultado</th>
                    <th scope="col">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {accessLogs.map((log) => (
                    <tr key={log._id}>
                      <td className="whitespace-nowrap">{log.userEmail}</td>
                      <td><span className="sa-mono sa-muted">{log.ip}</span></td>
                      <td>
                        {log.success ? (
                          <span className="sa-chip sa-chip-ok"><Check aria-hidden />Correcto</span>
                        ) : (
                          <span className="sa-chip sa-chip-danger"><X aria-hidden />Fallido</span>
                        )}
                      </td>
                      <td>
                        <span className="sa-muted sa-num whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString("es-CR", { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Ventana para confirmar el borrado */}
      {showDelete && (
        <div
          className="sa-modal-backdrop"
          role="dialog" aria-modal="true" aria-labelledby="delete-title"
          onClick={() => !deleting && setShowDelete(false)}
        >
          <div className="sa-modal" onClick={(e) => e.stopPropagation()}>
            <h2 id="delete-title" className="sa-modal-title">Eliminar {tenant.name}</h2>
            <p className="sa-muted">
              Se borrarán de forma permanente todos los datos de este negocio. Para confirmar, escribí su slug{" "}
              <code className="sa-mono sa-strong rounded bg-[var(--sa-muted-bg)] px-1.5 py-0.5">{tenant.slug}</code>{" "}
              abajo.
            </p>
            <label className="sa-field">
              <span className="sa-label">Slug del negocio</span>
              <input
                autoFocus
                value={confirmSlug}
                onChange={(e) => setConfirmSlug(e.target.value)}
                placeholder={tenant.slug}
                autoComplete="off"
                className="sa-input"
              />
            </label>
            {deleteError && <p className="sa-error" role="alert">{deleteError}</p>}
            <div className="sa-modal-actions">
              <button
                type="button"
                className="sa-btn sa-btn-secondary"
                onClick={() => setShowDelete(false)}
                disabled={deleting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="sa-btn sa-btn-danger"
                onClick={handleDelete}
                disabled={deleting || confirmSlug !== tenant.slug}
              >
                {deleting ? "Eliminando..." : "Eliminar definitivamente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="sa-field">
      <span className="sa-label">{label}</span>
      {children}
    </label>
  );
}
