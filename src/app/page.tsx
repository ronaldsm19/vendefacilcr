import SaasNavbar from "@/components/saas/SaasNavbar";
import HeroSection from "@/components/saas/HeroSection";
import ProblemSection from "@/components/saas/ProblemSection";
import SolutionSection from "@/components/saas/SolutionSection";
import HowItWorks from "@/components/saas/HowItWorks";
import FeaturesSection from "@/components/saas/FeaturesSection";
import AdminPreviewSection from "@/components/saas/AdminPreviewSection";
import BenefitsSection from "@/components/saas/BenefitsSection";
import PricingSection from "@/components/saas/PricingSection";
import FAQSection from "@/components/saas/FAQSection";
import CTASection from "@/components/saas/CTASection";
import SaasFooter from "@/components/saas/SaasFooter";
import WhatsAppFloatingButton from "@/components/saas/WhatsAppFloatingButton";

export default function HomePage() {
  return (
    <main>
      <SaasNavbar />
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <HowItWorks />
      <FeaturesSection />
      <AdminPreviewSection />
      <BenefitsSection />
      <PricingSection />
      <FAQSection />
      <CTASection />
      <SaasFooter />
      <WhatsAppFloatingButton />
    </main>
  );
}
