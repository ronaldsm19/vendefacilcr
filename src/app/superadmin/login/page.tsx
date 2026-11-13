"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Clock, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { SuperadminBrand } from "@/components/superadmin/SuperadminSidebar";

const subscribe = () => () => {};

/**
 * Ingreso a la consola. Es solo para el superadministrador: no muestra nada de los negocios antes
 * de entrar.
 */
export default function SuperadminLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const secure = useSyncExternalStore(subscribe, () => window.location.protocol === "https:", () => true);

  // Si ya hay sesión activa, redirige directo a la consola.
  useEffect(() => {
    fetch("/api/superadmin/auth/me").then((res) => {
      if (res.ok) router.replace("/superadmin");
      else setChecking(false);
    }).catch(() => setChecking(false));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/superadmin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        router.push("/superadmin");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Error al iniciar sesión");
      }
    } catch {
      setError("No se pudo conectar. Revisá tu conexión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <header className="flex items-center gap-3 px-4 sm:px-8 py-4">
        <SuperadminBrand />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 pt-6 pb-12">
        {checking ? (
          <p className="sa-muted text-sm">Verificando sesión...</p>
        ) : (
          <div className="w-full max-w-[420px] flex flex-col gap-4">
            <form onSubmit={handleSubmit} className="sa-card sa-card-raised flex flex-col gap-5" style={{ padding: "clamp(24px, 4vw, 32px)" }}>
              <span className="sa-chip self-start"><Lock aria-hidden />Solo personal autorizado</span>
              <div>
                <h1 className="sa-title">Ingresar a la consola</h1>
                <p className="sa-subtitle">Usá tu cuenta de superadministrador.</p>
              </div>

              <label className="sa-field">
                <span className="sa-label">Correo</span>
                <input
                  type="email" required autoComplete="username" autoFocus
                  value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="nombre@dominio.com" className="sa-input" style={{ minHeight: 44 }}
                />
              </label>

              <div className="sa-field">
                <label htmlFor="sa-password" className="sa-label">Contraseña</label>
                <div className="sa-input-wrap">
                  <input
                    id="sa-password" type={showPassword ? "text" : "password"} required autoComplete="current-password"
                    value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="sa-input" style={{ minHeight: 44 }}
                  />
                  <button
                    type="button" onClick={() => setShowPassword(!showPassword)} className="sa-icon-btn"
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showPassword ? <EyeOff className="w-[18px] h-[18px]" aria-hidden /> : <Eye className="w-[18px] h-[18px]" aria-hidden />}
                  </button>
                </div>
              </div>

              {error && <p role="alert" className="sa-alert sa-alert-danger">{error}</p>}

              <button type="submit" disabled={loading} className="sa-btn sa-btn-primary" style={{ minHeight: 46, fontSize: 15 }}>
                {loading ? "Ingresando..." : "Ingresar"}
              </button>
            </form>

            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 px-1 text-[13px] sa-muted" style={{ margin: 0, listStyle: "none" }}>
              {secure && <li className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 sa-ok-text" aria-hidden />Conexión cifrada</li>}
              <li className="flex items-center gap-2"><Clock className="w-4 h-4" aria-hidden />La sesión dura 8 horas</li>
              <li className="flex items-center gap-2 sm:col-span-2"><Lock className="w-4 h-4" aria-hidden />Se bloquea 15 minutos tras 5 intentos fallidos</li>
            </ul>
          </div>
        )}
      </main>

      <footer className="flex flex-wrap justify-between gap-3 px-4 sm:px-8 py-3.5 text-xs sa-muted" style={{ borderTop: "1px solid var(--sa-line)" }}>
        <span>Ennea · Uso interno</span>
      </footer>
    </>
  );
}
