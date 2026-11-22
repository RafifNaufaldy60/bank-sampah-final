import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { checkSession, dismissNotice } from '../features/auth/authSlice'
import { session } from '../services/api'
import SuccessDialog from '../components/auth/SuccessDialog'

export default function RootLayout() {
  const dispatch = useDispatch()
  const { user, notice } = useSelector(state => state.auth)
  const userId = user?.id
  useEffect(() => { dispatch(checkSession()) }, [dispatch])
  useEffect(() => {
    if (!userId) return
    const expiry = Date.parse(session.read()?.expires_at)
    if (!Number.isFinite(expiry)) return
    const checkExpiry = () => { if (Date.now() >= expiry) dispatch(checkSession({ retry: true })) }
    const timer = setTimeout(checkExpiry, Math.min(Math.max(0, expiry - Date.now()) + 100, 2147483647))
    window.addEventListener('focus', checkExpiry)
    return () => { clearTimeout(timer); window.removeEventListener('focus', checkExpiry) }
  }, [dispatch, userId])
  return <><Outlet />{notice && <SuccessDialog type="login" peran={notice.peran} onClose={() => dispatch(dismissNotice())} />}</>
}
