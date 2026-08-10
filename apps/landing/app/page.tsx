'use client';

import { CampaignSection } from './components/CampaignSection';
import { ChannelsSection } from './components/ChannelsSection';
import { ConceptSection } from './components/ConceptSection';
import { DemoSection } from './components/DemoSection';
import { FooterCta } from './components/FooterCta';
import { HeroSection } from './components/HeroSection';
import { LandingHeader } from './components/LandingHeader';
import { PricingCards } from './components/PricingCards';
import { PricingConfigurator } from './components/PricingConfigurator';
import { StatsBar } from './components/StatsBar';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--onda-bg)] text-[var(--onda-ink)]">
      <LandingHeader />
      <main>
        <HeroSection />
        <StatsBar />
        <DemoSection />
        <ConceptSection />
        <CampaignSection />
        <ChannelsSection />
        <PricingCards />
        <PricingConfigurator />
      </main>
      <FooterCta />
    </div>
  );
}
