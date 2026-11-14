"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Store } from "lucide-react";
import { LOGIN_NOTICES_FLAG } from "@/lib/notices";

interface LoginFormProps {
  slug: string;
  tenantName: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
}

export default function LoginForm({
  slug,
  tenantName,
  logoUrl,
  primaryColor,
  secondaryColor,
}: LoginFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({ login: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [otherSession, setOtherSession] = useState<{ name: string; slug: string } | null>(null);

  // La sesión es una sola por navegador: si está abierta la de otro negocio, se avisa antes de
  // ingresar acá (al ingresar, esa se cierra). El encabezado va explícito porque este efecto corre
  // antes de que el panel instale el suyo.
  useEffect(() => {
    let alive = true;
    fetch("/api/admin/auth/me", { headers: { "x-ennea-tenant": slug } })
      .then(async (res) => {
        const data = await res.json().catch(() => null) as { code?: string; other?: { name: string; slug: string } } | null;
        if (alive && res.status === 401 && data?.code === "OTHER_TENANT" && data.other) setOtherSession(data.other);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [slug]);

  const isStaff = form.login.trim() !== "" && !form.login.includes("@");

  function handleLoginChange(value: string) {
    setForm((prev) => {
      const nextIsStaff = value.trim() !== "" && !value.includes("@");
      if (nextIsStaff !== isStaff) return { login: value, password: "" };
      return { ...prev, login: value };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: form.login.trim(), password: form.password, tenantSlug: slug }),
      });
      const data = await res.json();
      if (res.ok) {
        // El panel muestra los avisos (cobro, mensajes de Ennea) en cada inicio de sesión.
        try { sessionStorage.setItem(LOGIN_NOTICES_FLAG, "1"); } catch {}
        if (data.role === "admin" && data.passwordChanged === false) {
          try { sessionStorage.setItem("vf_pw_reminder", "1"); } catch {}
        }
        router.push(data.redirectTo ?? `/${slug}/admin`);
        router.refresh();
      } else {
        setError(data.error ?? "Error al iniciar sesión");
      }
    } finally {
      setLoading(false);
    }
  }

  const gradient = `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`;

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: `${primaryColor}10` }}
    >
      {/* Soft background blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-3xl opacity-20"
          style={{ background: gradient }}
        />
        <div
          className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full blur-3xl opacity-15"
          style={{ backgroundColor: secondaryColor }}
        />
      </div>

      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl shadow-black/5 border border-black/5 p-8">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            {logoUrl ? (
              <div className="w-20 h-20 rounded-full overflow-hidden shadow-lg ring-2 ring-white ring-offset-2" style={{ boxShadow: `0 4px 20px ${primaryColor}30` }}>
                <Image
                  src={logoUrl}
                  alt={tenantName}
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                  priority
                />
              </div>
            ) : (
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg"
                style={{ background: gradient }}
              >
                <Store className="w-9 h-9 text-white" />
              </div>
            )}
          </div>
          <p
            className="font-brand text-2xl font-bold"
            style={{ background: gradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
          >
            {tenantName}
          </p>
          <p className="text-sm mt-1" style={{ color: `${primaryColor}80` }}>
            Acceso al panel
          </p>
        </div>

        {otherSession && (
          <div role="status" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p>
              Tenés abierta la sesión de <strong>{otherSession.name}</strong> en este navegador. Si ingresás acá, esa sesión se cierra.
            </p>
            <a href={`/${otherSession.slug}/admin`} className="mt-1 inline-block font-semibold underline underline-offset-2">
              Volver a {otherSession.name}
            </a>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo o usuario</label>
            <input
              type="text"
              required
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={form.login}
              onChange={(e) => handleLoginChange(e.target.value)}
              placeholder="correo@negocio.com o usuario"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none transition-colors"
              style={{ ["--tw-ring-color" as string]: primaryColor }}
              onFocus={(e) => (e.currentTarget.style.borderColor = primaryColor)}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isStaff ? "PIN" : "Contraseña"}
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                inputMode={isStaff ? "numeric" : undefined}
                pattern={isStaff ? "[0-9]{4}" : undefined}
                maxLength={isStaff ? 4 : undefined}
                autoComplete="current-password"
                placeholder={isStaff ? "4 dígitos" : undefined}
                value={form.password}
                onChange={(e) => {
                  const value = isStaff ? e.target.value.replace(/\D/g, "").slice(0, 4) : e.target.value;
                  setForm({ ...form, password: value });
                }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none transition-colors"
                onFocus={(e) => (e.currentTarget.style.borderColor = primaryColor)}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-opacity disabled:opacity-60 cursor-pointer hover:opacity-90"
            style={{ background: gradient }}
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
