"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle, Ban, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleHelp, Clock, Copy, Eye, EyeOff, Tag,
  type LucideIcon,
} from "lucide-react";

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

const PLAN_LABELS: Record<string, string> = { emprende: "Emprende", pro: "Pro", premium: "Premium" };

// Rojo queda para lo que hay que atender: una solicitud rechazada ya está cerrada, por eso va neutra.
const STATUS_CHIPS: Record<string, { label: string; className: string; icon: LucideIcon }> = {
  pending:  { label: "Pendiente", className: "sa-chip sa-chip-warn", icon: Clock },
  approved: { label: "Aprobada",  className: "sa-chip sa-chip-ok",   icon: Check },
  rejected: { label: "Rechazada", className: "sa-chip",              icon: Ban },
};

const FILTERS = [
  { value: "",         label: "Todas",      empty: "No hay solicitudes." },
  { value: "pending",  label: "Pendientes", empty: "No hay solicitudes pendientes." },
  { value: "approved", label: "Aprobadas",  empty: "No hay solicitudes aprobadas." },
  { value: "rejected", label: "Rechazadas", empty: "No hay solicitudes rechazadas." },
];

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("es-CR", { dateStyle: "short", timeStyle: "short" });

function TempPasswordCard({ password, onClose }: { password: string; onClose: () => void }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="sa-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="temp-password-title">
      {/* Sin cierre al hacer clic afuera: la contraseña se muestra una sola vez. */}
      <div className="sa-modal">
        <div>
          <h2 id="temp-password-title" className="sa-modal-title">Negocio aprobado</h2>
          <p className="sa-muted mt-1">Compartí esta contraseña con el nuevo usuario.</p>
        </div>

        <div className="sa-inset px-4 py-3">
          <p className="sa-eyebrow">Contraseña temporal</p>
          <div className="flex items-center gap-1 mt-1">
            {/* .sa-mono trae 12.5 px; acá se agranda para que no se confundan caracteres al dictarla. */}
            <p className="sa-mono sa-strong flex-1 min-w-0 break-all" style={{ fontSize: 16 }}>
              {show ? password : "•".repeat(password.length)}
            </p>
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="sa-icon-btn"
              aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-pressed={show}
            >
              {show ? <EyeOff className="w-4 h-4" aria-hidden /> : <Eye className="w-4 h-4" aria-hidden />}
            </button>
            <button type="button" onClick={copy} className="sa-icon-btn" aria-label="Copiar contraseña">
              {copied ? <Check className="w-4 h-4" aria-hidden /> : <Copy className="w-4 h-4" aria-hidden />}
            </button>
          </div>
          {copied && <p className="sa-success mt-1" role="status">Copiada al portapapeles.</p>}
        </div>

        <div className="sa-alert sa-alert-warn">
          <AlertTriangle aria-hidden />
          <span>Esta contraseña solo se muestra una vez. Asegurate de enviársela al cliente antes de cerrar.</span>
        </div>

        <div className="sa-modal-actions">
          <button type="button" onClick={onClose} className="sa-btn sa-btn-primary">Ya la guardé, cerrar</button>
        </div>
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
    // Sin estado la API devuelve solo las pendientes: "Todas" se pide explícito.
    q.set("status", filter || "all");
    fetch(`/api/superadmin/solicitudes?${q}`)
      .then((r) => r.json())
      .then((d) => { setItems(d.requests ?? []); setTotal(d.total ?? 0); })
      .finally(() => setLoading(false));
  }, [filter, page]);

  useEffect(() => { load(); }, [load]);

  async function act(id: string, action: "approve" | "reject", notes?: string) {
    if (action === "reject" && notes === undefined) {
      const n = prompt("Motivo del rechazo (opcional). Cancelar deja la solicitud como está.");
      if (n === null) return;
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
  const emptyText = FILTERS.find((f) => f.value === filter)?.empty ?? "No hay solicitudes.";

  return (
    <div className="sa-page">
      {tempPassword && (
        <TempPasswordCard password={tempPassword} onClose={() => setTempPassword(null)} />
      )}

      <header className="sa-page-head">
        <div>
          <h1 className="sa-title">Solicitudes</h1>
          <p className="sa-subtitle sa-num">{total} {total === 1 ? "solicitud" : "solicitudes"}</p>
        </div>
        <div className="sa-seg" role="group" aria-label="Filtrar por estado">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => { setFilter(f.value); setPage(1); }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="sa-empty">Cargando...</div>
      ) : items.length === 0 ? (
        <div className="sa-card">
          <div className="sa-empty">{emptyText}</div>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const isOpen = expanded === item._id;
            const detailId = `solicitud-detalle-${item._id}`;
            return (
              <li key={item._id} className="sa-card overflow-hidden">
                <div className="sa-card-pad flex flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="min-w-0">
                      <h2 className="sa-strong text-[15px]">{item.businessName}</h2>
                      <p className="sa-muted text-[13px] break-words">
                        {item.ownerName} · {item.email} · <span className="sa-mono">/{item.slug}</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="sa-chip sa-chip-info">
                        <Tag aria-hidden />
                        Plan {PLAN_LABELS[item.plan] ?? item.plan}
                      </span>
                      <StatusChip status={item.status} />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <span className="sa-muted sa-num text-[13px]">Recibida el {formatDateTime(item.createdAt)}</span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : item._id)}
                        className="sa-btn sa-btn-sm sa-btn-ghost"
                        aria-expanded={isOpen}
                        aria-controls={detailId}
                      >
                        {isOpen ? "Ocultar detalle" : "Ver detalle"}
                        {isOpen ? <ChevronUp className="w-4 h-4" aria-hidden /> : <ChevronDown className="w-4 h-4" aria-hidden />}
                      </button>
                      {item.status === "pending" && (
                        <>
                          <button
                            type="button"
                            onClick={() => act(item._id, "reject")}
                            disabled={acting === item._id}
                            className="sa-btn sa-btn-sm sa-btn-ghost-danger"
                          >
                            Rechazar
                          </button>
                          <button
                            type="button"
                            onClick={() => act(item._id, "approve")}
                            disabled={acting === item._id}
                            className="sa-btn sa-btn-sm sa-btn-primary"
                          >
                            Aprobar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {isOpen && (
                  <dl
                    id={detailId}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 border-t border-[var(--sa-line)] bg-[var(--sa-subtle)]"
                  >
                    <Detail label="WhatsApp" value={item.whatsappNumber || "—"} />
                    <Detail label="Plan solicitado" value={PLAN_LABELS[item.plan] ?? item.plan} />
                    {item.notes && <Detail label="Notas" value={item.notes} className="sm:col-span-2" />}
                    {item.reviewedAt && <Detail label="Revisada" value={formatDateTime(item.reviewedAt)} />}
                  </dl>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <nav className="flex flex-wrap items-center justify-center gap-3" aria-label="Páginas">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="sa-btn sa-btn-sm sa-btn-secondary"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden />
            Anterior
          </button>
          <span className="sa-muted sa-num">Página {page} de {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="sa-btn sa-btn-sm sa-btn-secondary"
          >
            Siguiente
            <ChevronRight className="w-4 h-4" aria-hidden />
          </button>
        </nav>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const chip = STATUS_CHIPS[status];
  if (!chip) return <span className="sa-chip"><CircleHelp aria-hidden />{status}</span>;
  const Icon = chip.icon;
  return <span className={chip.className}><Icon aria-hidden />{chip.label}</span>;
}

function Detail({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="sa-eyebrow">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}
