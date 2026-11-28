
import { useDispatch, useSelector } from 'react-redux'
import { logout } from '../features/auth/authSlice'
import { Link } from 'react-router-dom'
import Brand from '../components/common/Brand'

import heroImage from '../assets/icons/Image (Warga membawa kantong hasil pemilahan sampah).svg'
import iconNasabah from '../assets/icons/Group nasabah.svg'

import HeroSection from '../components/home/HeroSection'
import StatsSection from '../components/home/StatsSection'
import FeaturesSection from '../components/home/FeaturesSection'
import HowItWorksSection from '../components/home/HowItWorksSection'
import Footer from '../components/layout/Footer'

import {
  heroContent,
  stats,
  featuresHeading,
  featureCards,
  howItWorksContent,
  steps,
  footerContent,
} from '../data/homepageData'

import '../styles/homepage.css'
import '../styles/account-home.css'

export default function AccountHome() {
  const { user, logoutStatus, logoutError } = useSelector(
    state => state.auth
  )
  const dispatch = useDispatch()

  const roleLabel =
    user?.peran === 'pengelola'
      ? user?.is_ketua === true
        ? 'Ketua Pengelola'
        : 'Pengelola'
      : 'Nasabah'

  return (
    <div className="site-shell account-home">

      <header className="account-header">
        <div className="container account-header-inner">
          <Link to="/akun" className="brand-link">
            <Brand />
          </Link>

          <nav className="account-nav">
            <Link to="/akun" className="active">Beranda</Link>
            <Link to="/info-harga">Info Harga</Link>
            <Link to="/jadwal-layanan">Jadwal Layanan</Link>
            <Link to="/akun#riwayat">Saldo & Riwayat</Link>
          </nav>

          <div className="account-user">
            <div className="account-user-info">
              <strong>{user?.nama}</strong>
              <span>{roleLabel}</span>
            </div>

            {user?.peran === 'pengelola' && (
              <Link to="/pengelola/ringkasan" className="account-dashboard-link">
                Ringkasan
              </Link>
            )}

            <button
              className="account-logout"
              disabled={logoutStatus === 'loading'}
              onClick={() => dispatch(logout())}
            >
              {logoutStatus === 'loading' ? 'Sedang keluar...' : 'Logout'}
            </button>
          </div>
        </div>
      </header>

      {logoutError && (
        <div className="container">
          <p role="alert" className="auth-error">
            {logoutError.message}
          </p>
        </div>
      )}

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

      <Footer {...footerContent} />
    </div>
  )
}
