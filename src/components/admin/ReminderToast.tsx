"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert, X } from "lucide-react";

/**
 * Muestra un recordatorio "Recuerda actualizar tu contraseña" cuando la sesión
 * recién iniciada tiene la contraseña sin cambiar. El flag `vf_pw_reminder` lo
 * setea el LoginForm tras un login exitoso, así aparece en cada login pendiente
 * (no en cada navegación). Auto-descarta a los ~8s.
 */
export default function ReminderToast() {
  const pathname = usePathname();
  const tenant = pathname.split("/")[1];
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("vf_pw_reminder") === "1") {
        sessionStorage.removeItem("vf_pw_reminder");
        setShow(true);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setShow(false), 8000);
    return () => clearTimeout(t);
  }, [show]);

  if (!show) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] max-w-sm">
      <div className="flex items-start gap-3 rounded-xl bg-white border border-brand-pink/20 shadow-lg shadow-black/10 px-4 py-3">
        <div className="mt-0.5 shrink-0 w-8 h-8 rounded-full gradient-bg flex items-center justify-center">
          <ShieldAlert className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-brand-dark">Recuerda actualizar tu contraseña</p>
          <p className="text-xs text-brand-dark/60 mt-0.5">
            Por seguridad, cambiá la contraseña temporal desde tu{" "}
            <Link
              href={`/${tenant}/admin/perfil`}
              onClick={() => setShow(false)}
              className="font-semibold text-brand-pink hover:underline"
            >
              Perfil
            </Link>
            .
          </p>
        </div>
        <button
          onClick={() => setShow(false)}
          className="shrink-0 text-brand-dark/30 hover:text-brand-dark/60 transition-colors cursor-pointer"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
