"use client";

import { Suspense } from "react";
import ErroresPanel from "@/components/superadmin/errores/ErroresPanel";
import AlertasCorreo from "@/components/superadmin/errores/AlertasCorreo";

/** Superadmin → Errores: qué falla, en qué API, a qué negocio, y los correos de alerta. */
export default function ErroresPage() {
  return (
    <div className="pb-8">
      {/* El panel lee ?negocio= de la URL (enlace desde la ficha del negocio). */}
      <Suspense fallback={<div className="p-8 text-white/30">Cargando errores...</div>}>
        <ErroresPanel />
      </Suspense>
      <div className="px-4 md:px-8">
        <AlertasCorreo />
      </div>
    </div>
  );
}
