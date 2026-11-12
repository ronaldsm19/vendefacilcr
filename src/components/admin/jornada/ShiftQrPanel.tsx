"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { LogIn, LogOut, Smartphone } from "lucide-react";
import { usePolling } from "@/hooks/usePolling";
import { formatCRTime } from "@/lib/workPeriod";

/**
 * El código para marcar jornada desde el teléfono, en la computadora del negocio.
 *
 * Va al lado del marcaje con PIN y no en su lugar: quien no tiene la app o se quedó sin batería
 * sigue marcando como siempre.
 *
 * El código cambia solo cada medio minuto. Acá se vuelve a pedir cada pocos segundos, y no una
 * vez por código, porque la misma consulta trae lo otro que esta pantalla necesita: quién acaba
 * de marcar con el teléfono. Sin eso, la persona marca y la computadora no dice nada.
 */

interface RecentMark {
  id: string;
  staffName: string;
  action: "entrada" | "salida";
  at: string;
}

interface ShiftQrData {
  code: string;
  payload: string;
  changesAt: string;
  stepMs: number;
  now: string;
  recent: RecentMark[];
}

const POLL_MS = 4000;

function formatCode(code: string) {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export default function ShiftQrPanel({ onMarked }: { onMarked: () => void }) {
  const [data, setData] = useState<ShiftQrData | null>(null);
  // Cuánto adelanta o atrasa el reloj de esta computadora respecto del servidor. El código lo
  // decide el servidor; con el reloj de la computadora la barra se vaciaría antes o después.
  const [skewMs, setSkewMs] = useState(0);
  const [error, setError] = useState("");
  const [nowMs, setNowMs] = useState(0);
  const seen = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/work-shifts/qr");
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "No se pudo cargar el código");
      return;
    }
    setError("");
    setSkewMs(new Date(body.now).getTime() - Date.now());
    setData(body);

    // Un marcaje que no estaba en la consulta anterior: se avisa para refrescar "Trabajando
    // ahora". La primera consulta no cuenta, o cada vez que se abre la página parecería que
    // alguien acaba de marcar.
    const ids = new Set<string>((body.recent ?? []).map((r: RecentMark) => r.id));
    const previous = seen.current;
    seen.current = ids;
    if (previous && [...ids].some((id) => !previous.has(id))) onMarked();
  }, [onMarked]);

  usePolling(load, POLL_MS, true);

  useEffect(() => {
    const tick = () => setNowMs(Date.now());
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, []);

  const remainingMs = data && nowMs ? Math.max(0, new Date(data.changesAt).getTime() - (nowMs + skewMs)) : 0;
  const fraction = data ? Math.min(1, remainingMs / data.stepMs) : 0;

  return (
    <div className="mt-6 pt-6 border-t border-brand-muted">
      <h3 className="font-semibold text-brand-dark flex items-center gap-2">
        <Smartphone className="w-4 h-4 text-brand-pink" /> Marcar con el teléfono
      </h3>
      <p className="text-sm text-brand-dark/50 mt-1 mb-4">
        En la app, abrí <span className="font-medium text-brand-dark/70">Mi jornada</span>, tocá{" "}
        <span className="font-medium text-brand-dark/70">Marcar entrada</span> o{" "}
        <span className="font-medium text-brand-dark/70">Marcar salida</span> y escaneá este código.
      </p>

      {error ? (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
      ) : !data ? (
        <p className="text-sm text-brand-dark/40">Cargando código...</p>
      ) : (
        <div className="flex flex-col xl:flex-row items-center xl:items-start gap-5">
          <div className="bg-white p-3 rounded-xl border border-brand-muted shrink-0">
            <QRCodeSVG value={data.payload} size={168} level="M" />
          </div>

          <div className="flex-1 min-w-0 w-full text-center xl:text-left">
            <p className="text-xs text-brand-dark/40 uppercase tracking-wide">O escribí este código</p>
            <p className="font-mono text-2xl font-bold tracking-[0.2em] text-brand-dark mt-1 whitespace-nowrap">{formatCode(data.code)}</p>

            <div className="mt-3 h-1.5 rounded-full bg-brand-muted/60 overflow-hidden" aria-hidden="true">
              <div
                className="h-full bg-brand-pink rounded-full transition-[width] duration-500 ease-linear"
                style={{ width: `${Math.round(fraction * 100)}%` }}
              />
            </div>
            <p className="text-xs text-brand-dark/40 mt-1.5">
              Cambia en {Math.ceil(remainingMs / 1000)} s. No hace falta apurarse: el anterior sigue valiendo un rato.
            </p>

            {data.recent.length > 0 && (
              <ul className="mt-4 space-y-1.5 text-left">
                {data.recent.map((r) => (
                  <li key={r.id} className="flex items-start gap-2 text-sm text-brand-dark bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                    {r.action === "entrada" ? (
                      <LogIn className="w-4 h-4 mt-0.5 text-emerald-700 shrink-0" />
                    ) : (
                      <LogOut className="w-4 h-4 mt-0.5 text-emerald-700 shrink-0" />
                    )}
                    <span className="min-w-0">
                      <span className="font-medium">{r.staffName}</span> marcó {r.action}
                    </span>
                    <span className="ml-auto text-xs text-brand-dark/50 tabular-nums shrink-0">{formatCRTime(new Date(r.at))}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
