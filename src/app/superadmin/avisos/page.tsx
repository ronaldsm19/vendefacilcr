import { Suspense } from "react";
import AvisosPanel from "@/components/superadmin/avisos/AvisosPanel";

export default function AvisosPage() {
  return (
    <Suspense fallback={<div className="p-8 text-white/30 text-sm">Cargando...</div>}>
      <AvisosPanel />
    </Suspense>
  );
}
