"use client";

interface AboutSectionProps {
  aboutData?: {
    title: string;
    paragraph1: string;
    paragraph2: string;
    images: string[];
  };
  whatsappNumber?: string;
}

const DEFAULT_IMAGES = [
  "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&q=80&fit=crop",
  "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?w=400&q=80&fit=crop",
  "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=400&q=80&fit=crop",
  "https://images.unsplash.com/photo-1560008581-09826d1de69e?w=400&q=80&fit=crop",
];

export default function AboutSection({ aboutData, whatsappNumber }: AboutSectionProps) {
  const title = aboutData?.title || "";
  const paragraph1 = aboutData?.paragraph1 || "";
  const paragraph2 = aboutData?.paragraph2 || "";
  const images = (aboutData?.images?.length ? aboutData.images : DEFAULT_IMAGES).map(
    (url, i) => ({ img: url || DEFAULT_IMAGES[i], rotate: ["-2deg", "2deg", "1.5deg", "-1.5deg"][i] })
  );

  const waNumber = whatsappNumber ?? process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "50688888888";
  const specialOrderMsg = encodeURIComponent(
    `Hola! Me interesa hacer un pedido especial 🎉\n\n¿Podrías darme más información sobre opciones y disponibilidad? Gracias! 😊`
  );
  const specialOrderUrl = `https://wa.me/${waNumber}?text=${specialOrderMsg}`;

  return (
    <section id="nosotros" className="py-24 px-6 bg-surface overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* ── Text side ── */}
          <div>
            <span className="text-sm font-semibold text-brand-pink uppercase tracking-widest">
              Nuestra historia
            </span>
            <h2 className="font-brand text-4xl md:text-5xl font-bold text-brand-dark mt-3 mb-6 leading-tight">
              {title}
            </h2>
            <div className="space-y-4 text-brand-dark/65 leading-relaxed">
              <p>{paragraph1}</p>
              <p>{paragraph2}</p>
            </div>
          </div>

          {/* ── Visual side ── */}
          <div className="relative">
            {/* Background blob */}
            <div className="absolute inset-0 gradient-bg rounded-3xl opacity-10 blur-2xl scale-110" />

            {/* Decorative grid */}
            <div className="relative grid grid-cols-2 gap-4">
              {images.map((item, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-2xl overflow-hidden shadow-lg card-shadow"
                  style={{ transform: `rotate(${item.rotate})` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.img}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Feature cards ── */}
        <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="text-center p-6 rounded-2xl bg-surface-alt/70 border border-brand-pink/10">
            <span className="text-4xl">✨</span>
            <p className="font-brand text-xl font-bold text-brand-dark mt-3">
              Hecho con amor
            </p>
            <p className="text-sm text-brand-dark/50 mt-1">
              Cada producto elaborado con dedicación
            </p>
          </div>

          <div className="text-center p-6 rounded-2xl bg-surface-alt/70 border border-brand-pink/10">
            <span className="text-4xl">🚗</span>
            <p className="font-brand text-xl font-bold text-brand-dark mt-3">
              Entregas disponibles
            </p>
            <p className="text-sm text-brand-dark/50 mt-1">
              Coordinamos la entrega por WhatsApp
            </p>
          </div>

          <a
            href={specialOrderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-center p-6 rounded-2xl bg-surface-alt/70 border border-brand-pink/10 hover:border-brand-pink/40 hover:bg-brand-pink/5 transition-all cursor-pointer group"
          >
            <span className="text-4xl">🎁</span>
            <p className="font-brand text-xl font-bold text-brand-dark mt-3 group-hover:text-brand-pink transition-colors">
              Pedidos especiales
            </p>
            <p className="text-sm text-brand-dark/50 mt-1">
              Personalizamos para tu evento
            </p>
            <p className="text-xs text-brand-pink/70 mt-2 font-medium">
              Consultar por WhatsApp →
            </p>
          </a>
        </div>
      </div>

    </section>
  );
}
