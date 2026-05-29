"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Copy, Eye, EyeOff } from "lucide-react";

const PLAN_OPTIONS = [
  { value: "emprende", label: "Emprende",  price: "₡12,900/mes", color: "bg-gray-500/20 text-gray-300 border-gray-500/30" },
  { value: "pro",      label: "Pro",       price: "₡17,900/mes", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { value: "premium",  label: "Premium",   price: "₡24,900/mes", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
];

interface CreatedResult {
  slug: string;
  tempPassword: string;
}

export default function NuevoTenantPage() {
  const router = useRouter();

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
        setError(data.error ?? "Error al crear el tenant");
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
      <div className="max-w-lg mx-auto py-12 px-4">
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
            <Check className="w-7 h-7 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-white">¡Tenant creado!</h2>
          <p className="text-white/60 text-sm">
            La tienda <span className="text-white font-semibold">{form.name}</span> ya está activa.
          </p>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left space-y-3 mt-4">
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider mb-1">URL del panel admin</p>
              <p className="text-sm text-white font-mono">
                {typeof window !== "undefined" ? window.location.origin : ""}/{created.slug}/admin/
              </p>
            </div>
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Email</p>
              <p className="text-sm text-white font-mono">{form.email}</p>
            </div>
            <div>
              <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Contraseña temporal</p>
              <div className="flex items-center gap-2">
                <p className="text-sm text-white font-mono flex-1">
                  {showPw ? created.tempPassword : "•".repeat(created.tempPassword.length)}
                </p>
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={copyCredentials}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors border border-white/10"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? "¡Copiado!" : "Copiar credenciales para enviar al cliente"}
          </button>

          <div className="flex gap-3 pt-2">
            <Link
              href={`/superadmin/tenants`}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 hover:text-white text-sm text-center transition-colors"
            >
              Ver todos los tenants
            </Link>
            <Link
              href={`/superadmin/tenants/nuevo`}
              onClick={() => { setCreated(null); setForm({ slug: "", name: "", email: "", whatsappNumber: "", plan: "emprende", primaryColor: "#6366F1", secondaryColor: "#8B5CF6", accentColor: "#F59E0B" }); }}
              className="flex-1 py-2.5 rounded-xl saas-accent-bg text-white text-sm text-center font-medium"
            >
              Crear otro tenant
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/superadmin/tenants"
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Nuevo tenant</h1>
          <p className="text-sm text-white/40">Crear una nueva tienda en VendeFácil</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Información básica */}
        <div className="bg-white/4 border border-white/8 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Información básica</h2>

          <div>
            <label className="block text-sm text-white/70 mb-1.5">
              Nombre del negocio <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Mi Repostería Artesanal"
              className="saas-input"
            />
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-1.5">
              Slug (URL de la tienda) <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center gap-0">
              <span className="px-3 py-2 text-sm text-white/30 bg-white/5 border border-white/10 border-r-0 rounded-l-xl">
                vendefacilcr.com/
              </span>
              <input
                type="text"
                required
                value={form.slug}
                onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                placeholder="mireposteria"
                className="saas-input rounded-l-none border-l-0"
              />
            </div>
            <p className="text-xs text-white/30 mt-1">Solo letras minúsculas, números y guiones.</p>
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-1.5">
              Email del dueño <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="dueño@gmail.com"
              className="saas-input"
            />
            <p className="text-xs text-white/30 mt-1">Este email será el usuario de login del admin.</p>
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-1.5">
              WhatsApp <span className="text-red-400">*</span>
            </label>
            <input
              type="tel"
              required
              value={form.whatsappNumber}
              onChange={(e) => set("whatsappNumber", e.target.value.replace(/\D/g, ""))}
              placeholder="50688887777"
              className="saas-input"
            />
            <p className="text-xs text-white/30 mt-1">Con código de país sin el +. Ej: 50688887777</p>
          </div>

          <div>
            <label className="block text-sm text-white/70 mb-1.5">
              Plan <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PLAN_OPTIONS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => set("plan", p.value)}
                  className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 transition-all ${
                    form.plan === p.value
                      ? `${p.color} border-current`
                      : "border-white/10 text-white/40 hover:border-white/20 hover:text-white/60"
                  }`}
                >
                  <span className="font-semibold text-sm">{p.label}</span>
                  <span className="text-xs opacity-70">{p.price}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Colores del tema */}
        <div className="bg-white/4 border border-white/8 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white/70 uppercase tracking-wider">Colores iniciales</h2>
          <p className="text-xs text-white/30">El cliente puede cambiarlos después desde su panel.</p>

          <div className="grid grid-cols-3 gap-4">
            {(
              [
                { key: "primaryColor",   label: "Principal" },
                { key: "secondaryColor", label: "Secundario" },
                { key: "accentColor",    label: "Acento" },
              ] as { key: keyof typeof form; label: string }[]
            ).map(({ key, label }) => (
              <div key={key} className="flex flex-col items-center gap-2">
                <div className="relative w-12 h-12 rounded-xl overflow-hidden border-2 border-white/15 cursor-pointer hover:border-white/30 transition-colors">
                  <input
                    type="color"
                    value={form[key]}
                    onChange={(e) => set(key, e.target.value)}
                    className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                  />
                  <div className="absolute inset-0 rounded-xl" style={{ backgroundColor: form[key] }} />
                </div>
                <span className="text-xs text-white/50">{label}</span>
                <span className="text-[10px] text-white/30 font-mono">{form[key]}</span>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 rounded-xl saas-accent-bg text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          {saving ? "Creando tenant..." : "Crear tenant"}
        </button>
      </form>
    </div>
  );
}
