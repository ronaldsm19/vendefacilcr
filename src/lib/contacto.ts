/**
 * El WhatsApp de Ennea (+506 6126-6865): lo usan el landing, el panel (para pedir un cambio de plan) y
 * las tiendas que no tienen número propio. Va fijo en el código, sin variable de entorno, para que
 * haya un solo lugar donde cambiarlo.
 */
export const ENNEA_WHATSAPP = "50661266865";

/**
 * El correo de Ennea: a donde llegan las respuestas a los correos que manda el sistema (salen desde
 * hola@enneacr.com, que no tiene buzón). Se puede cambiar sin tocar el código con SMTP_REPLY_TO.
 */
export const ENNEA_EMAIL = "enneacr26@gmail.com";

export function waLink(message: string): string {
  return `https://wa.me/${ENNEA_WHATSAPP}?text=${encodeURIComponent(message)}`;
}
