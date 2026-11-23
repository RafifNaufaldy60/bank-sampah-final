import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigation, useRevalidator } from 'react-router-dom'
import { logout } from '../features/auth/authSlice'
import { isActiveManager } from '../router/session'
import { dashboardAsset, managerMenu, menuFor } from '../components/pengelola/navigation'
import { initials } from '../components/pengelola/format'
import { ForbiddenPage } from '../components/pengelola/RouteError'
import SummarySkeleton from '../components/pengelola/SummarySkeleton'

export function PengelolaNavigation({ user, onNavigate }) {
  return <nav aria-label="Menu pengelola"><p className="nav-caption">MENU UTAMA</p>
    {menuFor(user).map(item => <NavLink key={item.path} to={`/pengelola/${item.path}`} onClick={onNavigate} className={({ isActive }) => `dashboard-nav-link${isActive ? ' active' : ''}${item.chairOnly ? ' chair-menu' : ''}`}>
      <span className="nav-icon"><img src={dashboardAsset(item.icon)} alt="" /></span><span>{item.label}</span>
    </NavLink>)}
  </nav>
}
export function DashboardHeader({ user, title, onOpen, menuButton, mobileOpen }) {
  return <header className="dashboard-header">
    <button ref={menuButton} className="dashboard-button mobile-menu-toggle" aria-label="Buka menu navigasi" aria-controls="mobile-navigation" aria-expanded={mobileOpen} onClick={onOpen}>☰</button>
    <div className="dashboard-title"><h1>{title}</h1><p>{title === 'Ringkasan Dashboard' ? 'Pantau aktivitas Bank Sampah Rahayu hari ini.' : 'Bank Sampah Rahayu Lestari'}</p></div>
    <details className="dashboard-profile"><summary><span className="profile-avatar" aria-hidden="true">{initials(user.nama)}</span><span className="profile-copy"><strong>{user.nama}</strong><span>PENGELOLA BANK SAMPAH DESA</span></span><img src={dashboardAsset('chevron')} alt="" /></summary>
      <div className="profile-details"><p>{user.nama}</p><p>{user.email}</p><Link to="/akun">Informasi akun</Link></div>
    </details>
  </header>
}
export default function PengelolaLayout() {
  const auth = useSelector(state => state.auth)
  const dispatch = useDispatch()
  const location = useLocation()
  const navigation = useNavigation()
  const revalidator = useRevalidator()
  const dialog = useRef(null)
  const menuButton = useRef(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  function closeMenu() { dialog.current?.close(); setMobileOpen(false); menuButton.current?.focus() }
  useEffect(() => { dialog.current?.close(); setMobileOpen(false) }, [location.pathname])
  useEffect(() => {
    if (mobileOpen) { dialog.current.showModal(); dialog.current.querySelector('button')?.focus() }
  }, [mobileOpen])
  const { user, logoutStatus, logoutError } = auth
  if (!user) return <Navigate to="/login" replace />
  if (!isActiveManager(user)) return <ForbiddenPage />
  const item = managerMenu.find(entry => location.pathname === `/pengelola/${entry.path}`)
  const title = item?.path === 'ringkasan' ? 'Ringkasan Dashboard' : item?.title || item?.label || 'Dashboard Pengelola'
  const pending = navigation.state !== 'idle' || revalidator.state !== 'idle'
  async function signOut() { closeMenu(); await dispatch(logout()) }
  const sidebar = <>
    <Link className="dashboard-brand" to="/pengelola/ringkasan" aria-label="Rahayu Lestari — Ringkasan" onClick={closeMenu}><img src={dashboardAsset('logo')} alt="" /><span><strong>Rahayu<span>Lestari</span></strong><small>BANK SAMPAH DESA</small></span></Link>
    <PengelolaNavigation user={user} onNavigate={closeMenu} />
    <button className="dashboard-logout" onClick={signOut} disabled={logoutStatus === 'loading'}><span className="nav-icon"><img src={dashboardAsset('logout')} alt="" /></span>{logoutStatus === 'loading' ? 'Sedang keluar…' : 'Keluar akun'}</button>
  </>
  return <div className="pengelola-layout">
    <a className="dashboard-skip" href="#dashboard-content">Lewati ke konten</a>
    <aside className="dashboard-sidebar">{sidebar}</aside>
    <dialog ref={dialog} id="mobile-navigation" className="dashboard-mobile-nav" aria-label="Navigasi pengelola" onClose={() => setMobileOpen(false)} onCancel={closeMenu}>
      {mobileOpen && <><button className="mobile-close" aria-label="Tutup menu navigasi" onClick={closeMenu}>×</button>{sidebar}</>}
    </dialog>
    <div className="dashboard-main">
      <DashboardHeader user={user} title={title} menuButton={menuButton} mobileOpen={mobileOpen} onOpen={() => setMobileOpen(true)} />
      {pending && <div role="status" className="dashboard-pending">Memuat halaman…</div>}
      <main id="dashboard-content" className="dashboard-content" tabIndex={-1} aria-busy={pending || logoutStatus === 'loading'}>
        {logoutError && <p role="alert" className="auth-error">{logoutError.message}</p>}
        {logoutStatus === 'loading' ? <SummarySkeleton /> : <Outlet />}
      </main>
    </div>
  </div>
}
