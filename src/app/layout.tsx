import type { Metadata } from "next";
import { Inter, Playfair_Display, Montserrat, Nunito, Lato } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Ennea | Comandas, caja y números para tu restaurante",
  description:
    "Comandas, caja, inventario y gastos en un solo lugar para restaurantes, sodas y cafeterías de Costa Rica.",
  // La campana de Ennea: SVG para los navegadores actuales, .ico para los viejos y para Google, y un
  // PNG para el ícono que guarda el iPhone (Safari no acepta SVG ahí).
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Ennea | Comandas, caja y números para tu restaurante",
    description: "Comandas, caja, inventario y gastos en un solo lugar para restaurantes de Costa Rica.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${playfair.variable} ${montserrat.variable} ${nunito.variable} ${lato.variable} scroll-smooth`}
    >
      <body className="font-sans antialiased bg-white text-brand-dark" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
