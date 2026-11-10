import { Suspense } from "react";
import AvisosPanel from "@/components/superadmin/avisos/AvisosPanel";

export default function AvisosPage() {
  return (
    <Suspense fallback={<div className="sa-page"><p className="sa-muted">Cargando...</p></div>}>
      <AvisosPanel />
    </Suspense>
  );
}
