"use client";

import Link from "next/link";
import { Check, Lock, MessageCircle } from "lucide-react";
import { PLAN_LABELS, type PlanKey } from "@/lib/billing";
import { PLAN_CARDS } from "@/lib/planes";
import { waLink } from "@/lib/contacto";

/**
 * Lo que ve el dueño al abrir una sección que su plan no incluye: qué plan la trae, qué más suma
 * ese plan y cómo pedir el cambio. Reemplaza a la pantalla de la sección, dentro del panel.
 */
export default function PlanLockedScreen({
  section,
  plan,
  currentPlan,
  tenantName,
  homeHref,
}: {
  section: string;
  plan: PlanKey;
  currentPlan: string;
  tenantName: string;
  homeHref: string;
}) {
  const card = PLAN_CARDS.find((c) => c.key === plan);
  const current = PLAN_LABELS[currentPlan as PlanKey] ?? currentPlan;
  const wanted = PLAN_LABELS[plan];
  const message = `Hola, soy de ${tenantName}. Quiero pasar del plan ${current} al plan ${wanted} de Ennea.`;

  return (
    <div className="p-4 md:p-8">
      <div className="mx-auto max-w-xl rounded-2xl bg-white card-shadow p-6 md:p-8">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-muted/60 text-brand-dark/70">
            <Lock className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark/45">Plan {wanted}</p>
            <h1 className="font-brand text-2xl font-bold text-brand-dark">{section}</h1>
          </div>
        </div>

        <p className="mt-4 text-sm text-brand-dark/70">
          Esta sección está en el plan {wanted}. Tu negocio tiene el plan {current}.
        </p>

        {card && (
          <div className="mt-5 rounded-xl bg-brand-muted/30 px-4 py-4">
            <p className="text-sm font-semibold text-brand-dark">Con el plan {wanted} también tenés:</p>
            <ul className="mt-3 space-y-2">
              {card.incluye.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-brand-dark/80">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <a
            href={waLink(message)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-dark px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            Pedir el plan {wanted} por WhatsApp
          </a>
          <Link
            href={homeHref}
            className="inline-flex items-center justify-center rounded-xl border border-brand-muted px-4 py-2.5 text-sm font-medium text-brand-dark/70 hover:bg-brand-muted/30"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  );
}
