import { StrictMode } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act, renderHook } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createMemoryRouter } from 'react-router-dom'
import { createAppRoutes } from '../router'
import { summaryFixture } from './summaryFixture'
import { createAppStore, redactCredentials } from '../app/store'
import { api, session, normalizeError } from '../services/api'
import { checkSession, login, logout } from '../features/auth/authSlice'
import useLoginCountdown from '../hooks/useLoginCountdown'
import App from '../App'

const user = { id: '123', nama: 'Nama Dari Backend', email: 'uji@example.test', peran: 'pengelola', is_ketua: true, aktif: true, status_akun: 'active' }
const response = data => ({ data: { data } })
const failure = (status, code) => ({ response: { status, data: { error: { code } } } })
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const savedSession = () => session.write({ token: 'opaque-token', expires_at: new Date(Date.now() + 3600000).toISOString() })
function mount(path = '/login', store = createAppStore()) {
  const router = createMemoryRouter(createAppRoutes(store), { initialEntries: [path] })
  render(<StrictMode><Provider store={store}><App router={router} /></Provider></StrictMode>)
  return store
}
function fillLogin() {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'uji@example.test' } })
  fireEvent.change(screen.getByLabelText('Kata sandi'), { target: { value: 'Password-Test-123' } })
}
describe('authentication behavior', () => {
  it.each(['/info-harga', '/jadwal-layanan'])('redirects guests from %s before fetching page data', async path => {
    const get = vi.spyOn(api, 'get')
    mount(path)
    expect(await screen.findByLabelText('Email')).toBeVisible()
    expect(get).not.toHaveBeenCalled()
  })
  it.each([['/info-harga', 'Info Harga'], ['/jadwal-layanan', 'Jadwal Layanan']])('shows customer navigation at %s', async (path, label) => {
    savedSession()
    vi.spyOn(api, 'get').mockImplementation(async url => url === '/auth/me'
      ? response({ ...user, peran: 'nasabah', is_ketua: false })
      : { data: { data: [], meta: { total_pages: 0 } } })
    mount(path)
    expect(await screen.findByText(user.nama)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Logout' })).toBeVisible()
    expect(screen.getAllByRole('link', { name: label }).some(link => link.getAttribute('aria-current') === 'page')).toBe(true)
    expect(screen.queryByRole('link', { name: /^(Masuk|Daftar)$/i })).toBeNull()
  })
  it('single bootstrap under StrictMode, real profile/role, guest redirect without loop', async () => {
    savedSession()
    const get = vi.spyOn(api, 'get').mockImplementation(async path => response(path === '/auth/me' ? user : summaryFixture))
    mount('/register')
    expect(await screen.findByRole('heading', { name: 'Ringkasan Dashboard' })).toBeInTheDocument()
    expect(screen.getAllByText(user.nama)[0]).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Kelola Akun Pengelola' })).toBeInTheDocument()
    expect(get).toHaveBeenCalledTimes(2)
    expect(get).toHaveBeenCalledWith('/auth/me')
  })
  it('network failure on bootstrap preserves session and offers retry instead of redirect', async () => {
    savedSession()
    const get = vi.spyOn(api, 'get').mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response(user))
    mount('/akun')
    expect(await screen.findByRole('alert')).toHaveTextContent('Tidak dapat terhubung')
    expect(session.read()).not.toBeNull()
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }))
    expect(await screen.findByRole('heading', { name: user.nama })).toBeInTheDocument()
    expect(get).toHaveBeenCalledTimes(2)
  })
  it('invalid session redirects to login and clears stored token', async () => {
    savedSession(); vi.spyOn(api, 'get').mockRejectedValue(failure(401, 'SESI_TIDAK_VALID'))
    mount('/akun')
    expect(await screen.findByLabelText('Email')).toBeInTheDocument()
    expect(session.read()).toBeNull()
  })
  it('protected route with no token redirects without profile request', async () => {
    const get = vi.spyOn(api, 'get'); mount('/akun')
    expect(await screen.findByLabelText('Email')).toBeInTheDocument(); expect(get).not.toHaveBeenCalled()
  })
  it('login sends the selected role, prevents duplicate submit, and logs out', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(response(summaryFixture))
    const pending = deferred()
    const post = vi.spyOn(api, 'post').mockReturnValueOnce(pending.promise).mockResolvedValueOnce(response({ message: 'Logout berhasil.' }))
    const store = mount()
    await screen.findByLabelText('Email'); fillLogin()
    fireEvent.click(screen.getByRole('radio', { name: /Pengelola/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Tampilkan kata sandi' }))
    expect(screen.getByLabelText('Kata sandi')).toHaveAttribute('type', 'text')
    fireEvent.click(screen.getByRole('button', { name: 'Masuk sebagai Pengelola' }))
    expect(screen.getByRole('button', { name: 'Sedang masuk…' })).toBeDisabled()
    fireEvent.submit(screen.getByLabelText('Email').closest('form'))
    expect(post).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledWith('/auth/login', { email: user.email, password: 'Password-Test-123', peran: 'pengelola' })
    await act(async () => pending.resolve(response({ akun: user, token: 'opaque-token', expires_at: new Date(Date.now() + 3600000).toISOString() })))
    expect(await screen.findByRole('heading', { name: 'Ringkasan Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toHaveTextContent('akun pengelola')
    expect(JSON.stringify(store.getState())).not.toContain('Password-Test-123')
    expect(JSON.stringify(store.getState())).not.toContain('opaque-token')
    fireEvent.click(screen.getByRole('button', { name: 'Tutup pemberitahuan' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keluar akun' }))
    expect(await screen.findByLabelText('Email')).toBeInTheDocument()
    expect(session.read()).toBeNull(); expect(post).toHaveBeenLastCalledWith('/auth/logout')
  })
  it.each([['ACCOUNT_PENDING', 'menunggu persetujuan ketua'], ['ACCOUNT_REJECTED', 'ditolak'], ['NETWORK_ERROR', 'Tidak dapat terhubung'], ['TERLALU_BANYAK_PERMINTAAN', 'jaringan ini']])('shows normalized %s', async (code, text) => {
    vi.spyOn(api, 'post').mockRejectedValue(code === 'NETWORK_ERROR' ? new Error('offline') : failure(code === 'TERLALU_BANYAK_PERMINTAAN' ? 429 : 403, code))
    mount(); await screen.findByLabelText('Email'); fillLogin()
    fireEvent.click(screen.getByRole('button', { name: 'Masuk sebagai Nasabah' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(text)
    expect(screen.getByLabelText('Kata sandi')).toHaveValue('')
  })
  it('registration validates confirmation, uses peran and never logs in automatically', async () => {
    const post = vi.spyOn(api, 'post').mockResolvedValue(response({ ...user, is_ketua: false, status_akun: 'pending' }))
    const store = mount('/register'); await screen.findByLabelText('Nama lengkap')
    fireEvent.click(screen.getByRole('radio', { name: /Pengelola/ }))
    for (const [label, value] of [['Nama lengkap', 'Pendaftar'], ['Email', user.email], ['Nomor WhatsApp', '081234567890'], ['Kata sandi', 'Password-Test-123'], ['Konfirmasi kata sandi', 'mismatch']]) fireEvent.change(screen.getByLabelText(label), { target: { value } })
    fireEvent.submit(screen.getByLabelText('Email').closest('form'))
    expect(screen.getByRole('alert')).toHaveTextContent('tidak sama'); expect(post).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Konfirmasi kata sandi'), { target: { value: 'Password-Test-123' } })
    fireEvent.submit(screen.getByLabelText('Email').closest('form'))
    expect(await screen.findByRole('dialog')).toHaveTextContent('Pendaftaran berhasil. Akun Anda menunggu persetujuan ketua.')
    expect(post).toHaveBeenCalledWith('/auth/register', { nama: 'Pendaftar', email: user.email, nomor_whatsapp: '081234567890', password: 'Password-Test-123', peran: 'pengelola' })
    expect(store.getState().auth.user).toBeNull(); expect(session.read()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Lanjut ke halaman masuk' }))
    expect(await screen.findByRole('heading', { name: 'Masuk ke Akun Anda' })).toBeInTheDocument()
  })
  it('lockout is scoped to normalized email; IP limit is separate', async () => {
    vi.spyOn(api, 'post').mockRejectedValue({ response: { status: 429, data: { error: { code: 'LOGIN_LOCKED', retry_after_seconds: 900, locked_until: '2030-01-01T00:15:00Z' } } } })
    mount(); await screen.findByLabelText('Email'); fillLogin()
    fireEvent.click(screen.getByRole('button', { name: 'Masuk sebagai Nasabah' }))
    expect(await screen.findByRole('status')).toHaveTextContent('15:00')
    expect(screen.getByRole('button', { name: 'Masuk sebagai Nasabah' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'lain@example.test' } })
    expect(screen.getByRole('button', { name: 'Masuk sebagai Nasabah' })).toBeEnabled()
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'UJI@EXAMPLE.TEST' } })
    expect(screen.getByRole('button', { name: 'Masuk sebagai Nasabah' })).toBeDisabled()
  })
  it('late profile cannot resurrect a session after successful logout', async () => {
    savedSession(); const pending = deferred()
    vi.spyOn(api, 'get').mockReturnValue(pending.promise)
    vi.spyOn(api, 'post').mockResolvedValue(response({}))
    const store = createAppStore()
    const profile = store.dispatch(checkSession())
    await store.dispatch(logout()).unwrap()
    pending.resolve(response(user)); await profile
    expect(store.getState().auth.user).toBeNull(); expect(session.read()).toBeNull()
    expect(store.getState().auth.sessionStatus).toBe('succeeded')
  })
  it('failed server revocation is explicit and retains token for retry', async () => {
    savedSession(); vi.spyOn(api, 'get').mockResolvedValue(response(user))
    const post = vi.spyOn(api, 'post').mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response({}))
    mount('/akun'); await screen.findByRole('heading', { name: user.nama })
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('belum mengonfirmasi pencabutan sesi')
    expect(session.read()).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }))
    await screen.findByLabelText('Email'); expect(post).toHaveBeenCalledTimes(2)
  })
  it('credential middleware strips thunk arguments from actions', () => {
    const next = vi.fn()
    redactCredentials()(next)({ type: 'auth/login/pending', meta: { requestId: '1', arg: { password: 'secret' } } })
    expect(JSON.stringify(next.mock.calls)).not.toContain('secret')
  })
  it('late 401 from an older profile request cannot clear a newly established session', async () => {
    savedSession(); const pending = deferred()
    vi.spyOn(api, 'get').mockReturnValue(pending.promise)
    vi.spyOn(api, 'post').mockResolvedValue(response({ akun: user, token: 'new-token', expires_at: new Date(Date.now() + 3600000).toISOString() }))
    const store = createAppStore(); const profile = store.dispatch(checkSession())
    await store.dispatch(login({ email: user.email, password: 'Password-Test-123' })).unwrap()
    pending.reject(failure(401, 'SESI_TIDAK_VALID')); await profile
    expect(store.getState().auth.user).toEqual(user)
    expect(session.read().token).toBe('new-token')
  })
  it('nasabah registration succeeds without creating a frontend session', async () => {
    vi.spyOn(api, 'post').mockResolvedValue(response({ ...user, peran: 'nasabah', is_ketua: false }))
    const store = mount('/register'); await screen.findByLabelText('Nama lengkap')
    for (const [label, value] of [['Nama lengkap', 'Nasabah'], ['Email', user.email], ['Kata sandi', 'Password-Test-123'], ['Konfirmasi kata sandi', 'Password-Test-123']]) fireEvent.change(screen.getByLabelText(label), { target: { value } })
    fireEvent.submit(screen.getByLabelText('Email').closest('form'))
    expect(await screen.findByRole('dialog')).toHaveTextContent('Akun nasabah berhasil dibuat.')
    expect(store.getState().auth.user).toBeNull(); expect(session.read()).toBeNull()
  })
  it('thunk condition prevents concurrent bootstrap requests', async () => {
    savedSession(); const pending = deferred(); const get = vi.spyOn(api, 'get').mockReturnValue(pending.promise)
    const store = createAppStore(); const first = store.dispatch(checkSession()); await store.dispatch(checkSession())
    expect(get).toHaveBeenCalledTimes(1); pending.resolve(response(user)); await first
    await store.dispatch(checkSession()); expect(get).toHaveBeenCalledTimes(1)
  })
  it('countdown derives from server duration and catches up after hidden-tab delay; cleans up', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2030-01-01T00:00:00Z'))
    const normalized = normalizeError({ response: { status: 429, data: { error: { code: 'LOGIN_LOCKED', retry_after_seconds: 900, locked_until: '2029-01-01T00:00:00Z' } } } })
    const { result, unmount } = renderHook(() => useLoginCountdown(normalized.deadline))
    expect(result.current.formatted).toBe('15:00')
    act(() => { vi.setSystemTime(new Date('2030-01-01T00:10:00Z')); document.dispatchEvent(new Event('visibilitychange')) })
    expect(result.current.formatted).toBe('05:00')
    act(() => { vi.advanceTimersByTime(300000) })
    expect(result.current.seconds).toBe(0); unmount(); expect(vi.getTimerCount()).toBe(0)
  })
})
