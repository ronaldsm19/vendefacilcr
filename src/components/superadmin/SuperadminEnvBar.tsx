"use client";

import { useSyncExternalStore } from "react";

type Env = "produccion" | "preview" | "desarrollo";

const LABELS: Record<Env, { name: string; note: string; dot: string }> = {
  produccion: { name: "Producción", note: "Los cambios afectan a negocios reales", dot: "#F0605A" },
  preview: { name: "Vista previa", note: "Copia de prueba del despliegue", dot: "#F2B441" },
  desarrollo: { name: "Desarrollo", note: "Datos de prueba", dot: "#4CC38A" },
};

/** En qué entorno está abierta la consola, según la dirección: para no confundir pruebas con lo real. */
function detectEnv(): Env {
  const host = window.location.hostname;
  if (host === "localhost" || host.endsWith(".localhost") || host.startsWith("127.")) return "desarrollo";
  // Los despliegues de vista previa de Vercel llevan el hash o la rama en el nombre.
  if (host.endsWith(".vercel.app") && /-(git-|[a-z0-9]{9}-)/.test(host)) return "preview";
  return "produccion";
}

const subscribe = () => () => {};

/**
 * Franja oscura arriba de la consola con el entorno, solo en desarrollo y en las vistas previas:
 * en producción no se muestra nada. En el servidor se asume producción.
 */
export default function SuperadminEnvBar({ note }: { note?: string }) {
  const env = useSyncExternalStore<Env>(subscribe, detectEnv, () => "produccion");
  if (env === "produccion") return null;
  const label = LABELS[env];
  return (
    <div className="sa-envbar">
      <span className="sa-envbar-name">
        <span className="sa-envbar-dot" style={{ background: label.dot }} aria-hidden />
        {label.name}
      </span>
      <span className="sa-envbar-note">{note ?? label.note}</span>
    </div>
  );
}
