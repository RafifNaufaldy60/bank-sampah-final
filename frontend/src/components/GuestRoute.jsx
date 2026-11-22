import { useSelector } from 'react-redux'
import { Navigate, Outlet } from 'react-router-dom'
import SessionGate from './SessionGate'
export default function GuestRoute() {
  const user = useSelector(state => state.auth.user)
  return <SessionGate>{user ? <Navigate to="/akun" replace /> : <Outlet />}</SessionGate>
}
