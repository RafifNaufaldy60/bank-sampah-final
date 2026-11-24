import { useSelector } from 'react-redux'
import { ForbiddenPage } from './RouteError'
import { isActiveManager } from '../../router/session'

// Also react to a refreshed profile while the chair page is already mounted.
export default function ChairGuard({ children }) {
  const user = useSelector(state => state.auth.user)
  const denied = useSelector(state => state.auth.chairAccessDenied)
  return !denied && isActiveManager(user) && user.is_ketua === true ? children : <ForbiddenPage />
}
