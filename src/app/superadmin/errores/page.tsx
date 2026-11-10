"use client";

import { Suspense } from "react";
import ErroresPanel from "@/components/superadmin/errores/ErroresPanel";
import AlertasCorreo from "@/components/superadmin/errores/AlertasCorreo";

/** Superadmin → Errores: qué falla, en qué API, a qué negocio, y los correos de alerta. */
export default function ErroresPage() {
  return (
    <div className="sa-page">
      {/* El panel lee ?negocio= de la URL (enlace desde la ficha del negocio). */}
      <Suspense fallback={<p className="sa-muted">Cargando errores...</p>}>
        <ErroresPanel />
      </Suspense>
      <AlertasCorreo />
    </div>
  );
}
