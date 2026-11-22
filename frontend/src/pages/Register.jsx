import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import AuthLayout from '../layouts/AuthLayout'
import RolePicker from '../components/auth/RolePicker'
import FormField from '../components/auth/FormField'
import SuccessDialog from '../components/auth/SuccessDialog'
import { register, clearFormErrors } from '../features/auth/authSlice'

export default function Register() {
  const [form, setForm] = useState({ nama: '', email: '', nomor_whatsapp: '', password: '', confirmation: '', peran: 'nasabah' })
  const [validation, setValidation] = useState('')
  const [registered, setRegistered] = useState(null)
  const { registerStatus, registerError } = useSelector(state => state.auth)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const loading = registerStatus === 'loading'
  useEffect(() => { dispatch(clearFormErrors()) }, [dispatch])
  const update = key => event => { setForm({ ...form, [key]: event.target.value }); setValidation('') }
  async function submit(event) {
    event.preventDefault()
    if (loading || registered) return
    if (!form.password.trim() || form.password.length < 10) { setValidation('Kata sandi harus berisi 10–128 karakter.'); return }
    if (form.password !== form.confirmation) { setValidation('Konfirmasi kata sandi tidak sama.'); return }
    try {
      const account = await dispatch(register({ nama: form.nama.trim(), email: form.email.trim().toLowerCase(), nomor_whatsapp: form.nomor_whatsapp.trim(), password: form.password, peran: form.peran })).unwrap()
      setForm({ ...form, password: '', confirmation: '' }); setRegistered(account.peran)
    } catch { /* Normalized error is displayed from Redux. */ }
  }
  return <AuthLayout registration><form className="auth-card auth-register-card" onSubmit={submit} aria-busy={loading}>
    <RolePicker registration value={form.peran} onChange={peran => setForm({ ...form, peran })} disabled={loading} />
    <div className="auth-fields">
      <FormField id="nama" label="Nama lengkap" autoComplete="name" required pattern=".*\S.*" maxLength={100} placeholder="Masukkan nama lengkap" value={form.nama} onChange={update('nama')} disabled={loading} />
      <FormField id="email" label="Email" type="email" autoComplete="email" required maxLength={254} placeholder="emailnasabah@gmail.com" value={form.email} onChange={update('email')} disabled={loading} />
      <FormField id="whatsapp" label="Nomor WhatsApp" type="tel" autoComplete="tel" pattern="\+?[0-9]{8,15}" maxLength={16} placeholder="081234567890" title="8–15 digit, boleh diawali +" value={form.nomor_whatsapp} onChange={update('nomor_whatsapp')} disabled={loading} />
      <FormField id="password" label="Kata sandi" type="password" autoComplete="new-password" required minLength={10} maxLength={128} placeholder="Minimal 10 karakter" value={form.password} onChange={update('password')} disabled={loading} />
      <FormField id="confirmation" label="Konfirmasi kata sandi" type="password" autoComplete="new-password" required maxLength={128} placeholder="Ulangi kata sandi" value={form.confirmation} onChange={update('confirmation')} disabled={loading} />
    </div>
    {(validation || registerError) && <p className="auth-error" role="alert">{validation || registerError.message}</p>}
    <button className="auth-submit" disabled={loading || Boolean(registered)}>{loading ? 'Sedang mendaftar…' : `Daftar sebagai ${form.peran === 'nasabah' ? 'Nasabah' : 'Pengelola'}`}</button>
  </form>{registered && <SuccessDialog type="register" peran={registered} onClose={() => navigate('/login', { replace: true })} />}</AuthLayout>
}
