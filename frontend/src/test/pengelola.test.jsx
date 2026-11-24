import { StrictMode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createMemoryRouter } from 'react-router-dom'
import App from '../App'
import { createAppRoutes } from '../router'
import { createAppStore } from '../app/store'
import { checkSession, logout } from '../features/auth/authSlice'
import { api, session } from '../services/api'
import { rupiah, weight } from '../components/pengelola/format'
import { manager, summaryFixture } from './summaryFixture'

const response = data => ({ data: { data } })
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const failure = status => ({ response: { status, data: { error: { code: status === 401 ? 'SESI_TIDAK_VALID' : 'INTERNAL_ERROR' } } } })
function mount({ user = manager, path = '/pengelola/ringkasan', data = summaryFixture, handler } = {}) {
  if (user) session.write({ token: 'opaque-fixture', expires_at: new Date(Date.now() + 3600000).toISOString() })
  const get = vi.spyOn(api, 'get').mockImplementation(handler || (async url => url.startsWith('/pengajuan-pengelola') ? { data: { data: [], meta: { page: 1, limit: 20, total: 0, total_pages: 0 } } } : response(url === '/auth/me' ? user : data)))
  const store = createAppStore()
  const router = createMemoryRouter(createAppRoutes(store), { initialEntries: [path] })
  render(<StrictMode><Provider store={store}><App router={router} /></Provider></StrictMode>)
  return { store, router, get }
}
const ready = () => screen.findByRole('heading', { name: 'Ringkasan Dashboard' })

