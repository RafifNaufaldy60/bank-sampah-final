import { useSelector } from 'react-redux'
import { Navigate, Outlet } from 'react-router-dom'
import SessionGate from './SessionGate'
import { accountDestination } from '../router/session'
export default function GuestRoute() {
  const { user, logoutStatus } = useSelector(state => state.auth)
  if (logoutStatus === 'loading') return <main className="session-screen" role="status">Sedang keluar…</main>
  return <SessionGate>{user ? <Navigate to={accountDestination(user)} replace /> : <Outlet />}</SessionGate>
}
