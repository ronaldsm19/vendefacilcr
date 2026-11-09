import type { Instrumentation } from "next";

/**
 * Fallas inesperadas que atrapa Next (una excepción sin manejar en una ruta, una página que no
 * renderiza): se guardan en el registro de errores del superadmin con el negocio y el detalle técnico.
 * Solo en Node: el registro usa la base de datos.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { recordServerError } = await import("@/server/services/errorEvents");
    const { checkErrorAlerts } = await import("@/server/services/errorAlerts");
    const error = err as { message?: string; stack?: string; digest?: string };
    await recordServerError(error, request, context);
    await checkErrorAlerts();
  } catch (e) {
    // Si el registro falla, que no tape el error original.
    console.error("[errores] no se pudo registrar la falla del servidor", e);
  }
};
