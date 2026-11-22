import heroImage from '../assets/icons/Image (Warga membawa kantong hasil pemilahan sampah).svg'
import iconNasabah from '../assets/icons/Group nasabah.svg'
import Header from '../components/layout/Header'
import Footer from '../components/layout/Footer'
import HeroSection from '../components/home/HeroSection'
import StatsSection from '../components/home/StatsSection'
import FeaturesSection from '../components/home/FeaturesSection'
import HowItWorksSection from '../components/home/HowItWorksSection'
import {
  headerNavigation,
  headerActions,
  heroContent,
  stats,
  featuresHeading,
  featureCards,
  howItWorksContent,
  steps,
  footerContent,
} from '../data/homepageData'
import '../styles/homepage.css'

function HomePage() {
  return (
    <div className="site-shell">
      <Header navigation={headerNavigation} actions={headerActions} />

      <main>
        <HeroSection
          content={heroContent}
          heroImage={heroImage}
          activeCustomerIcon={iconNasabah}
        />
        <StatsSection stats={stats} />
        <FeaturesSection heading={featuresHeading} features={featureCards} />
        <HowItWorksSection content={howItWorksContent} steps={steps} />
      </main>

      <Footer {...footerContent} />
    </div>
  )
}

export default HomePage
