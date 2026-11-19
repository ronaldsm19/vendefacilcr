"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, X } from "lucide-react";

const linkKey = (slug: string) => `vf_onboarding_link_${slug}`;
const hiddenKey = (slug: string) => `vf_onboarding_hidden_${slug}`;

function readFlag(key: string): boolean {
  try { return localStorage.getItem(key) === "1"; } catch { return false; }
}

function saveFlag(key: string) {
  try { localStorage.setItem(key, "1"); } catch {}
}

interface Step {
  key: string;
  label: string;
  hint: string;
  done: boolean;
  href?: string;
}

/**
 * Primeros pasos de un negocio nuevo, en Inicio. Tres se saben por los datos (logo y colores, productos,
 * una venta); compartir el enlace no deja rastro, así que se da por hecho al copiarlo desde acá. Cuando
 * están los cuatro, o el dueño lo oculta, desaparece.
 */
export default function GettingStarted({
  slug,
  hasBrand,
  hasProducts,
  hasSales,
  brandHref,
  productsHref,
  saleHref,
  saleHint,
}: {
  slug: string;
  hasBrand: boolean;
  hasProducts: boolean;
  hasSales: boolean;
  brandHref: string;
  productsHref: string;
  saleHref: string;
  /** Dónde se hace la primera venta ("Vender › Punto de venta"). */
  saleHint: string;
}) {
  const [linkShared, setLinkShared] = useState(() => readFlag(linkKey(slug)));
  const [hidden, setHidden] = useState(() => readFlag(hiddenKey(slug)));
  const [copyState, setCopyState] = useState<"idle" | "ok" | "error">("idle");

  const storeUrl = typeof window === "undefined" ? `/${slug}` : `${window.location.origin}/${slug}`;

  const steps: Step[] = [
    { key: "brand", label: "Subí tu logo y elegí tus colores", hint: "Configuración › Marca", done: hasBrand, href: brandHref },
    { key: "products", label: "Agregá tus productos", hint: "Productos", done: hasProducts, href: productsHref },
    { key: "link", label: "Compartí el enlace de tu tienda", hint: "Para que tus clientes te pidan por WhatsApp", done: linkShared },
    { key: "sale", label: "Hacé tu primera venta", hint: saleHint, done: hasSales, href: saleHref },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  if (hidden || doneCount === steps.length) return null;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopyState("ok");
      setLinkShared(true);
      saveFlag(linkKey(slug));
    } catch {
      setCopyState("error");
    }
  }

  function hide() {
    setHidden(true);
    saveFlag(hiddenKey(slug));
  }

  return (
    <section aria-labelledby="primeros-pasos" className="bg-white rounded-2xl border border-brand-dark/10 p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id="primeros-pasos" className="font-semibold text-brand-dark">Primeros pasos</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-brand-dark/60">{doneCount} de {steps.length} listos</span>
          <button
            type="button"
            onClick={hide}
            className="p-1.5 rounded-lg text-brand-dark/50 hover:text-brand-dark hover:bg-brand-dark/5 cursor-pointer"
            aria-label="Ocultar los primeros pasos"
            title="Ocultar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-brand-dark/8 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={doneCount} aria-label="Avance de los primeros pasos">
        <div className="h-full rounded-full bg-[var(--admin-fill)] transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <ul className="mt-2 divide-y divide-brand-dark/8">
        {steps.map((step) => (
          <li key={step.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
            {step.done ? (
              <span className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center shrink-0" aria-label="Listo">
                <Check className="w-3.5 h-3.5" strokeWidth={3} />
              </span>
            ) : (
              <span className="w-6 h-6 rounded-full border-2 border-brand-dark/20 shrink-0" aria-label="Pendiente" />
            )}
            <span className="flex-1 min-w-0 basis-48">
              {step.href && !step.done ? (
                <Link href={step.href} className="block text-sm font-semibold text-brand-dark hover:underline underline-offset-2">{step.label}</Link>
              ) : (
                <span className={`block text-sm ${step.done ? "text-brand-dark/60" : "font-semibold text-brand-dark"}`}>{step.label}</span>
              )}
              <span className="block text-xs text-brand-dark/55 mt-0.5">{step.hint}</span>
            </span>
            {step.key === "link" && (
              <span className="flex items-center gap-2 shrink-0 ml-auto">
                <a
                  href={`/${slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg text-brand-dark/55 hover:text-brand-dark hover:bg-brand-dark/5"
                  aria-label="Abrir mi tienda"
                  title="Abrir mi tienda"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={copyLink}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-brand-dark/15 text-sm font-semibold text-[var(--admin-ink)] hover:bg-brand-dark/5 cursor-pointer"
                >
                  {copyState === "ok" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copyState === "ok" ? "Copiado" : "Copiar enlace"}
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
      <p aria-live="polite" className="text-xs text-brand-dark/60">
        {copyState === "error" && <>No se pudo copiar. Este es tu enlace: <span className="font-semibold text-brand-dark break-all">{storeUrl}</span></>}
      </p>
    </section>
  );
}
