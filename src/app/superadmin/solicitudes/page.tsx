"use client";

import { useEffect, useState, useCallback } from "react";
import { ClipboardList, CheckCircle2, XCircle, Clock, Eye, EyeOff, Copy } from "lucide-react";

interface SolicitudItem {
  _id: string;
  businessName: string;
  slug: string;
  ownerName: string;
  email: string;
  whatsappNumber: string;
  plan: string;
  status: string;
  notes?: string;
  reviewedAt?: string;
  createdAt: string;
}

const PLAN_LABELS: Record<string, string>  = { emprende: "Emprende", pro: "Pro", premium: "Premium" };
const PLAN_COLORS: Record<string, string>  = {
  emprende: "bg-gray-500/20 text-gray-300",
  pro:      "bg-blue-500/20 text-blue-400",
  premium:  "bg-purple-500/20 text-purple-400",
};
const STATUS_COLORS: Record<string, string> = {
  pending:  "bg-amber-500/20 text-amber-400",
  approved: "bg-emerald-500/20 text-emerald-400",
  rejected: "bg-red-500/20 text-red-400",
};
const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente", approved: "Aprobado", rejected: "Rechazado",
};

function TempPasswordCard({ password, onClose }: { password: string; onClose: () => void }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl p-7 space-y-5"
        style={{ background: "#0D0D14", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl saas-accent-bg flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-semibold text-white">¡Tenant aprobado!</p>
            <p className="text-white/40 text-sm">Comparte esta contraseña con el nuevo usuario</p>
          </div>
        </div>

        <div
          className="rounded-xl p-4 space-y-2"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <p className="text-white/40 text-xs uppercase tracking-wide font-semibold">Contraseña temporal</p>
          <div className="flex items-center gap-3">
            <p className="text-white font-mono text-lg flex-1">
              {show ? password : "•".repeat(password.length)}
            </p>
            <button
              onClick={() => setShow(!show)}
              className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              onClick={copy}
              className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          {copied && <p className="text-emerald-400 text-xs">¡Copiado al portapapeles!</p>}
        </div>

        <p className="text-amber-400 text-xs leading-relaxed">
          ⚠ Esta contraseña solo se muestra una vez. Asegúrate de enviarla al cliente antes de cerrar.
        </p>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl text-sm text-white/60 hover:text-white transition-colors cursor-pointer"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

export default function SolicitudesPage() {
  const [items, setItems]       = useState<SolicitudItem[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState("pending");
  const [page, setPage]         = useState(1);
  const [acting, setActing]     = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page) });
    if (filter) q.set("status", filter);
    fetch(`/api/superadmin/solicitudes?${q}`)
      .then((r) => r.json())
      .then((d) => { setItems(d.items ?? []); setTotal(d.total ?? 0); })
      .finally(() => setLoading(false));
  }, [filter, page]);

  useEffect(() => { load(); }, [load]);

  async function act(id: string, action: "approve" | "reject", notes?: string) {
    if (action === "reject" && !notes) {
      const n = prompt("Motivo del rechazo (opcional):") ?? "";
      return act(id, action, n);
    }
    setActing(id);
    const res = await fetch(`/api/superadmin/solicitudes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, notes }),
    });
    setActing(null);
    if (res.ok) {
      const d = await res.json();
      if (action === "approve" && d.tempPassword) {
        setTempPassword(d.tempPassword);
      }
      load();
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Error al procesar la solicitud");
    }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="p-4 md:p-8 space-y-6">
      {tempPassword && (
        <TempPasswordCard password={tempPassword} onClose={() => setTempPassword(null)} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-brand text-2xl md:text-3xl font-bold text-white">Solicitudes</h1>
          <p className="text-white/40 text-sm mt-1">{total} resultados</p>
        </div>
        <div className="flex items-center gap-2">
          {["", "pending", "approved", "rejected"].map((s) => (
            <button
              key={s}
              onClick={() => { setFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer ${
                filter === s
                  ? "text-white saas-accent-bg"
                  : "text-white/50 hover:text-white"
              }`}
              style={filter !== s ? { background: "rgba(255,255,255,0.05)" } : {}}
            >
              {s === "" ? "Todas" : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-10 text-center text-white/30 text-sm">Cargando...</div>
        ) : items.length === 0 ? (
          <div
            className="rounded-2xl py-12 flex flex-col items-center gap-3"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <ClipboardList className="w-8 h-8 text-white/20" />
            <p className="text-white/30 text-sm">Sin solicitudes</p>
          </div>
        ) : items.map((item) => (
          <div
            key={item._id}
            className="rounded-2xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="flex items-start gap-4 p-5">
              {/* Status icon */}
              <div className="shrink-0 mt-0.5">
                {item.status === "approved" && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                {item.status === "rejected" && <XCircle className="w-5 h-5 text-red-400" />}
                {item.status === "pending"  && <Clock className="w-5 h-5 text-amber-400" />}
              </div>

              {/* Main info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-semibold text-white/90">{item.businessName}</p>
                    <p className="text-white/40 text-xs mt-0.5">
                      {item.ownerName} · {item.email} · /{item.slug}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${PLAN_COLORS[item.plan] ?? "bg-gray-500/20 text-gray-400"}`}>
                      {PLAN_LABELS[item.plan] ?? item.plan}
                    </span>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[item.status] ?? "bg-gray-500/20 text-gray-400"}`}>
                      {STATUS_LABELS[item.status] ?? item.status}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-3 flex-wrap">
                  <span className="text-white/30 text-xs">
                    {new Date(item.createdAt).toLocaleString("es-CR", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                  <button
                    onClick={() => setExpanded(expanded === item._id ? null : item._id)}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                  >
                    {expanded === item._id ? "Ocultar detalle" : "Ver detalle"}
                  </button>
                  {item.status === "pending" && (
                    <>
                      <button
                        onClick={() => act(item._id, "approve")}
                        disabled={acting === item._id}
                        className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {acting === item._id ? "..." : "Aprobar"}
                      </button>
                      <button
                        onClick={() => act(item._id, "reject")}
                        disabled={acting === item._id}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {acting === item._id ? "..." : "Rechazar"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Expanded detail */}
            {expanded === item._id && (
              <div
                className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-3"
                style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
              >
                <Detail label="WhatsApp" value={item.whatsappNumber || "—"} />
                <Detail label="Plan solicitado" value={PLAN_LABELS[item.plan] ?? item.plan} />
                {item.notes && <Detail label="Notas" value={item.notes} className="sm:col-span-2" />}
                {item.reviewedAt && (
                  <Detail
                    label="Revisado"
                    value={new Date(item.reviewedAt).toLocaleString("es-CR", { dateStyle: "short", timeStyle: "short" })}
                  />
                )}
              </div>
            )}
          </div>
        ))}
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

function Detail({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={`space-y-1 pt-3 ${className}`}>
      <p className="text-white/30 text-xs uppercase tracking-wide font-semibold">{label}</p>
      <p className="text-white/70 text-sm">{value}</p>
    </div>
  );
}
