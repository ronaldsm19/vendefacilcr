"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Store, Loader2, Check } from "lucide-react";

interface Profile {
  email: string;
  tenantSlug: string;
  tenantName: string;
  plan: string;
  whatsappNumber: string;
}

const PLAN_LABELS: Record<string, string> = { emprende: "Emprende", pro: "Pro", premium: "Premium" };

export default function PerfilPage() {
  const router = useRouter();
  const params = useParams();
  const slug = String(params.tenant ?? "");

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/admin/auth/me")
      .then((r) => r.json())
      .then((d) => setProfile(d))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (form.newPassword.length < 8) {
      setError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      setError("La confirmación no coincide con la nueva contraseña.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo cambiar la contraseña.");
        return;
      }
      // Éxito: la sesión ya fue cerrada en el servidor. Redirigir al login.
      setDone(true);
      setTimeout(() => {
        router.push(`/${slug}/admin/login`);
        router.refresh();
      }, 1500);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-brand-dark/40">Cargando perfil...</div>
      </div>
    );
  }

  const rows: { label: string; value: string }[] = [
    { label: "Nombre del negocio", value: profile?.tenantName ?? "—" },
    { label: "URL de la tienda", value: `vendefacilcr.com/${profile?.tenantSlug ?? ""}` },
    { label: "Correo de administrador", value: profile?.email ?? "—" },
    { label: "WhatsApp", value: profile?.whatsappNumber || "—" },
    { label: "Plan", value: PLAN_LABELS[profile?.plan ?? ""] ?? profile?.plan ?? "—" },
  ];

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-2xl">
      <div>
        <h1 className="font-brand text-2xl md:text-3xl font-bold text-brand-dark">Perfil</h1>
        <p className="text-brand-dark/50 text-sm mt-1">Datos de tu cuenta y seguridad</p>
      </div>

      {/* Datos del perfil (solo lectura) */}
      <div className="bg-white rounded-2xl card-shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <Store className="w-4 h-4 text-brand-pink" />
          <h2 className="font-semibold text-brand-dark">Información del negocio</h2>
        </div>
        <dl className="divide-y divide-brand-muted">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-4 py-3">
              <dt className="text-sm text-brand-dark/55">{r.label}</dt>
              <dd className="text-sm font-medium text-brand-dark text-right break-all">{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Cambiar contraseña */}
      <div className="bg-white rounded-2xl card-shadow p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="w-4 h-4 text-brand-pink" />
          <h2 className="font-semibold text-brand-dark">Cambiar contraseña</h2>
        </div>

        {done ? (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
            <Check className="w-4 h-4" />
            Contraseña actualizada. Cerrando sesión...
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <PasswordField
              label="Contraseña actual"
              value={form.currentPassword}
              onChange={(v) => setForm({ ...form, currentPassword: v })}
              visible={show.current}
              onToggle={() => setShow({ ...show, current: !show.current })}
            />
            <PasswordField
              label="Nueva contraseña"
              value={form.newPassword}
              onChange={(v) => setForm({ ...form, newPassword: v })}
              visible={show.next}
              onToggle={() => setShow({ ...show, next: !show.next })}
              hint="Mínimo 8 caracteres."
            />
            <PasswordField
              label="Confirmar nueva contraseña"
              value={form.confirmPassword}
              onChange={(v) => setForm({ ...form, confirmPassword: v })}
              visible={show.confirm}
              onToggle={() => setShow({ ...show, confirm: !show.confirm })}
            />

            {error && (
              <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{error}</p>
            )}

            <p className="text-xs text-brand-dark/45">
              Al cambiar la contraseña se cerrará tu sesión y deberás iniciar de nuevo.
            </p>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl gradient-bg text-white font-semibold text-sm disabled:opacity-60 cursor-pointer hover:opacity-90 transition-opacity"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? "Guardando..." : "Cambiar contraseña"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggle,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  visible: boolean;
  onToggle: () => void;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-brand-dark/70 mb-1">{label}</label>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-brand-muted rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:border-brand-pink transition-colors"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-dark/30 hover:text-brand-dark/60 cursor-pointer"
          aria-label={visible ? "Ocultar" : "Mostrar"}
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {hint && <p className="text-xs text-brand-dark/40 mt-1">{hint}</p>}
    </div>
  );
}
