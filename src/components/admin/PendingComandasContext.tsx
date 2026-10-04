"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAdminSession } from "@/components/admin/SessionContext";
import { usePolling } from "@/hooks/usePolling";

export interface PendingWaiter {
  waiterId: string;
  waiterName: string;
  count: number;
  oldestMinutes: number;
}

export interface PendingComandas {
  /** "mine" cuando el servidor filtró por el usuario (mesero); "all" para admin y caja. */
  scope: "mine" | "all";
  total: number;
  mine: number;
  tables: number;
  fromPreviousDays: number;
  oldestMinutes: number | null;
  byWaiter: PendingWaiter[];
}

interface PendingComandasValue {
  pending: PendingComandas | null;
  /** Lo que corresponde mostrarle a este usuario en el menú: lo suyo o el total del negocio. */
  badgeCount: number;
  refresh: () => void;
}

const EMPTY: PendingComandasValue = { pending: null, badgeCount: 0, refresh: () => {} };

const PendingComandasContext = createContext<PendingComandasValue>(EMPTY);

/** Cada 30 s: suficiente para que la comanda que cobró otra persona desaparezca del contador sin
 *  que el panel se pase el día pidiendo. Lo que hace el propio usuario se refleja al instante por
 *  el evento, no por el reloj. usePolling además se pausa con la pestaña escondida. */
const POLL_MS = 30_000;

/** Lo dispara quien cambia el estado de una comanda (cobrar, anular, enviar) para que el contador
 *  no espere al siguiente ciclo. */
export const COMANDAS_UPDATED_EVENT = "comandas-updated";

export function notifyComandasUpdated() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(COMANDAS_UPDATED_EVENT));
}

export function PendingComandasProvider({ children }: { children: React.ReactNode }) {
  const session = useAdminSession();
  const [pending, setPending] = useState<PendingComandas | null>(null);

  // Las comandas son del plan premium; en los otros planes el endpoint responde 403 y no hay nada
  // que contar, así que ni se pregunta.
  const enabled = session.isPremium;

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetch("/api/admin/comandas/pending-summary");
      if (!res.ok) { setPending(null); return; }
      setPending(await res.json());
    } catch {
      // Sin conexión se deja el último valor conocido: un contador viejo confunde menos que uno
      // que parpadea en cero cada vez que el wifi tose.
    }
  }, [enabled]);

  usePolling(load, POLL_MS, enabled);

  // Sin premium `load` no pide nada, así que `pending` se queda en null sin tener que limpiarlo.
  useEffect(() => {
    if (!enabled) return;
    window.addEventListener(COMANDAS_UPDATED_EVENT, load);
    return () => window.removeEventListener(COMANDAS_UPDATED_EVENT, load);
  }, [enabled, load]);

  const value = useMemo<PendingComandasValue>(() => ({
    pending,
    badgeCount: pending?.total ?? 0,
    refresh: load,
  }), [pending, load]);

  return <PendingComandasContext.Provider value={value}>{children}</PendingComandasContext.Provider>;
}

/** Fuera del provider devuelve ceros: ningún componente se rompe por leerlo de más. */
export function usePendingComandas(): PendingComandasValue {
  return useContext(PendingComandasContext);
}
