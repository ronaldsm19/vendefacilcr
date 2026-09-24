"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePolling } from "@/hooks/usePolling";
import { Copy, Check, Loader2, RefreshCw } from "lucide-react";

interface JobRow {
  id: string;
  type: string;
  station: string;
  label: string;
  status: "pending" | "printing" | "done" | "failed";
  attempts: number;
  lastError: string;
  claimedAt: string | null;
  printedAt: string | null;
  createdAt: string;
  refId: string;
}

const STATUS_BADGE: Record<JobRow["status"], string> = {
  pending: "bg-amber-50 text-amber-600",
  printing: "bg-blue-50 text-blue-600",
  done: "bg-emerald-50 text-emerald-600",
  failed: "bg-red-50 text-red-600",
};
const STATUS_LABEL: Record<JobRow["status"], string> = {
  pending: "Pendiente",
  printing: "Imprimiendo",
  done: "Impreso",
  failed: "Fallido",
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("es-CR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function PrintQueueSection() {
  const [token, setToken] = useState("");
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const loadJobs = useCallback(() => {
    return fetch("/api/admin/print-jobs").then((r) => r.json()).then((d) => {
      if (d.error) { setError(d.error); return; }
      setJobs(d.jobs ?? []);
      setLastSeenAt(d.agentLastSeenAt ?? null);
      setLoading(false);
      setNow(Date.now());
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/admin/print-agent-token").then((r) => r.json()).then((d) => {
      if (!d.error) { setToken(d.token ?? ""); setLastSeenAt(d.lastSeenAt ?? null); }
    }).catch(() => {});
  }, []);

  usePolling(loadJobs, 5000, true);

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/print-agent-token", { method: "POST" });
      const d = await res.json();
      if (res.ok) {
        setToken(d.token);
        setConfirmRegenerate(false);
      } else {
        setError(d.error ?? "No se pudo generar el token");
      }
    } finally {
      setGenerating(false);
    }
  }

  async function copyToken() {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard no disponible; el input readOnly sigue permitiendo seleccionar y copiar a mano
    }
  }

  async function runJobAction(id: string, action: "retry" | "cancel") {
    setBusyJobId(id);
    try {
      const res = await fetch(`/api/admin/print-jobs/${id}/${action}`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "No se pudo actualizar el trabajo"); return; }
      await loadJobs();
    } finally {
      setBusyJobId(null);
    }
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  let agentDot = "bg-gray-300";
  let agentText = "El agente todavía no se ha conectado";
  if (lastSeenAt) {
    const seenMs = new Date(lastSeenAt).getTime();
    const seconds = Math.max(0, Math.round((now - seenMs) / 1000));
    if (seconds <= 15) {
      agentDot = "bg-emerald-500";
      agentText = `Agente conectado · hace ${seconds} s`;
    } else {
      agentDot = "bg-amber-500";
      agentText = `Agente sin conexión · última vez ${new Date(lastSeenAt).toLocaleString("es-CR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`;
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-brand-muted p-4 sm:p-6 space-y-6">
      <div>
        <h2 className="font-semibold text-brand-dark text-lg">Impresión</h2>
        <p className="text-sm text-brand-dark/50 mt-0.5">Cola de impresión de comandas y conexión con el agente de la PC.</p>
      </div>

      {error && <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{error}</p>}

      {/* Estado del agente */}
      <div className="flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${agentDot}`} />
        <span className="text-sm text-brand-dark/70">{agentText}</span>
      </div>

      {/* Token */}
      <div className="space-y-2">
        {!token ? (
          <>
            <p className="text-sm text-brand-dark/60">Todavía no generaste un token.</p>
            <Button type="button" onClick={generate} disabled={generating}>
              {generating && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              Generar token
            </Button>
          </>
        ) : (
          <>
            <input
              readOnly
              value={token}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full border border-brand-muted rounded-xl px-3 py-2 text-xs font-mono focus:outline-none"
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={copyToken}>
                {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                {copied ? "Copiado" : "Copiar"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setConfirmRegenerate(true)}>
                <RefreshCw className="w-4 h-4 mr-1" /> Regenerar
              </Button>
            </div>
            <p className="text-xs text-brand-dark/50">
              Pegá este token en la configuración del agente de impresión de la PC (<code>cloudToken</code>) junto con la dirección del sistema (<code>cloudUrl</code>): {origin}
            </p>
          </>
        )}
      </div>

      {/* Últimos trabajos */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="border-b border-brand-muted text-brand-dark/50 text-xs uppercase tracking-wider">
              <th className="text-left px-2 py-2">Fecha</th>
              <th className="text-left px-2 py-2">Documento</th>
              <th className="text-left px-2 py-2">Estado</th>
              <th className="text-left px-2 py-2">Intentos</th>
              <th className="text-left px-2 py-2">Error</th>
              <th className="text-right px-2 py-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-2 py-6 text-brand-dark/40 text-sm">Cargando...</td></tr>
            ) : jobs.length === 0 ? (
              <tr><td colSpan={6} className="px-2 py-6 text-center text-brand-dark/40">Todavía no hay trabajos de impresión.</td></tr>
            ) : jobs.map((job) => (
              <tr key={job.id} className="border-b border-brand-muted/50">
                <td className="px-2 py-2 text-brand-dark/60 text-xs whitespace-nowrap">{fmtDateTime(job.createdAt)}</td>
                <td className="px-2 py-2 text-brand-dark">{job.label}</td>
                <td className="px-2 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[job.status]}`}>{STATUS_LABEL[job.status]}</span>
                </td>
                <td className="px-2 py-2 text-brand-dark/60">{job.attempts}</td>
                <td className="px-2 py-2 text-brand-dark/60 text-xs max-w-[160px] truncate" title={job.lastError}>
                  {job.lastError ? job.lastError.slice(0, 60) : "—"}
                </td>
                <td className="px-2 py-2">
                  <div className="flex justify-end">
                    {busyJobId === job.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-brand-dark/40" />
                    ) : job.status === "failed" ? (
                      <button
                        onClick={() => runJobAction(job.id, "retry")}
                        className="text-xs px-2.5 py-1 rounded-lg border border-brand-muted hover:border-brand-pink text-brand-dark/70"
                      >
                        Reintentar
                      </button>
                    ) : job.status === "pending" ? (
                      <Button size="sm" variant="destructive" className="h-7 px-2.5" onClick={() => runJobAction(job.id, "cancel")}>
                        Cancelar
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={confirmRegenerate} onOpenChange={(v) => !v && setConfirmRegenerate(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Regenerar token</DialogTitle></DialogHeader>
          <div className="px-6 pt-2 pb-6 space-y-4">
            <p className="text-sm text-brand-dark/60">El token actual dejará de funcionar y el agente no imprimirá hasta que le configurés el nuevo.</p>
            <div className="flex gap-3">
              <Button variant="cancel" className="flex-1" onClick={() => setConfirmRegenerate(false)}>Cancelar</Button>
              <Button className="flex-1" disabled={generating} onClick={generate}>Regenerar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
