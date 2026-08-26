'use client';

import { CampaignSection } from './components/CampaignSection';
import { ConceptSection } from './components/ConceptSection';
import { DemoSection } from './components/DemoSection';
import { FaqSection } from './components/FaqSection';
import { FooterCta } from './components/FooterCta';
import { HeroSection } from './components/HeroSection';
import { LandingHeader } from './components/LandingHeader';
import { PosSection } from './components/PosSection';
import { PricingSection } from './components/PricingSection';
import { ProductPillarsSection } from './components/ProductPillarsSection';
import { SmoothScrollProvider } from './components/SmoothScroll';

export default function LandingPage() {
  return (
    <SmoothScrollProvider>
      <div className="min-h-screen bg-[var(--onda-bg)] text-[var(--onda-ink)]">
        <LandingHeader />
        <main>
          <HeroSection />
          <ProductPillarsSection />
          <DemoSection />
          <ConceptSection />
          <PosSection />
          <CampaignSection />
          <PricingSection />
          <FaqSection />
        </main>
        <FooterCta />
      </div>
    </SmoothScrollProvider>
  );
}
