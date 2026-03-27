"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const params = useParams();
  const tenant = params.tenant as string;

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
        body: JSON.stringify({ ...form, tenantSlug: tenant }),
      });

      if (res.ok) {
        router.push(`/${tenant}/admin`);
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error ?? "Error al iniciar sesión");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-muted/40 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl card-shadow p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <Image
              src="/logo.png"
              alt="Dulce Pecado"
              width={80}
              height={80}
              className="rounded-full drop-shadow-md"
            />
          </div>
          <p className="font-brand text-2xl font-bold gradient-text">Dulce Pecado</p>
          <p className="text-brand-dark/50 text-sm mt-1">Acceso de administrador</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Correo</label>
            <input
              type="email" required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Correo electrónico"
              className="w-full border border-brand-muted rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-pink transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"} required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full border border-brand-muted rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:border-brand-pink transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-dark/40 hover:text-brand-dark cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-500 text-sm bg-red-50 rounded-xl px-3 py-2">{error}</p>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
