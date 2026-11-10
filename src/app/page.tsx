import type { Metadata } from "next";
import { vfFontVars } from "@/fonts";
import { DEFAULT_PLAN_PRICES, type PlanKey } from "@/lib/billing";
import { getListPrices } from "@/server/services/billing";
import LandingNav from "@/components/landing/LandingNav";
import LandingMotion from "@/components/landing/LandingMotion";
import Hero from "@/components/landing/Hero";
import { Problem, Service, Numbers, Goal, Compare, Start } from "@/components/landing/Sections";
import Pricing from "@/components/landing/Pricing";
import { Faq, FinalCta, LandingFooter, WhatsAppFab } from "@/components/landing/Closing";
import "./landing.css";

const TITLE = "VendeFácil | Que tu restaurante llegue a la meta del mes";
const DESCRIPTION =
  "Comandas, caja, inventario y gastos en un solo lugar para restaurantes, sodas y cafeterías de Costa Rica. Sabé cada día cuánto vendiste y cuánto te está quedando.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", locale: "es_CR" },
};

// La página es estática y se vuelve a generar cada hora: así toma los precios que estén en Cobros.
export const revalidate = 3600;

/** Precios de lista. Si la base no responde a tiempo, la página sale igual con los precios por defecto. */
async function listPrices(): Promise<Record<PlanKey, number>> {
  try {
    return await Promise.race([
      getListPrices(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("sin respuesta")), 4000)),
    ]);
  } catch {
    return DEFAULT_PLAN_PRICES;
  }
}

export default async function HomePage() {
  const prices = await listPrices();

  return (
    <div className={`lp ${vfFontVars}`}>
      <LandingNav />
      <main>
        <Hero />
        <Problem />
        <Service />
        <Numbers />
        <Goal />
        <Compare />
        <Start />
        <Pricing prices={prices} />
        <Faq />
        <FinalCta />
      </main>
      <LandingFooter />
      <WhatsAppFab />
      <LandingMotion />
    </div>
  );
}
