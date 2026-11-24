import { useDispatch, useSelector } from 'react-redux'
import { logout } from '../features/auth/authSlice'
import { Link } from 'react-router-dom'

export default function AccountHome() {
  const { user, logoutStatus, logoutError } = useSelector(state => state.auth)
  const dispatch = useDispatch()
  return <main className="account-home"><h1>{user.nama}</h1><p>{user.peran === 'pengelola' ? user.is_ketua === true ? 'Ketua Pengelola' : 'Pengelola' : 'Nasabah'}</p>
    {user.peran === 'pengelola' && <p><Link to="/pengelola/ringkasan">Buka Ringkasan</Link></p>}
    {logoutError && <p role="alert" className="auth-error">{logoutError.message}</p>}
    <button className="auth-submit" disabled={logoutStatus === 'loading'} onClick={() => dispatch(logout())}>{logoutStatus === 'loading' ? 'Sedang keluar…' : 'Logout'}</button>
  </main>
}
