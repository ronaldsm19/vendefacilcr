"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Shield, Clock, CreditCard, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface Tenant {
  _id: string;
  slug: string;
  name: string;
  email: string;
  whatsappNumber: string;
  logoUrl: string;
  description: string;
  plan: string;
  status: string;
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
}

const PLAN_LABELS: Record<string, string> = { emprende: "Emprende", pro: "Pro", premium: "Premium" };
const STATUS_LABELS: Record<string, string> = { active: "Activo", inactive: "Inactivo", suspended: "Suspendido" };
const PAYMENT_STATUS_LABELS: Record<string, string> = { pending: "Pendiente", paid: "Pagado", late: "Atrasado", cancelled: "Cancelado" };
const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pending:   "bg-amber-500/20 text-amber-400",
  paid:      "bg-emerald-500/20 text-emerald-400",
  late:      "bg-red-500/20 text-red-400",
  cancelled: "bg-gray-500/20 text-gray-400",
};
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData]       = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [form, setForm]       = useState<Partial<Tenant>>({});

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
          plan: t.plan, status: t.status,
        });
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

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

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <p className="text-white/30">Cargando...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-400">Tenant no encontrado</p>
        <Link href="/superadmin/tenants" className="text-blue-400 hover:text-blue-300 text-sm mt-2 inline-block">← Volver</Link>
      </div>
    );
  }

  const { tenant, payments, accessLogs } = data;

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Link
          href="/superadmin/tenants"
          className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="font-brand text-2xl md:text-3xl font-bold text-white">{tenant.name}</h1>
          <p className="text-white/40 text-sm mt-1">{tenant.slug} · {tenant.email}</p>
        </div>
        <span
          className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
            tenant.status === "active"
              ? "bg-emerald-500/20 text-emerald-400"
              : tenant.status === "suspended"
              ? "bg-red-500/20 text-red-400"
              : "bg-gray-500/20 text-gray-400"
          }`}
        >
          {STATUS_LABELS[tenant.status] ?? tenant.status}
        </span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Edit form */}
        <div
          className="xl:col-span-2 rounded-2xl p-6 space-y-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <h2 className="text-white/70 font-semibold text-sm uppercase tracking-wide">Información del tenant</h2>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nombre">
                <input
                  value={form.name ?? ""}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="saas-input"
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="saas-input"
                />
              </Field>
              <Field label="WhatsApp">
                <input
                  value={form.whatsappNumber ?? ""}
                  onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
                  className="saas-input"
                />
              </Field>
              <Field label="Logo URL">
                <input
                  value={form.logoUrl ?? ""}
                  onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                  className="saas-input"
                />
              </Field>
            </div>
            <Field label="Descripción">
              <textarea
                rows={2}
                value={form.description ?? ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="saas-input resize-none"
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Plan">
                <select
                  value={form.plan ?? ""}
                  onChange={(e) => setForm({ ...form, plan: e.target.value })}
                  className="saas-input cursor-pointer"
                >
                  <option value="emprende">Emprende — ₡12.900</option>
                  <option value="pro">Pro — ₡17.900</option>
                  <option value="premium">Premium — ₡24.900</option>
                </select>
              </Field>
              <Field label="Estado">
                <select
                  value={form.status ?? ""}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="saas-input cursor-pointer"
                >
                  <option value="active">Activo</option>
                  <option value="inactive">Inactivo</option>
                  <option value="suspended">Suspendido</option>
                </select>
              </Field>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl saas-accent-bg text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
              {saveMsg && (
                <p className={`text-sm ${saveMsg.includes("Error") ? "text-red-400" : "text-emerald-400"}`}>
                  {saveMsg}
                </p>
              )}
            </div>
          </form>
        </div>

        {/* Quick stats */}
        <div className="space-y-4">
          <div
            className="rounded-2xl p-5"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <p className="text-white/40 text-xs uppercase tracking-wide font-semibold mb-3">Detalles</p>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-white/40">Plan</dt>
                <dd className="text-white/80 font-medium">{PLAN_LABELS[tenant.plan] ?? tenant.plan}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-white/40">Slug</dt>
                <dd className="text-white/80 font-mono text-xs">{tenant.slug}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-white/40">Registro</dt>
                <dd className="text-white/80">{new Date(tenant.createdAt).toLocaleDateString("es-CR")}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-white/40">Pagos al día</dt>
                <dd className="text-emerald-400 font-semibold">{payments.filter((p) => p.status === "paid").length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-white/40">Atrasados</dt>
                <dd className="text-red-400 font-semibold">{payments.filter((p) => p.status === "late").length}</dd>
              </div>
            </dl>
          </div>
          <a
            href={`/${tenant.slug}/admin`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm text-white/60 hover:text-white transition-colors"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <Shield className="w-4 h-4" />
            Ver admin del tenant
          </a>
        </div>
      </div>

      {/* Payment history */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div
          className="flex items-center gap-2 px-5 py-3"
          style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <CreditCard className="w-4 h-4 text-white/30" />
          <h2 className="text-white/70 font-semibold text-sm uppercase tracking-wide">Historial de pagos</h2>
        </div>
        {payments.length === 0 ? (
          <div className="px-5 py-8 text-center text-white/30 text-sm">Sin pagos registrados</div>
        ) : (
          <div>
            <div
              className="grid grid-cols-[80px_1fr_100px_120px_100px] px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-white/30"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <span>Período</span>
              <span>Monto</span>
              <span>Vence</span>
              <span>Pagado</span>
              <span>Estado</span>
            </div>
            {payments.map((p, i) => (
              <div
                key={p._id}
                className="grid grid-cols-[80px_1fr_100px_120px_100px] px-5 py-3 items-center text-sm"
                style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
              >
                <span className="text-white/60 font-mono text-xs">{MONTHS[p.periodMonth - 1]} {p.periodYear}</span>
                <span className="text-white/80 font-medium">₡{p.amount.toLocaleString("es-CR")}</span>
                <span className="text-white/40 text-xs">{new Date(p.dueDate).toLocaleDateString("es-CR")}</span>
                <span className="text-white/40 text-xs">
                  {p.paidAt ? new Date(p.paidAt).toLocaleDateString("es-CR") : "—"}
                </span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full w-fit ${PAYMENT_STATUS_COLORS[p.status] ?? "bg-gray-500/20 text-gray-400"}`}>
                  {PAYMENT_STATUS_LABELS[p.status] ?? p.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Access logs */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div
          className="flex items-center gap-2 px-5 py-3"
          style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <Clock className="w-4 h-4 text-white/30" />
          <h2 className="text-white/70 font-semibold text-sm uppercase tracking-wide">Últimos accesos</h2>
        </div>
        {accessLogs.length === 0 ? (
          <div className="px-5 py-8 text-center text-white/30 text-sm">Sin registros de acceso</div>
        ) : (
          <div>
            <div
              className="grid grid-cols-[1fr_120px_80px_140px] px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-white/30"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <span>Usuario</span>
              <span>IP</span>
              <span>Resultado</span>
              <span>Fecha</span>
            </div>
            {accessLogs.map((log, i) => (
              <div
                key={log._id}
                className="grid grid-cols-[1fr_120px_80px_140px] px-5 py-3 items-center text-sm"
                style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
              >
                <span className="text-white/70 text-xs font-mono truncate">{log.userEmail}</span>
                <span className="text-white/40 text-xs font-mono">{log.ip}</span>
                <span>
                  {log.success
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    : <XCircle className="w-4 h-4 text-red-400" />}
                </span>
                <span className="text-white/40 text-xs">
                  {new Date(log.createdAt).toLocaleString("es-CR", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-white/40 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
