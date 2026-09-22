import { connectToDatabase } from "@/lib/mongodb";
import { RateLimit } from "@/models/RateLimit";

// Contadores de intentos guardados en MongoDB. Antes vivían en un Map por módulo, que en
// serverless no sirve: cada instancia tiene su propia memoria y se reinicia sola, así que el
// límite se repartía entre instancias y se podía esquivar. Las claves llevan prefijo por
// limitador ("admin-ip:", "shift-pin:", ...) porque todos comparten la misma colección.
//
// Se consume el intento ANTES de verificar la credencial (sumar y comparar contra el máximo en
// una sola operación atómica). Con "primero chequear, después sumar el fallo", una ráfaga de
// intentos simultáneos pasaba entera el chequeo antes de que se sumara ninguno: 20 PINs malos
// en paralelo llegaban a compararse 16 veces con un máximo de 5. El éxito borra el contador.

const DUPLICATE_KEY = 11000;

/**
 * Registra un intento y devuelve si todavía está dentro del límite (true = puede seguir).
 * Si la ventana anterior ya venció, arranca una nueva en 1.
 */
export async function consumeAttempt(key: string, max: number, windowMs: number): Promise<boolean> {
  await connectToDatabase();
  const now = new Date();
  const active = { $gt: ["$resetAt", now] };
  const increment = () =>
    RateLimit.findOneAndUpdate(
      { key },
      [{
        $set: {
          count:   { $cond: [active, { $add: ["$count", 1] }, 1] },
          resetAt: { $cond: [active, "$resetAt", new Date(now.getTime() + windowMs)] },
        },
      }],
      { upsert: true, new: true, updatePipeline: true }
    ).select("count").lean<{ count: number }>();

  let doc: { count: number } | null;
  try {
    doc = await increment();
  } catch (err) {
    // Dos primeros intentos simultáneos con la misma clave: uno inserta y el otro choca con el
    // índice único. Al reintentar ya existe el documento y el upsert pasa a ser un update.
    if ((err as { code?: number }).code !== DUPLICATE_KEY) throw err;
    doc = await increment();
  }
  return (doc?.count ?? 1) <= max;
}

export async function clearAttempts(key: string): Promise<void> {
  await connectToDatabase();
  await RateLimit.deleteOne({ key });
}
