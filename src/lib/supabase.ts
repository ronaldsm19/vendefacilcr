import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Cliente servidor (con service role key — solo usar en API routes)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export const STORAGE_BUCKET = "products";

/**
 * Almacén privado, para lo que no puede quedar a la vista de cualquiera con el enlace.
 *
 * El bucket `products` es público: quien conoce la dirección abre el archivo, sin sesión. Eso
 * está bien para la foto de un plato y muy mal para el pantallazo de un SINPE o el
 * comprobante de pago de una empleada, que llevan su nombre, sus horas y su plata.
 *
 * Acá los archivos no tienen dirección pública: se entrega un enlace firmado que vence.
 */
export const PRIVATE_BUCKET = "vf-privado";

/** Días que dura un enlace firmado antes de dejar de servir. */
export const SIGNED_URL_DAYS = 7;
export const SIGNED_URL_SECONDS = SIGNED_URL_DAYS * 24 * 60 * 60;

let privateBucketReady = false;

/**
 * Crea el bucket privado la primera vez. Es idempotente y se recuerda en memoria: en
 * serverless cada instancia lo comprueba una sola vez, y si ya existe Supabase responde que
 * está duplicado, que acá no es un error.
 */
export async function ensurePrivateBucket(): Promise<void> {
  if (privateBucketReady) return;
  const { error } = await supabaseAdmin.storage.createBucket(PRIVATE_BUCKET, { public: false });
  // "already exists" es el caso normal a partir de la segunda vez.
  if (error && !/exist/i.test(error.message)) throw error;
  privateBucketReady = true;
}

/**
 * Enlace temporal para un archivo privado. Devuelve null si el archivo ya no está o si la
 * firma falla: una pantalla sin enlace es mejor que una pantalla rota.
 */
export async function signPrivateUrl(
  path: string,
  seconds = SIGNED_URL_SECONDS
): Promise<string | null> {
  if (!path) return null;
  // Los registros viejos guardaban la dirección pública completa; se devuelven tal cual.
  if (path.startsWith("http")) return path;
  try {
    await ensurePrivateBucket();
    const { data, error } = await supabaseAdmin.storage
      .from(PRIVATE_BUCKET)
      .createSignedUrl(path, seconds);
    if (error) return null;
    return data?.signedUrl ?? null;
  } catch {
    return null;
  }
}
