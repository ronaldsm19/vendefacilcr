import Image from "next/image";

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("506") && digits.length >= 11) {
    return `+506 ${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  }
  return `+${digits}`;
}

export default function Footer() {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "50688888888";
  const whatsappUrl = `https://wa.me/${whatsappNumber}`;
  const displayPhone = formatPhone(whatsappNumber);

  return (
    <footer className="bg-brand-dark text-white py-16 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-12">
          {/* ── Brand ── */}
          <div>
            {/* Logo + nombre */}
            <div className="flex items-center gap-3 mb-3">
              <Image
                src="/logo.png"
                alt="Dulce Pecado logo"
                width={52}
                height={52}
                className="rounded-full"
              />
              <p className="font-brand text-2xl font-bold gradient-text">
                Dulce Pecado
              </p>
            </div>
            <p className="text-white/50 text-sm leading-relaxed">
              El placer en cada cucharada.
              <br />
              Postres artesanales.
            </p>
            {/* Social icons */}
            <div className="flex gap-3 mt-5">
              <a
                href="https://www.instagram.com/dulcepecado_mr"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-brand-pink/40 transition-colors"
              >
                <InstagramIcon />
              </a>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#25D366]/40 transition-colors"
              >
                <WhatsAppSmallIcon />
              </a>
            </div>
          </div>

          {/* ── Quick links ── */}
          <div>
            <h3 className="font-semibold text-white/80 uppercase tracking-wider text-xs mb-4">
              Navegación
            </h3>
            <ul className="space-y-2">
              {[
                { href: "#", label: "Inicio" },
                { href: "#productos", label: "Productos" },
                { href: "#nosotros", label: "Nosotros" },
              ].map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-white/50 hover:text-brand-pink transition-colors text-sm"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Contact ── */}
          <div>
            <h3 className="font-semibold text-white/80 uppercase tracking-wider text-xs mb-4">
              Contacto
            </h3>
            <ul className="space-y-2 text-sm text-white/50">
              <li>
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-[#25D366] transition-colors"
                >
                  📱 WhatsApp: {displayPhone}
                </a>
              </li>
              <li>📍 Turrialba, Cartago, Costa Rica</li>
              <li>🕐 Mar – Dom: 8am – 8pm</li>
            </ul>
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-white/30 text-xs">
            © {new Date().getFullYear()} Dulce Pecado. Todos los derechos reservados.
          </p>
          <p className="text-white/30 text-xs">
            Desarrollado por{" "}
            <a
              href="https://www.linkedin.com/in/ronald-sancho-madrigal-5303491b4"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/50 hover:text-brand-pink transition-colors underline underline-offset-2"
            >
              Ronald Sancho Madrigal
            </a>{" "}
            en Turrialba 🇨🇷
          </p>
        </div>
      </div>
    </footer>
  );
}

function InstagramIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="16"
      height="16"
      className="text-white/70"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

function WhatsAppSmallIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      width="16"
      height="16"
      className="text-white/70"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
