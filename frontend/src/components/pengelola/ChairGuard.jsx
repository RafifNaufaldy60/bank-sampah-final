import { useSelector } from 'react-redux'
import { ForbiddenPage } from './RouteError'
import { isActiveManager } from '../../router/session'

// Also react to a refreshed profile while the chair page is already mounted.
export default function ChairGuard({ children }) {
  const user = useSelector(state => state.auth.user)
  return isActiveManager(user) && user.is_ketua === true ? children : <ForbiddenPage />
}
