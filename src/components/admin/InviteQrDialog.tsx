"use client";

import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * El QR que vincula un teléfono con el negocio en la app del mesero.
 *
 * Antes de esto el empleado tenía que escribir a mano el identificador del restaurante en la
 * pantalla de inicio: un dato técnico que había que dictarle y que, mal escrito, dejaba la app
 * sin servir. Ahora lo escanea y listo.
 *
 * El código no inicia sesión: el empleado sigue entrando con su usuario y su PIN. Por eso se
 * puede imprimir y pegar en la cocina sin problema.
 */

interface Invite {
  _id: string;
  code: string;
  staffName: string;
  staffUsername: string;
  expiresAt: string;
  usedCount: number;
}

const DAY_OPTIONS = [
  { days: 1, label: "1 día" },
  { days: 7, label: "7 días" },
  { days: 30, label: "30 días" },
];

function formatCode(code: string) {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

function formatExpiry(iso: string) {
  return new Date(iso).toLocaleDateString("es-CR", { day: "numeric", month: "long", year: "numeric" });
}

export default function InviteQrDialog({
  open,
  onClose,
  staffUserId,
  staffName,
}: {
  open: boolean;
  onClose: () => void;
  /** Vacío = código del negocio entero; con empleado, la app le adelanta el usuario. */
  staffUserId?: string;
  staffName?: string;
}) {
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [days, setDays] = useState(7);
  const [copied, setCopied] = useState(false);

  const generate = useCallback(
    async (forDays: number) => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/admin/app-invites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ staffUserId: staffUserId ?? "", days: forDays }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "No se pudo generar el código");
        setInvite(data.invite);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo generar el código");
      } finally {
        setLoading(false);
      }
    },
    [staffUserId]
  );

  useEffect(() => {
    if (!open) {
      setInvite(null);
      setError("");
      setCopied(false);
      setDays(7);
      return;
    }
    generate(7);
  }, [open, generate]);

  // El enlace se arma con el origen real del navegador: así funciona igual en el dominio
  // propio, en el de Vercel y en una prueba local, sin depender de una variable de entorno.
  const link = invite ? `${window.location.origin}/invitacion/${invite.code}` : "";

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("No se pudo copiar. Copiá el enlace a mano.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="pb-4">
          <DialogTitle>{staffName ? `Vincular el teléfono de ${staffName}` : "Vincular un teléfono"}</DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-5">
          <p className="text-sm text-brand-dark/60">
            {staffName
              ? `Que ${staffName} abra la app del mesero y escanee este código. Le va a quedar el restaurante y su usuario puestos; solo tendrá que marcar su PIN.`
              : "Que el empleado abra la app del mesero y escanee este código. Le va a quedar el restaurante puesto y solo tendrá que entrar con su usuario y su PIN."}
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-brand-dark/40">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : error ? (
            <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{error}</p>
          ) : invite ? (
            <>
              <div className="flex flex-col items-center gap-4 bg-brand-muted/30 rounded-2xl py-6">
                <div className="bg-white p-4 rounded-xl">
                  <QRCodeSVG value={link} size={200} level="M" />
                </div>
                <div className="text-center">
                  <p className="text-xs text-brand-dark/40 uppercase tracking-wide">O escribí este código</p>
                  <p className="font-mono text-2xl font-bold tracking-[0.2em] text-brand-dark mt-1">
                    {formatCode(invite.code)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={link}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 min-w-0 border border-brand-muted rounded-xl px-3 py-2.5 text-xs font-mono text-brand-dark/70 bg-brand-muted/20"
                />
                <Button variant="secondary" size="sm" onClick={copy} className="shrink-0">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>

              <div className="text-sm text-brand-dark/50 space-y-1">
                <p>
                  Vence el <span className="font-medium text-brand-dark/70">{formatExpiry(invite.expiresAt)}</span>.
                </p>
                <p>El código no inicia sesión por sí solo: sin usuario y PIN no sirve de nada.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-brand-dark mb-1">Cambiar la duración</label>
                <div className="flex gap-2">
                  {DAY_OPTIONS.map((o) => (
                    <button
                      key={o.days}
                      type="button"
                      onClick={() => {
                        setDays(o.days);
                        generate(o.days);
                      }}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors cursor-pointer ${
                        days === o.days
                          ? "border-brand-pink bg-brand-pink/10 text-brand-pink"
                          : "border-brand-muted text-brand-dark/60"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => generate(days)}>
                  <RefreshCw className="w-4 h-4 mr-1" /> Generar otro
                </Button>
                <Button className="flex-1" onClick={onClose}>
                  Listo
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
