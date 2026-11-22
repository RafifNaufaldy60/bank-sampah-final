import { useDispatch, useSelector } from 'react-redux'
import { checkSession } from '../features/auth/authSlice'

export default function SessionGate({ children }) {
  const { initialized, sessionStatus, sessionError } = useSelector(state => state.auth)
  const dispatch = useDispatch()
  if (!initialized || sessionStatus === 'loading') return <main className="session-screen" role="status">Memeriksa sesi…</main>
  if (sessionStatus === 'failed') return <main className="session-screen"><p role="alert">{sessionError?.message}</p><button className="auth-submit" onClick={() => dispatch(checkSession({ retry: true }))}>Coba lagi</button></main>
  return children
}
