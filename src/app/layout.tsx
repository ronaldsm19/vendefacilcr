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
  title: "VendeFácil | Tu tienda online lista para vender",
  description:
    "Creá tu página de ventas profesional en minutos. Vendé por WhatsApp e Instagram como un negocio establecido. Para emprendedores costarricenses.",
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "VendeFácil | Tu tienda online lista para vender",
    description: "Creá tu página de ventas profesional en minutos. Para emprendedores costarricenses.",
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
