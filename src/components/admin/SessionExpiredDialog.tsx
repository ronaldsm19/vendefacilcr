"use client";

import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Lo que se ve cuando la sesión del panel ya no sirve. No se puede cerrar —por eso no usa el Dialog
 * compartido, que siempre trae su "X"—: mientras no se vuelva a entrar nada de lo que hay detrás
 * funciona, y dejar seguir ahí es lo que hacía que un marcaje fallara con un mensaje que parecía
 * culpa del PIN.
 */
export default function SessionExpiredDialog({ onLogin }: { onLogin: () => void }) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 space-y-4">
        <h2 id="session-expired-title" className="font-brand text-lg font-bold text-brand-dark">
          Tu sesión venció
        </h2>
        <p className="text-sm text-brand-dark/60">
          Por seguridad hay que volver a entrar. Lo que quedó en pantalla puede estar desactualizado,
          y nada se va a guardar hasta que inicies sesión de nuevo.
        </p>
        <Button onClick={onLogin} autoFocus className="w-full gap-2">
          <LogIn className="w-4 h-4" />
          Iniciar sesión
        </Button>
      </div>
    </div>
  );
}
