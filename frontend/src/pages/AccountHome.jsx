import { useDispatch, useSelector } from 'react-redux'
import { logout } from '../features/auth/authSlice'

export default function AccountHome() {
  const { user, logoutStatus, logoutError } = useSelector(state => state.auth)
  const dispatch = useDispatch()
  return <main className="account-home"><h1>{user.nama}</h1><p>{user.peran === 'pengelola' ? user.is_ketua ? 'Ketua Pengelola' : 'Pengelola' : 'Nasabah'}</p>
    {logoutError && <p role="alert" className="auth-error">{logoutError.message}</p>}
    <button className="auth-submit" disabled={logoutStatus === 'loading'} onClick={() => dispatch(logout())}>{logoutStatus === 'loading' ? 'Sedang keluar…' : 'Logout'}</button>
  </main>
}
