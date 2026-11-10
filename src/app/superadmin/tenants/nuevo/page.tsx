"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, CircleAlert, Copy, Eye, EyeOff } from "lucide-react";
import { formatCRC, DEFAULT_PLAN_PRICES, PLAN_KEYS, PLAN_LABELS } from "@/lib/billing";
import { PLAN_CARDS } from "@/lib/planes";

const PLAN_OPTIONS = PLAN_KEYS.map((key) => ({
  value: key,
  label: PLAN_LABELS[key],
  price: `${formatCRC(DEFAULT_PLAN_PRICES[key])}/mes`,
  para: PLAN_CARDS.find((c) => c.key === key)?.para ?? "",
}));

const COLOR_FIELDS = [
  { key: "primaryColor",   label: "Principal" },
  { key: "secondaryColor", label: "Secundario" },
  { key: "accentColor",    label: "Acento" },
] as const;

interface CreatedResult {
  slug: string;
  tempPassword: string;
}

export default function NuevoTenantPage() {
  const [form, setForm] = useState({
    slug:            "",
    name:            "",
    email:           "",
    whatsappNumber:  "",
    plan:            "emprende",
    primaryColor:    "#6366F1",
    secondaryColor:  "#8B5CF6",
    accentColor:     "#F59E0B",
  });
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [created, setCreated] = useState<CreatedResult | null>(null);
  const [showPw,  setShowPw]  = useState(false);
  const [copied,  setCopied]  = useState(false);

  function set(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/superadmin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug:           form.slug.toLowerCase().trim(),
          name:           form.name.trim(),
          email:          form.email.trim(),
          whatsappNumber: form.whatsappNumber.trim(),
          plan:           form.plan,
          status:         "active",
          theme: {
            primaryColor:   form.primaryColor,
            secondaryColor: form.secondaryColor,
            accentColor:    form.accentColor,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al crear el negocio");
        return;
      }
      setCreated({ slug: form.slug.toLowerCase().trim(), tempPassword: data.tempPassword });
    } finally {
      setSaving(false);
    }
  }

  function copyCredentials() {
    if (!created) return;
    const text = `Tu tienda ya está lista en VendeFácil!\n\nPanel de administración: ${window.location.origin}/${created.slug}/admin/\nEmail: ${form.email}\nContraseña temporal: ${created.tempPassword}\n\nIngresá al panel y cambiá tu contraseña en la primera sesión.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  if (created) {
    return (
      <div className="sa-page">
        <header className="sa-page-head">
          <div>
            <h1 className="sa-title">¡Negocio creado!</h1>
            <p className="sa-subtitle">
              La tienda <span className="sa-strong">{form.name}</span> ya está activa.
            </p>
          </div>
        </header>

        <section className="sa-card sa-card-pad flex w-full max-w-2xl flex-col gap-4">
          <h2 className="sa-h2">Credenciales de acceso</h2>

          <div className="sa-inset flex flex-col gap-4 p-4">
            <div>
              <p className="sa-eyebrow">URL del panel admin</p>
              <p className="sa-mono mt-1 [overflow-wrap:anywhere]">
                {typeof window !== "undefined" ? window.location.origin : ""}/{created.slug}/admin/
              </p>
            </div>
            <div>
              <p className="sa-eyebrow">Email</p>
              <p className="sa-mono mt-1 [overflow-wrap:anywhere]">{form.email}</p>
            </div>
            <div className="sa-field">
              <label htmlFor="temp-password" className="sa-eyebrow">Contraseña temporal</label>
              <div className="sa-input-wrap">
                <input
                  id="temp-password"
                  type={showPw ? "text" : "password"}
                  readOnly
                  value={created.tempPassword}
                  autoComplete="off"
                  className="sa-input font-mono!"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="sa-icon-btn"
                  aria-label={showPw ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPw ? <EyeOff className="w-4 h-4" aria-hidden /> : <Eye className="w-4 h-4" aria-hidden />}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <button type="button" onClick={copyCredentials} className="sa-btn sa-btn-sm sa-btn-secondary">
                {copied ? <Check className="w-4 h-4" aria-hidden /> : <Copy className="w-4 h-4" aria-hidden />}
                {copied ? "¡Copiado!" : "Copiar credenciales"}
              </button>
              <span className="sa-help">Para enviar al cliente.</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/superadmin/tenants/nuevo`}
              onClick={() => { setCreated(null); setForm({ slug: "", name: "", email: "", whatsappNumber: "", plan: "emprende", primaryColor: "#6366F1", secondaryColor: "#8B5CF6", accentColor: "#F59E0B" }); }}
              className="sa-btn sa-btn-primary"
            >
              Crear otro negocio
            </Link>
            <Link href={`/superadmin/tenants`} className="sa-btn sa-btn-secondary">
              Ver todos los negocios
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="sa-page">
      <header className="sa-page-head">
        <div>
          <p className="mb-2 text-[13px]">
            <Link href="/superadmin/tenants" className="sa-link inline-flex items-center gap-1.5">
              <ArrowLeft className="w-4 h-4" aria-hidden /> Volver a negocios
            </Link>
          </p>
          <h1 className="sa-title">Nuevo negocio</h1>
          <p className="sa-subtitle">Crear una nueva tienda en VendeFácil</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="flex w-full max-w-2xl flex-col gap-6">
        {/* Información básica */}
        <section className="sa-card">
          <div className="sa-card-head">
            <h2 className="sa-h2">Información básica</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
            <label className="sa-field">
              <span className="sa-label">Nombre del negocio <Required /></span>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Mi Repostería Artesanal"
                className="sa-input"
              />
            </label>

            <label className="sa-field">
              <span className="sa-label">Slug (URL de la tienda) <Required /></span>
              <input
                type="text"
                required
                value={form.slug}
                onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="mireposteria"
                className="sa-input"
              />
              <span className="sa-help [overflow-wrap:anywhere]">
                vendefacilcr.com/<span className="sa-strong">{form.slug || "mireposteria"}</span>
                {" · "}Solo letras minúsculas, números y guiones.
              </span>
            </label>

            <label className="sa-field">
              <span className="sa-label">Email del dueño <Required /></span>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="dueño@gmail.com"
                className="sa-input"
              />
              <span className="sa-help">Este email será el usuario de login del admin.</span>
            </label>

            <label className="sa-field">
              <span className="sa-label">WhatsApp <Required /></span>
              <input
                type="tel"
                required
                value={form.whatsappNumber}
                onChange={(e) => set("whatsappNumber", e.target.value.replace(/\D/g, ""))}
                placeholder="50688887777"
                className="sa-input"
              />
              <span className="sa-help">Con código de país sin el +. Ej: 50688887777</span>
            </label>

            <div className="sa-field sm:col-span-2">
              <span id="plan-label" className="sa-label">Plan <Required /></span>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-labelledby="plan-label">
                {PLAN_OPTIONS.map((p) => {
                  const selected = form.plan === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => set("plan", p.value)}
                      className={`flex cursor-pointer items-center justify-between gap-1 rounded-lg border px-3 py-2.5 text-left sm:flex-col sm:items-start ${
                        selected
                          ? "border-[var(--sa-primary)] bg-[var(--sa-primary-soft)]"
                          : "border-[var(--sa-line-strong)] bg-[var(--sa-surface)] hover:bg-[var(--sa-hover)]"
                      }`}
                    >
                      <span className={selected ? "font-semibold text-[var(--sa-primary)]" : "sa-strong"}>{p.label}</span>
                      <span className="sa-help sa-num">{p.price}</span>
                      <span className="sa-help hidden sm:block">{p.para}</span>
                    </button>
                  );
                })}
              </div>
              <span className="sa-help">
                Nace con los límites de su plan (secciones y tope de productos). Se pueden quitar desde su ficha.
              </span>
            </div>
          </div>
        </section>

        {/* Colores del tema */}
        <section className="sa-card">
          <div className="sa-card-head">
            <div>
              <h2 className="sa-h2">Colores iniciales</h2>
              <p className="sa-help">El cliente puede cambiarlos después desde su panel.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
            {COLOR_FIELDS.map(({ key, label }) => (
              <label key={key} className="sa-field">
                <span className="sa-label">{label}</span>
                <span className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form[key]}
                    onChange={(e) => set(key, e.target.value)}
                    className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-[var(--sa-line-strong)] bg-[var(--sa-surface)] p-0.5"
                  />
                  <span className="sa-mono sa-muted">{form[key]}</span>
                </span>
              </label>
            ))}
          </div>
        </section>

        {error && (
          <div className="sa-alert sa-alert-danger" role="alert">
            <CircleAlert aria-hidden />
            <span className="min-w-0 flex-1">{error}</span>
          </div>
        )}

        <div>
          <button type="submit" disabled={saving} className="sa-btn sa-btn-primary">
            {saving ? "Creando negocio..." : "Crear negocio"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Marca de campo obligatorio; el `required` del campo ya se lo dice al lector de pantalla. */
function Required() {
  return <span className="sa-danger-text" aria-hidden>*</span>;
}
