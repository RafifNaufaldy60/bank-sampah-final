import { useSelector } from 'react-redux'
import { Navigate, Outlet } from 'react-router-dom'
import SessionGate from './SessionGate'
export default function ProtectedRoute() {
  const user = useSelector(state => state.auth.user)
  return <SessionGate>{user ? <Outlet /> : <Navigate to="/login" replace />}</SessionGate>
}
