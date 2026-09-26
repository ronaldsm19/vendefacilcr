import type { Metadata } from "next";
import { formatInviteCode, normalizeInviteCode } from "@/models/AppInvite";
import { resolveInvite } from "@/server/services/appInvites";

/**
 * Página a la que apunta el QR de invitación.
 *
 * El QR lleva un enlace y no el código pelado para que sirva con la cámara del teléfono, que
 * es lo que la gente abre por reflejo. Quien todavía no tenga la app cae acá, ve de qué
 * restaurante es y de dónde bajarla; quien ya la tenga, escanea desde adentro de la app y no
 * pasa por esta página.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vincular teléfono · VendeFácil",
  robots: { index: false, follow: false },
};

export default async function InvitacionPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const normalized = normalizeInviteCode(code);

  let invite: Awaited<ReturnType<typeof resolveInvite>> | null = null;
  try {
    invite = await resolveInvite(normalized);
  } catch {
    invite = null;
  }

  return (
    <main className="min-h-screen bg-brand-muted/40 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-3xl card-shadow p-8 space-y-6">
        {invite ? (
          <>
            <div className="text-center space-y-2">
              <p className="text-xs uppercase tracking-wide text-brand-dark/40">Invitación para el personal de</p>
              <h1 className="font-brand text-3xl font-bold text-brand-dark">{invite.tenant.name}</h1>
              {invite.staffName && (
                <p className="text-brand-dark/60">
                  Para <span className="font-medium text-brand-dark">{invite.staffName}</span>
                </p>
              )}
            </div>

            <div className="bg-brand-muted/30 rounded-2xl p-5 text-center space-y-1">
              <p className="text-xs uppercase tracking-wide text-brand-dark/40">Código</p>
              <p className="font-mono text-2xl font-bold tracking-[0.2em] text-brand-dark">
                {formatInviteCode(normalized)}
              </p>
            </div>

            <ol className="space-y-3 text-sm text-brand-dark/70">
              <li>
                <span className="font-medium text-brand-dark">1.</span> Instalá la app{" "}
                <span className="font-medium text-brand-dark">VendeFácil Mesero</span> en el teléfono.
              </li>
              <li>
                <span className="font-medium text-brand-dark">2.</span> Abrila y tocá{" "}
                <span className="font-medium text-brand-dark">Escanear código</span>, o escribí el código de arriba.
              </li>
              <li>
                <span className="font-medium text-brand-dark">3.</span> Entrá con tu usuario y tu PIN de cuatro
                dígitos. Si no los tenés, pedíselos al administrador.
              </li>
            </ol>

            <p className="text-xs text-brand-dark/40 text-center">
              Este código solo indica a qué restaurante pertenece el teléfono. No abre sesión ni da acceso a nada
              por sí solo.
            </p>
          </>
        ) : (
          <div className="text-center space-y-3">
            <h1 className="font-brand text-2xl font-bold text-brand-dark">Este código no sirve</h1>
            <p className="text-brand-dark/60 text-sm">
              Puede que ya haya vencido o que lo hayan dado de baja. Pedile al administrador del restaurante que te
              genere uno nuevo desde Usuarios.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
