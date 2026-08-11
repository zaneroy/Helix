import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import TrustedLogos from "@/components/TrustedLogos";
import FeaturesTestimonials from "@/components/FeaturesTestimonials";
import Pricing from "@/components/Pricing";
import ProcessFAQCTA from "@/components/ProcessFAQCTA";

export default function Home() {
  return (
    <main className="helix-landing">
      <Navbar />
      <Hero />
      <TrustedLogos />
      <FeaturesTestimonials />
      <Pricing />
      <ProcessFAQCTA />
    </main>
  );
}