describe('shared pengelola dashboard', () => {
  it.each([[true, 5], [false, 4], ['true', 4]])('backend is_ketua=%s gives %s menu entries and the same summary', async (is_ketua, count) => {
    const { get } = mount({ user: { ...manager, is_ketua } })
    await ready()
    expect(within(screen.getByRole('navigation', { name: 'Menu pengelola' })).getAllByRole('link')).toHaveLength(count)
    expect(screen.getAllByText('Rp 11.725')).toHaveLength(2)
    expect(screen.getByText('12 Nasabah')).toBeInTheDocument()
    expect(screen.getByText('Nama Dari Backend', { selector: 'strong' })).toBeInTheDocument()
    expect(get.mock.calls.map(call => call[0])).toEqual(['/auth/me', '/ringkasan'])
  })
  it('does not show menus or request private data before profile completes; uses initial skeleton', async () => {
    const pending = deferred()
    const { get } = mount({ handler: async url => url === '/auth/me' ? await pending.promise : response(summaryFixture) })
    expect(screen.getByRole('status', { name: 'Memuat Ringkasan' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
    expect(get).toHaveBeenCalledTimes(1)
    await act(async () => pending.resolve(response({ ...manager, is_ketua: false })))
    await ready()
    expect(screen.queryByRole('link', { name: 'Kelola Akun Pengelola' })).not.toBeInTheDocument()
  })
  it('all placeholders share the layout, activate their menu and make no feature requests', async () => {
    const { get, router } = mount()
    await ready()
    for (const [label, title, path] of [['Catat Setoran', 'Catatan Setoran', 'catatan-setoran'], ['Kelola Jadwal', 'Kelola Jadwal', 'kelola-jadwal'], ['Riwayat Nasabah', 'Riwayat Nasabah', 'riwayat-nasabah']]) {
      fireEvent.click(within(screen.getByRole('navigation')).getByRole('link', { name: label }))
      expect(await screen.findByRole('heading', { name: title, level: 2 })).toBeInTheDocument()
      expect(screen.getByText('Halaman ini sedang dalam pengembangan.')).toBeInTheDocument()
      expect(screen.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page')
      expect(router.state.location.pathname).toBe(`/pengelola/${path}`)
    }
    expect(get.mock.calls.map(call => call[0])).toEqual(['/auth/me', '/ringkasan'])
    fireEvent.click(screen.getByRole('link', { name: 'Kembali ke Ringkasan' }))
    await ready()
    expect(screen.getByRole('link', { name: 'Ringkasan' })).toHaveAttribute('aria-current', 'page')
  })
  it('regular manager opening chair URL gets 403 without summary/approval requests', async () => {
    const { get } = mount({ user: { ...manager, is_ketua: false }, path: '/pengelola/persetujuan-akun' })
    expect(await screen.findByRole('heading', { name: /403/ })).toBeInTheDocument()
    expect(screen.queryByText('Halaman ini sedang dalam pengembangan.')).not.toBeInTheDocument()
    expect(get.mock.calls.map(call => call[0])).toEqual(['/auth/me'])
  })
  it('a refreshed profile removing chair status immediately hides the chair page', async () => {
    const { get, store } = mount({ path: '/pengelola/persetujuan-akun' })
    await screen.findByRole('heading', { name: 'Daftar Pengajuan Akun Pengelola', level: 2 })
    get.mockResolvedValue(response({ ...manager, is_ketua: false }))
    await act(async () => { await store.dispatch(checkSession({ retry: true })).unwrap() })
    expect(await screen.findByRole('heading', { name: /403/ })).toBeInTheDocument()
    expect(screen.queryByText('Halaman ini sedang dalam pengembangan.')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Kelola Akun Pengelola' })).not.toBeInTheDocument()
  })
  it('dashboard logout failure retains the token and supports successful retry', async () => {
    mount(); await ready()
    const post = vi.spyOn(api, 'post').mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response({}))
    fireEvent.click(screen.getByRole('button', { name: 'Keluar akun' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('belum mengonfirmasi pencabutan sesi')
    expect(session.read()).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Keluar akun' }))
    await screen.findByLabelText('Email')
    expect(post).toHaveBeenCalledTimes(2)
    expect(session.read()).toBeNull()
  })
  it.each([{ peran: 'nasabah' }, { status_akun: 'pending' }, { status_akun: 'ditolak' }, { aktif: false }, { aktif: 'true' }])('blocks private requests for %o', async flags => {
    const { get } = mount({ user: { ...manager, ...flags } })
    expect(await screen.findByRole('heading', { name: /403/ })).toBeInTheDocument()
    expect(get.mock.calls.map(call => call[0])).toEqual(['/auth/me'])
  })
  it('no session redirects to login without any request', async () => {
    const { get, router } = mount({ user: null })
    await screen.findByLabelText('Email')
    expect(router.state.location.pathname).toBe('/login')
    expect(get).not.toHaveBeenCalled()
  })
  it('manager index redirects to summary and direct URL refresh loads once', async () => {
    const { get, router } = mount({ path: '/pengelola' })
    await ready()
    expect(router.state.location.pathname).toBe('/pengelola/ringkasan')
    expect(get.mock.calls.map(call => call[0])).toEqual(['/auth/me', '/ringkasan'])
  })
  it('zero is valid and empty transactions and schedules are explicit', async () => {
    mount({ data: { ...summaryFixture, metrik: { ...summaryFixture.metrik, nilai_hari_ini_rp: '0', berat_hari_ini_kg: '0', transaksi_hari_ini: '0', nasabah_aktif: '0', hari_tersedia_minggu_ini: '0' }, transaksi_terbaru: [], jadwal_hari_ini: [] } })
    await ready()
    expect(screen.getByText('Rp 0')).toBeInTheDocument()
    expect(screen.getByText('0 kg')).toBeInTheDocument()
    expect(screen.getByText('Belum ada transaksi.')).toBeInTheDocument()
    expect(screen.getByText('Tidak ada jadwal hari ini.')).toBeInTheDocument()
  })
  it('summary errors retain layout, never render zeros, and retry only failed data', async () => {
    let fail = true
    const { get } = mount({ handler: async url => { if (url === '/auth/me') return response(manager); if (fail) throw failure(500); return response(summaryFixture) } })
    expect(await screen.findByRole('alert')).toHaveTextContent('Server sedang mengalami gangguan')
    expect(screen.queryByText('Rp 0')).not.toBeInTheDocument()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }))
    await screen.findByText('12 Nasabah')
    expect(get.mock.calls.map(call => call[0])).toEqual(['/auth/me', '/ringkasan', '/ringkasan'])
  })
  it('navigation pending and refresh pending are visible, with no duplicate summary fetch', async () => {
    const pending = deferred()
    const { get } = mount({ path: '/pengelola/catatan-setoran', handler: async url => url === '/auth/me' ? response(manager) : await pending.promise })
    await screen.findByRole('heading', { name: 'Catatan Setoran', level: 2 })
    fireEvent.click(screen.getByRole('link', { name: 'Ringkasan' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Memuat halaman')
    await act(async () => pending.resolve(response(summaryFixture)))
    await ready()
    const refresh = deferred()
    get.mockImplementation(async () => await refresh.promise)
    fireEvent.click(screen.getByRole('button', { name: 'Perbarui Ringkasan' }))
    expect(await screen.findByRole('button', { name: 'Memperbarui…' })).toBeDisabled()
    await act(async () => refresh.resolve(response(summaryFixture)))
    expect(await screen.findByRole('button', { name: 'Perbarui Ringkasan' })).toBeEnabled()
    expect(get).toHaveBeenCalledTimes(3)
  })
  it('expired/revoked summary session clears Redux and redirects', async () => {
    const { store } = mount({ handler: async url => { if (url === '/auth/me') return response(manager); throw failure(401) } })
    await screen.findByLabelText('Email')
    expect(store.getState().auth.user).toBeNull()
    expect(session.read()).toBeNull()
  })
  it('late summary after logout is aborted and never rendered or restored', async () => {
    const { get, store } = mount()
    await ready()
    const pending = deferred()
    let signal
    get.mockImplementation(async (_url, options) => { signal = options.signal; return await pending.promise })
    vi.spyOn(api, 'post').mockResolvedValue(response({}))
    fireEvent.click(screen.getByRole('button', { name: 'Perbarui Ringkasan' }))
    await waitFor(() => expect(signal).toBeDefined())
    await act(async () => { await store.dispatch(logout()).unwrap() })
    expect(signal.aborted).toBe(true)
    await act(async () => pending.resolve(response(summaryFixture)))
    await screen.findByLabelText('Email')
    expect(screen.queryByText('12 Nasabah')).not.toBeInTheDocument()
    expect(store.getState().auth.user).toBeNull()
  })
  it('cancels navigation without displaying an error', async () => {
    let signal
    const pending = deferred()
    const { router } = mount({ path: '/pengelola/catatan-setoran', handler: async (url, options) => { if (url === '/auth/me') return response(manager); signal = options.signal; return await pending.promise } })
    await screen.findByRole('heading', { name: 'Catatan Setoran', level: 2 })
    fireEvent.click(screen.getByRole('link', { name: 'Ringkasan' }))
    await waitFor(() => expect(signal).toBeDefined())
    await act(async () => { await router.navigate('/pengelola/kelola-jadwal') })
    expect(signal.aborted).toBe(true)
    await act(async () => pending.reject({ code: 'ERR_CANCELED' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Kelola Jadwal', level: 2 })).toBeInTheDocument()
  })
  it('mobile navigation opens, closes and returns keyboard focus', async () => {
    mount(); await ready()
    const button = screen.getByRole('button', { name: 'Buka menu navigasi' })
    fireEvent.click(button)
    const dialog = screen.getByRole('dialog', { name: 'Navigasi pengelola' })
    expect(dialog).toHaveAttribute('open')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tutup menu navigasi' }))
    expect(dialog).not.toHaveAttribute('open')
    expect(button).toHaveFocus()
  })
  it('expiry profile check hides stale private content', async () => {
    const { get, store } = mount(); await ready()
    get.mockRejectedValue(failure(401))
    await act(async () => { await store.dispatch(checkSession({ retry: true })).unwrap() })
    await screen.findByLabelText('Email')
    expect(screen.queryByRole('navigation', { name: 'Menu pengelola' })).not.toBeInTheDocument()
  })
  it('formats exact money and weight strings beyond safe integer range', () => {
    expect(rupiah('9007199254740993.25')).toBe('Rp 9.007.199.254.740.993,25')
    expect(weight('123456789012345678.125')).toBe('123.456.789.012.345.678,125 kg')
    expect(() => rupiah(undefined)).toThrow()
  })
})
