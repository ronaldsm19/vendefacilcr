/** El WhatsApp de VendeFácil: lo usan el landing y el panel (para pedir un cambio de plan). */

export const VENDEFACIL_WHATSAPP = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "50661266865").replace(/\D/g, "");

export function waLink(message: string): string {
  return `https://wa.me/${VENDEFACIL_WHATSAPP}?text=${encodeURIComponent(message)}`;
}
