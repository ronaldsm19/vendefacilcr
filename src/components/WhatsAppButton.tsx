"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { SeedProduct } from "@/data/seed";

interface WhatsAppButtonProps {
  product?: SeedProduct & { _id?: string };
  floating?: boolean;
  whatsappNumber?: string;
  className?: string;
}

export function buildWhatsAppMessage(
  product?: WhatsAppButtonProps["product"],
  selectedToppings?: string[],
  finalPrice?: number,
  quantity?: number,
  itemToppings?: string[][],
  whatsappNumber?: string,
): string {
  const number = whatsappNumber ?? process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "50688888888";
  let msg: string;

  if (product) {
    const price = finalPrice ?? product.price;
    const qty   = quantity ?? 1;

    if (qty > 1 && itemToppings && itemToppings.length > 1) {
      // Multi-item order
      const offers = [...(product.offers ?? [])].sort((a, b) => a.qty - b.qty);
      const activeOffer = offers.find(o => o.qty === qty);
      const offerLabel  = activeOffer
        ? ` · Oferta ${activeOffer.qty}×₡${activeOffer.price.toLocaleString("es-CR")}`
        : "";
      const FREE_TOPPINGS = 2;
      const EXTRA_PRICE   = 150;

      const itemLines = itemToppings.map((tops, i) => {
        const extraCount = Math.max(0, tops.length - FREE_TOPPINGS);
        const extraLabel = extraCount > 0
          ? ` (+₡${(extraCount * EXTRA_PRICE).toLocaleString("es-CR")})`
          : "";
        const toppingStr = tops.length > 0 ? tops.join(", ") : "sin toppings";
        return `• ${product.name.split(" ").slice(-1)[0]} #${i + 1}: ${toppingStr}${extraLabel}`;
      });

      const lines = [
        `Hola! Me interesa hacer un pedido de *Dulce Pecado* 🍮`,
        ``,
        `*Producto:* ${product.name}`,
        `*Cantidad:* ${qty}${offerLabel}`,
        `*Total:* ₡${price.toLocaleString("es-CR")}`,
        ``,
        `*Detalle por unidad:*`,
        ...itemLines,
        ``,
        `¿Podría confirmar disponibilidad? Gracias! 😊`,
      ];
      msg = lines.join("\n");
    } else {
      // Single item order (original behavior)
      const toppingLine =
        selectedToppings && selectedToppings.length > 0
          ? `*Toppings elegidos:* ${selectedToppings.join(", ")}`
          : null;

      const lines = [
        `Hola! Me interesa hacer un pedido de *Dulce Pecado* 🍮`,
        ``,
        `*Producto:* ${product.name}`,
        `*Precio:* ₡${price.toLocaleString("es-CR")}`,
        toppingLine,
        ``,
        `¿Podría darme más información y disponibilidad? Gracias! 😊`,
      ].filter((l) => l !== null);
      msg = lines.join("\n");
    }
  } else {
    msg = `Hola! Quiero hacer un pedido 😊`;
  }

  return `https://wa.me/${number}?text=${encodeURIComponent(msg)}`;
}

// ── Inline button (used inside ProductModal) ─────────────────────
export function WhatsAppInlineButton({
  product,
  selectedToppings,
  finalPrice,
  quantity,
  itemToppings,
  whatsappNumber,
  className,
}: {
  product: WhatsAppButtonProps["product"];
  selectedToppings?: string[];
  finalPrice?: number;
  quantity?: number;
  itemToppings?: string[][];
  whatsappNumber?: string;
  className?: string;
}) {
  const url = buildWhatsAppMessage(product, selectedToppings, finalPrice, quantity, itemToppings, whatsappNumber);

  return (
    <Button
      variant="whatsapp"
      size="lg"
      className={`w-full gap-3 ${className ?? ""}`}
      onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
    >
      <WhatsAppIcon />
      Ordenar por WhatsApp
    </Button>
  );
}

// ── Floating button (fixed bottom-right) ─────────────────────────
export default function WhatsAppButton({ floating, whatsappNumber }: WhatsAppButtonProps) {
  if (!floating) return null;

  const number = whatsappNumber ?? process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "50688888888";
  const msg    = encodeURIComponent("Hola! Quiero hacer un pedido 😊");
  const url    = `https://wa.me/${number}?text=${msg}`;

  return (
    <motion.a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] text-white shadow-xl cursor-pointer"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 1.5, type: "spring", stiffness: 200 }}
      whileHover={{ scale: 1.12 }}
      whileTap={{ scale: 0.95 }}
      title="Contáctanos por WhatsApp"
    >
      <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-30" />
      <WhatsAppIcon size={26} />
    </motion.a>
  );
}

export function WhatsAppIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
