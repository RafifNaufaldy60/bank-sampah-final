import heroImage from '../assets/icons/Image (Warga membawa kantong hasil pemilahan sampah).svg'
import iconNasabah from '../assets/icons/Group nasabah.svg'

import HeroSection from '../components/home/HeroSection'
import StatsSection from '../components/home/StatsSection'
import FeaturesSection from '../components/home/FeaturesSection'
import HowItWorksSection from '../components/home/HowItWorksSection'

import {
  heroContent,
  stats,
  featuresHeading,
  featureCards,
  howItWorksContent,
  steps,
} from '../data/homepageData'

export default function AccountHome() {
  return (
    <main>
      <HeroSection
        content={heroContent}
        heroImage={heroImage}
        activeCustomerIcon={iconNasabah}
      />

      <StatsSection stats={stats} />

      <FeaturesSection
        heading={featuresHeading}
        features={featureCards}
      />

      <HowItWorksSection
        content={howItWorksContent}
        steps={steps}
      />
    </main>
  )
}
