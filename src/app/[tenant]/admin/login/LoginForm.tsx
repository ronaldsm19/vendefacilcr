"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Store } from "lucide-react";

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
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, tenantSlug: slug }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.passwordChanged === false) {
          try { sessionStorage.setItem("vf_pw_reminder", "1"); } catch {}
        }
        router.push(`/${slug}/admin`);
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
            Acceso de administrador
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Correo electrónico"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none transition-colors"
              style={{ ["--tw-ring-color" as string]: primaryColor }}
              onFocus={(e) => (e.currentTarget.style.borderColor = primaryColor)}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
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
