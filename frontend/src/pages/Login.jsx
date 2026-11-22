import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import AuthLayout from '../layouts/AuthLayout'
import RolePicker from '../components/auth/RolePicker'
import FormField from '../components/auth/FormField'
import { login, clearFormErrors } from '../features/auth/authSlice'
import useLoginCountdown from '../hooks/useLoginCountdown'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [peran, setPeran] = useState('nasabah')
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { loginStatus, loginError, locks } = useSelector(state => state.auth)
  const normalizedEmail = email.trim().toLowerCase()
  const { seconds, formatted } = useLoginCountdown(locks[normalizedEmail])
  const loading = loginStatus === 'loading'
  const error = loginError?.email === normalizedEmail && loginError.code !== 'LOGIN_LOCKED' ? loginError : null
  useEffect(() => { dispatch(clearFormErrors()) }, [dispatch])
  async function submit(event) {
    event.preventDefault()
    if (loading || seconds) return
    try { await dispatch(login({ email, password })).unwrap(); setPassword(''); navigate('/akun', { replace: true }) }
    catch { setPassword('') }
  }
  return <AuthLayout><form className="auth-card auth-login-card" onSubmit={submit} aria-busy={loading}>
    <RolePicker value={peran} onChange={setPeran} disabled={loading} />
    <div className="auth-fields">
      <FormField id="email" label="Email" type="email" autoComplete="username" required maxLength={254} placeholder="emailnasabah@gmail.com" value={email} onChange={event => setEmail(event.target.value)} disabled={loading} />
      <FormField id="password" label="Kata sandi" type="password" autoComplete="current-password" required maxLength={128} placeholder="Masukkan kata sandi" value={password} onChange={event => setPassword(event.target.value)} disabled={loading} />
    </div>
    {seconds > 0 && <p className="auth-error" role="status">Terlalu banyak percobaan login yang gagal. Silakan coba lagi dalam <span aria-live="off">{formatted}</span>.</p>}
    {error && <p className="auth-error" role="alert">{error.message}</p>}
    <button className="auth-submit" disabled={loading || seconds > 0}>{loading ? 'Sedang masuk…' : `Masuk sebagai ${peran === 'nasabah' ? 'Nasabah' : 'Pengelola'}`}</button>
  </form></AuthLayout>
}
