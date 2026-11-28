import { useDispatch, useSelector } from 'react-redux'
import { logout } from '../features/auth/authSlice'
import { Link, NavLink, Outlet, useLocation, useNavigation } from 'react-router-dom'
import Brand from '../components/common/Brand'

import profileIcon from '../assets/balance/user.svg'
import { balancePath } from '../router/balance'
import Footer from '../components/layout/Footer'
import { footerContent } from '../data/homepageData'
import '../styles/homepage.css'
import '../styles/account-home.css'

export default function AccountLayout() {
  const { user, logoutStatus, logoutError } = useSelector(
    state => state.auth
  )
  const location = useLocation()
  const navigation = useNavigation()
  const dispatch = useDispatch()

  const showingBalance = location.pathname === balancePath
  const ProfileName = location.pathname === '/akun' ? 'h2' : 'strong'
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
            <NavLink end to="/akun">Beranda</NavLink>
            <NavLink to="/info-harga">Info Harga</NavLink>
            <NavLink to="/jadwal-layanan">Jadwal Layanan</NavLink>
            <NavLink to={balancePath}>Saldo & Riwayat</NavLink>
          </nav>

          <div className="account-user">
            {showingBalance && <img src={profileIcon} alt="" />}
            <div className="account-user-info">
              <ProfileName className="account-profile-name">{user?.nama}</ProfileName>
              {!showingBalance && <span>{roleLabel}</span>}
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
              {logoutStatus === 'loading' ? 'Sedang keluar...' : showingBalance ? 'Keluar' : 'Logout'}
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

      {navigation.location?.pathname === balancePath && navigation.location.pathname !== location.pathname && <p role="status">Memuat saldo dan riwayat…</p>}
      <Outlet />
      <Footer {...footerContent} />
    </div>
  )
}
