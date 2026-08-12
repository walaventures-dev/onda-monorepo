'use client';

import { CampaignSection } from './components/CampaignSection';
import { ConceptSection } from './components/ConceptSection';
import { DemoSection } from './components/DemoSection';
import { FaqSection } from './components/FaqSection';
import { FooterCta } from './components/FooterCta';
import { HeroSection } from './components/HeroSection';
import { LandingHeader } from './components/LandingHeader';
import { PricingSection } from './components/PricingSection';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--onda-bg)] text-[var(--onda-ink)]">
      <LandingHeader />
      <main>
        <HeroSection />
        <DemoSection />
        <ConceptSection />
        <CampaignSection />
        <PricingSection />
        <FaqSection />
      </main>
      <FooterCta />
    </div>
  );
}
