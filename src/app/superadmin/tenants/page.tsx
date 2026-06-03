"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Search, Plus, Mail } from "lucide-react";

interface Tenant {
  _id: string;
  slug: string;
  name: string;
  email: string;
  plan: string;
  status: string;
  passwordChanged?: boolean;
  createdAt: string;
}

const PLAN_LABELS: Record<string, string>   = { emprende: "Emprende", pro: "Pro", premium: "Premium" };
const PLAN_COLORS: Record<string, string>   = {
  emprende: "bg-gray-500/20 text-gray-300",
  pro:      "bg-blue-500/20 text-blue-400",
  premium:  "bg-purple-500/20 text-purple-400",
};
const STATUS_COLORS: Record<string, string> = {
  active:    "bg-emerald-500/20 text-emerald-400",
  inactive:  "bg-gray-500/20 text-gray-400",
  suspended: "bg-red-500/20 text-red-400",
};
const STATUS_LABELS: Record<string, string> = { active: "Activo", inactive: "Inactivo", suspended: "Suspendido" };

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [status, setStatus]   = useState("");
  const [pwFilter, setPwFilter] = useState("");
  const [page, setPage]       = useState(1);
  const [toggling, setToggling] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [notice, setNotice]   = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page) });
    if (search) q.set("search", search);
    if (status) q.set("status", status);
    if (pwFilter) q.set("passwordChanged", pwFilter);
    fetch(`/api/superadmin/tenants?${q}`)
      .then((r) => r.json())
      .then((d) => { setTenants(d.tenants ?? []); setTotal(d.total ?? 0); })
      .finally(() => setLoading(false));
  }, [search, status, pwFilter, page]);

  useEffect(() => { load(); }, [load]);

  async function toggleStatus(tenant: Tenant) {
    const next = tenant.status === "active" ? "suspended" : "active";
    if (!confirm(`¿${next === "active" ? "Activar" : "Suspender"} a ${tenant.name}?`)) return;
    setToggling(tenant._id);
    await fetch(`/api/superadmin/tenants/${tenant._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setToggling(null);
    load();
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
        setNotice({ type: "error", text: `No se pudo enviar el correo a ${d.email}. Contraseña temporal nueva: ${d.tempPassword}` });
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
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-brand text-2xl md:text-3xl font-bold text-white">Tenants</h1>
          <p className="text-white/40 text-sm mt-1">{total} registrados</p>
        </div>
        <Link
          href="/superadmin/tenants/nuevo"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl saas-accent-bg text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" /> Nuevo tenant
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1 min-w-[200px]"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <Search className="w-4 h-4 text-white/30 shrink-0" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por nombre, slug o email..."
            className="bg-transparent text-white text-sm placeholder:text-white/25 focus:outline-none flex-1"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="rounded-xl px-3 py-2 text-sm text-white/70 bg-transparent focus:outline-none cursor-pointer"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <option value="">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
          <option value="suspended">Suspendidos</option>
        </select>
        <select
          value={pwFilter}
          onChange={(e) => { setPwFilter(e.target.value); setPage(1); }}
          className="rounded-xl px-3 py-2 text-sm text-white/70 bg-transparent focus:outline-none cursor-pointer"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <option value="">Contraseña: todas</option>
          <option value="true">Contraseña cambiada</option>
          <option value="false">Pendiente de cambio</option>
        </select>
      </div>

      {/* Notice */}
      {notice && (
        <div
          className={`flex items-start justify-between gap-3 rounded-xl px-4 py-3 text-sm ${
            notice.type === "ok"
              ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-300"
              : "bg-red-500/10 border border-red-500/25 text-red-300"
          }`}
        >
          <span className="break-all">{notice.text}</span>
          <button
            onClick={() => setNotice(null)}
            className="shrink-0 text-white/40 hover:text-white transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div
          className="grid grid-cols-[1fr_100px_90px_140px_90px_160px] px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-white/30"
          style={{ background: "rgba(255,255,255,0.04)" }}
        >
          <span>Tenant</span>
          <span>Plan</span>
          <span>Estado</span>
          <span>Contraseña</span>
          <span>Creado</span>
          <span>Acciones</span>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-center text-white/30 text-sm">Cargando...</div>
        ) : tenants.length === 0 ? (
          <div className="px-5 py-10 text-center text-white/30 text-sm">Sin tenants</div>
        ) : (
          tenants.map((t, i) => (
            <div
              key={t._id}
              className="grid grid-cols-[1fr_100px_90px_140px_90px_160px] px-5 py-3.5 items-center text-sm"
              style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.05)" : "none" }}
            >
              <div>
                <p className="font-medium text-white/80">{t.name}</p>
                <p className="text-white/35 text-xs mt-0.5">{t.slug} · {t.email}</p>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full w-fit ${PLAN_COLORS[t.plan] ?? "bg-gray-500/20 text-gray-400"}`}>
                {PLAN_LABELS[t.plan] ?? t.plan}
              </span>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full w-fit ${STATUS_COLORS[t.status] ?? "bg-gray-500/20 text-gray-400"}`}>
                {STATUS_LABELS[t.status] ?? t.status}
              </span>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full w-fit ${
                t.passwordChanged
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-amber-500/20 text-amber-400"
              }`}>
                {t.passwordChanged ? "Cambiada" : "Pendiente"}
              </span>
              <span className="text-white/35 text-xs">
                {new Date(t.createdAt).toLocaleDateString("es-CR")}
              </span>
              <div className="flex items-center gap-2.5">
                <Link
                  href={`/superadmin/tenants/${t._id}`}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Ver
                </Link>
                <button
                  onClick={() => toggleStatus(t)}
                  disabled={toggling === t._id}
                  className={`text-xs transition-colors cursor-pointer ${t.status === "active" ? "text-red-400 hover:text-red-300" : "text-emerald-400 hover:text-emerald-300"}`}
                >
                  {toggling === t._id ? "..." : t.status === "active" ? "Suspender" : "Activar"}
                </button>
                <button
                  onClick={() => resendInvite(t)}
                  disabled={resendingId === t._id}
                  title="Reenviar invitación (nueva contraseña temporal)"
                  className="inline-flex items-center gap-1 text-xs text-white/50 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Mail className="w-3.5 h-3.5" />
                  {resendingId === t._id ? "..." : "Reenviar"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-lg text-sm text-white/50 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            ← Anterior
          </button>
          <span className="text-white/30 text-sm">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-lg text-sm text-white/50 hover:text-white disabled:opacity-30 transition-colors cursor-pointer"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}
