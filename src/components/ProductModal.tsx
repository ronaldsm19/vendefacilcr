"use client";

import { useState, useEffect } from "react";
import { X, ZoomIn, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { WhatsAppInlineButton } from "@/components/WhatsAppButton";
import ProductImageCarousel from "@/components/ProductImageCarousel";
import { SeedProduct } from "@/data/seed";

interface ProductModalProps {
  product: SeedProduct & { _id?: string };
  isOpen: boolean;
  onClose: () => void;
  whatsappNumber?: string;
}

const FREE_TOPPINGS = 2;
const EXTRA_TOPPING_PRICE = 150;

const categoryLabels: Record<string, { label: string; color: string }> = {
  gelatina: {
    label: "Gelatina Mosaico",
    color: "bg-brand-pink/10 text-brand-pink border-brand-pink/20",
  },
  apretado: {
    label: "Apretado Gourmet",
    color: "bg-brand-orange/10 text-brand-orange border-brand-orange/20",
  },
  especial: {
    label: "Edición Especial",
    color: "bg-brand-yellow/20 text-amber-700 border-brand-yellow/30",
  },
};

export default function ProductModal({ product, isOpen, onClose, whatsappNumber }: ProductModalProps) {
  const cat = categoryLabels[product.category] ?? categoryLabels.especial;

  const [quantity, setQuantity]         = useState(1);
  const [itemToppings, setItemToppings] = useState<string[][]>([[]]); // toppings per item
  const [openItemIdx, setOpenItemIdx]   = useState<number | null>(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const allImages = [product.image, ...(product.images ?? [])];

  // Reset when product changes
  useEffect(() => {
    setQuantity(1);
    setItemToppings([[]]);
    setOpenItemIdx(0);
    setCurrentImageIndex(0);
  }, [product._id]);

  function setQty(newQty: number) {
    const q = Math.max(1, newQty);
    setQuantity(q);
    setItemToppings(prev => {
      const next = [...prev];
      while (next.length < q) next.push([]);
      return next.slice(0, q);
    });
  }

  function toggleTopping(topping: string) {
    setItemToppings(prev => {
      const tops = prev[0] ?? [];
      const next = [...prev];
      next[0] = tops.includes(topping)
        ? tops.filter(t => t !== topping)
        : [...tops, topping];
      return next;
    });
  }

  // Offers
  const sortedOffers = [...(product.offers ?? [])].sort((a, b) => a.qty - b.qty);
  const activeOffer  = sortedOffers.find(o => o.qty === quantity) ?? null;
  const basePrice    = activeOffer ? activeOffer.price : product.price * quantity;
  const regularPrice = product.price * quantity;
  const savings      = regularPrice - basePrice;
  const extraToppingsCount = itemToppings.reduce(
    (sum, tops) => sum + Math.max(0, tops.length - FREE_TOPPINGS), 0
  );
  const finalPrice = basePrice + extraToppingsCount * EXTRA_TOPPING_PRICE;

  // Alias for qty=1 compatibility with WhatsAppInlineButton
  const selectedToppings = itemToppings[0] ?? [];

  // Short product name for accordion labels (last word of name)
  const shortName = product.name.split(" ").slice(-1)[0];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="p-0 gap-0">
        {/* ── Product image / carousel ── */}
        <div
          className="relative w-full h-80 overflow-hidden rounded-t-2xl cursor-zoom-in group bg-brand-muted/30"
          onClick={() => setLightboxOpen(true)}
        >
          <ProductImageCarousel
            images={allImages}
            alt={product.name}
            className="object-contain transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 512px"
            showArrows={allImages.length > 1}
            onCurrentChange={setCurrentImageIndex}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="bg-black/40 rounded-full p-3">
              <ZoomIn className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        {/* ── Lightbox ── */}
        {lightboxOpen && (
          <div
            className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4"
            onClick={() => setLightboxOpen(false)}
          >
            <button
              className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 rounded-full p-2.5 transition-colors z-10"
              onClick={(e) => { e.stopPropagation(); setLightboxOpen(false); }}
            >
              <X className="w-6 h-6 text-white" />
            </button>
            {allImages.length > 1 && (
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full p-3 transition-all z-10 shadow-lg"
                style={{ background: "linear-gradient(135deg, #f472b6, #fb923c)" }}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length);
                }}
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={allImages[currentImageIndex] ?? product.image}
              alt={product.name}
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            {allImages.length > 1 && (
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full p-3 transition-all z-10 shadow-lg"
                style={{ background: "linear-gradient(135deg, #f472b6, #fb923c)" }}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentImageIndex((prev) => (prev + 1) % allImages.length);
                }}
              >
                <ChevronRight className="w-6 h-6 text-white" />
              </button>
            )}
            {allImages.length > 1 && (
              <p className="absolute bottom-6 text-white/50 text-xs">
                {currentImageIndex + 1} / {allImages.length}
              </p>
            )}
          </div>
        )}

        {/* ── Content ── */}
        <div className="px-6 pb-6 pt-4 space-y-4">
          <DialogHeader className="p-0">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border w-fit ${cat.color}`}>
              {cat.label}
            </span>
            <DialogTitle className="mt-2 leading-tight">{product.name}</DialogTitle>

            {/* Price + qty stepper */}
            <div className="flex items-center justify-between mt-1">
              <div>
                <p className="text-3xl font-bold gradient-text font-brand">
                  ₡{finalPrice.toLocaleString("es-CR")}
                </p>
                {activeOffer && savings > 0 && (
                  <p className="text-xs text-emerald-600 font-medium mt-0.5">
                    Oferta {activeOffer.qty}×₡{activeOffer.price.toLocaleString("es-CR")}
                    {" · "}Ahorras ₡{savings.toLocaleString("es-CR")}
                  </p>
                )}
                {extraToppingsCount > 0 && (
                  <p className="text-xs text-brand-pink/80 mt-0.5">
                    +₡{(extraToppingsCount * EXTRA_TOPPING_PRICE).toLocaleString("es-CR")} toppings extra
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQty(quantity - 1)}
                  disabled={quantity <= 1}
                  className="w-8 h-8 rounded-full border border-brand-muted flex items-center justify-center hover:border-brand-pink transition-colors text-brand-dark font-bold text-lg disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  −
                </button>
                <span className="w-6 text-center font-bold text-brand-dark">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQty(quantity + 1)}
                  className="w-8 h-8 rounded-full border border-brand-muted flex items-center justify-center hover:border-brand-pink transition-colors text-brand-dark font-bold text-lg"
                >
                  +
                </button>
              </div>
            </div>
          </DialogHeader>

          {/* ── Offer badges ── */}
          {sortedOffers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {sortedOffers.map(o => {
                const isActive = quantity === o.qty;
                const reg = product.price * o.qty;
                return (
                  <button
                    key={o.qty}
                    type="button"
                    onClick={() => setQty(o.qty)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      isActive
                        ? "bg-emerald-500 text-white border-emerald-500"
                        : "bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                    }`}
                  >
                    {o.qty}× · ₡{o.price.toLocaleString("es-CR")}
                    {reg > o.price && (
                      <span className={`ml-1 line-through text-[10px] ${isActive ? "text-white/60" : "text-brand-dark/30"}`}>
                        ₡{reg.toLocaleString("es-CR")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <DialogDescription className="text-sm leading-relaxed text-brand-dark/70">
            {product.description}
          </DialogDescription>

          {/* ── Delivery info ── */}
          <div className={`rounded-xl p-4 text-sm ${
            product.delivery
              ? "bg-emerald-50 border border-emerald-200"
              : "bg-brand-muted/40 border border-brand-muted"
          }`}>
            {product.delivery ? (
              <>
                <p className="font-semibold text-emerald-700 mb-1">🚗 Envío disponible</p>
                {product.deliveryNote && (
                  <p className="text-emerald-600/80 whitespace-pre-line">{product.deliveryNote}</p>
                )}
                <p className="text-emerald-600/70 text-xs mt-1">Costo adicional según distancia</p>
              </>
            ) : (
              <p className="text-brand-dark/60">
                🏪 <span className="font-medium">Solo retiro</span> — Sin envío disponible para este producto
              </p>
            )}
          </div>

          {/* ── Toppings (qty = 1) ── */}
          {quantity === 1 && product.toppings.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-sm font-semibold text-brand-dark">Elige tus toppings</h4>
                <span className="text-xs text-brand-dark/50">
                  {selectedToppings.length} seleccionado{selectedToppings.length !== 1 ? "s" : ""}
                </span>
              </div>
              <p className="text-xs text-brand-dark/50 mb-3">
                Incluye hasta {FREE_TOPPINGS} toppings · Topping adicional: ₡{EXTRA_TOPPING_PRICE.toLocaleString("es-CR")} c/u
              </p>
              <div className="flex flex-wrap gap-2">
                {product.toppings.map((topping) => {
                  const selected = selectedToppings.includes(topping);
                  return (
                    <button
                      key={topping}
                      type="button"
                      onClick={() => toggleTopping(topping)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        selected
                          ? "bg-brand-pink text-white border-brand-pink"
                          : "bg-brand-muted text-brand-dark/80 border-brand-pink/20 hover:border-brand-pink/50"
                      }`}
                    >
                      {topping}
                    </button>
                  );
                })}
              </div>
              {selectedToppings.length > FREE_TOPPINGS && (
                <p className="mt-2 text-xs text-brand-pink font-medium">
                  {selectedToppings.length - FREE_TOPPINGS} topping{selectedToppings.length - FREE_TOPPINGS !== 1 ? "s" : ""} extra
                  {" · "}+₡{((selectedToppings.length - FREE_TOPPINGS) * EXTRA_TOPPING_PRICE).toLocaleString("es-CR")}
                </p>
              )}
            </div>
          )}

          {/* ── Per-item toppings accordion (qty > 1) ── */}
          {quantity > 1 && product.toppings.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-brand-dark/60 uppercase tracking-wide">
                Personaliza cada unidad
              </p>
              {Array.from({ length: quantity }, (_, i) => (
                <div key={i} className="border border-brand-muted rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenItemIdx(openItemIdx === i ? null : i)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-brand-muted/30 transition-colors"
                  >
                    <span className="text-sm font-medium text-brand-dark">
                      {shortName} #{i + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      {(itemToppings[i]?.length ?? 0) > 0 && (
                        <span className="text-xs text-brand-pink/80">
                          {itemToppings[i].length} topping{itemToppings[i].length !== 1 ? "s" : ""}
                          {itemToppings[i].length > FREE_TOPPINGS && (
                            <span className="text-brand-pink font-semibold">
                              {" "}(+₡{((itemToppings[i].length - FREE_TOPPINGS) * EXTRA_TOPPING_PRICE).toLocaleString("es-CR")})
                            </span>
                          )}
                        </span>
                      )}
                      <ChevronDown className={`w-4 h-4 text-brand-dark/40 transition-transform duration-200 ${openItemIdx === i ? "rotate-180" : ""}`} />
                    </div>
                  </button>
                  {openItemIdx === i && (
                    <div className="px-4 pb-4 pt-1 border-t border-brand-muted/60">
                      <p className="text-xs text-brand-dark/50 mb-2">
                        Incluye hasta {FREE_TOPPINGS} toppings · Extra: ₡{EXTRA_TOPPING_PRICE.toLocaleString("es-CR")} c/u
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {product.toppings.map(topping => {
                          const selected = itemToppings[i]?.includes(topping) ?? false;
                          return (
                            <button
                              key={topping}
                              type="button"
                              onClick={() => setItemToppings(prev => {
                                const next = prev.map(arr => [...arr]);
                                next[i] = selected
                                  ? next[i].filter(t => t !== topping)
                                  : [...(next[i] ?? []), topping];
                                return next;
                              })}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                selected
                                  ? "bg-brand-pink text-white border-brand-pink"
                                  : "bg-brand-muted text-brand-dark/80 border-brand-pink/20 hover:border-brand-pink/50"
                              }`}
                            >
                              {topping}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── WhatsApp CTA ── */}
          <div className="pt-2">
            <WhatsAppInlineButton
              product={product}
              selectedToppings={selectedToppings}
              finalPrice={finalPrice}
              quantity={quantity}
              itemToppings={itemToppings}
              whatsappNumber={whatsappNumber}
            />
            <p className="text-center text-xs text-brand-dark/40 mt-2">
              Te redirigiremos a WhatsApp con tu pedido listo 💬
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
