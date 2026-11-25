import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createMemoryRouter } from 'react-router-dom'
import App from '../App'
import { createAppRoutes } from '../router'
import { createAppStore } from '../app/store'
import { api, session } from '../services/api'
import { manager } from './summaryFixture'
const rows = Array.from({ length: 8 }, (_, i) => ({ setoran_id: String(100 + i), kode_setoran: `TRX-181126-${100 + i}`, nama_nasabah: `Nasabah ${i}`, kode_nasabah: `NSB-000${i}`, tanggal_setoran: '2026-11-18', jenis_sampah: 'Kardus, Botol Plastik', berat_kg: '3.250', nilai_setoran_rp: '12000', status: 'Terverifikasi' }))
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
function mount({ user = manager, data = rows, path = '/pengelola/riwayat-nasabah', handler } = {}) {
  if (user) session.write({ token: 'history-test', expires_at: '2099-01-01T00:00:00Z' })
  const get = vi.spyOn(api, 'get').mockImplementation(async (url, options) => {
    const override = await handler?.(url, options)
    if (override) return override
    if (url === '/auth/me') return { data: { data: user } }
    const params = new URL(url, 'http://test').searchParams
    const filtered = data.filter(r => [r.nama_nasabah, r.kode_nasabah, r.kode_setoran].some(v => v.includes(params.get('search') || '')))
    const page = Number(params.get('page') || 1)
    return { data: { data: filtered.slice((page - 1) * 5, page * 5), meta: { page, limit: 5, total: filtered.length, total_pages: Math.ceil(filtered.length / 5) } } }
  })
  const store = createAppStore(), router = createMemoryRouter(createAppRoutes(store), { initialEntries: [path] })
  render(<Provider store={store}><App router={router} /></Provider>)
  return { get, router, store }
}
const ready = () => screen.findByRole('table')
const input = () => screen.getByRole('searchbox')
describe('Riwayat Nasabah', () => {
  it.each([true, false])('shares history and honors chair navigation: %s', async is_ketua => {
    mount({ user: { ...manager, is_ketua } }); await ready()
    expect(screen.getByText('Nasabah 0')).toBeInTheDocument()
    expect(screen.getAllByText('Rp 12.000')).toHaveLength(5)
    expect(screen.getAllByText('3,25 kg')).toHaveLength(5)
    expect(screen.getAllByText('18 Nov 2026')).toHaveLength(5)
    expect(!!screen.queryByRole('link', { name: 'Kelola Akun Pengelola' })).toBe(is_ketua)
    expect(screen.getByRole('link', { name: 'Riwayat Nasabah' })).toHaveAttribute('aria-current', 'page')
  })
  it.each([null, { ...manager, peran: 'nasabah' }, { ...manager, aktif: false }])('blocks unauthorized users %o', async user => {
    const { get } = mount({ user })
    if (!user) await screen.findByLabelText('Email'); else await screen.findByRole('heading', { name: /403/ })
    expect(get.mock.calls.some(([url]) => url.startsWith('/setoran'))).toBe(false)
  })
  it.each(['Nasabah 7', 'NSB-0007', 'TRX-181126-107'])('searches across pages using %s', async term => {
    const { router } = mount({ path: '/pengelola/riwayat-nasabah?page=2' }); await ready()
    fireEvent.change(input(), { target: { value: term } })
    await waitFor(() => expect(screen.getByText('Menampilkan 1 dari 1 transaksi')).toBeInTheDocument())
    expect(router.state.location.search).toContain('page=1')
    expect(screen.getByText('Nasabah 7')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Hapus filter' }))
    await screen.findByText('Menampilkan 5 dari 8 transaksi')
  })
  it('paginates and resets page on period change', async () => {
    const { router, get } = mount(); await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Halaman berikutnya' }))
    await screen.findByText('Nasabah 7')
    expect(screen.getByRole('button', { name: 'Halaman 2' })).toHaveAttribute('aria-current', 'page')
    fireEvent.change(screen.getByLabelText('Periode transaksi'), { target: { value: 'bulan_ini' } })
    await waitFor(() => expect(router.state.location.search).toContain('periode=bulan_ini'))
    expect(router.state.location.search).toContain('page=1')
    expect(get.mock.calls.at(-1)[0]).toContain('periode=bulan_ini')
  })
  it('debounces and aborts an old search before it can replace new results', async () => {
    const pending = deferred(); let signal
    mount({ handler: async (url, options) => { if (url.includes('search=old')) { signal = options.signal; return await pending.promise } } }); await ready()
    fireEvent.change(input(), { target: { value: 'old' } })
    await waitFor(() => expect(signal).toBeDefined())
    fireEvent.change(input(), { target: { value: 'Nasabah 7' } })
    await screen.findByText('Menampilkan 1 dari 1 transaksi')
    expect(signal.aborted).toBe(true)
    await act(async () => pending.resolve({ data: { data: [], meta: { page: 1, total: 0, total_pages: 0, limit: 5 } } }))
    expect(screen.getByText('Nasabah 7')).toBeInTheDocument()
  })
  it('renders empty and unmatched states and disables export', async () => {
    const { router } = mount({ data: [] }); await ready()
    expect(screen.getByText('Belum ada riwayat setoran nasabah.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unduh laporan' })).toBeDisabled()
    await act(async () => router.navigate('?search=missing'))
    expect(screen.getByText(/Tidak ditemukan transaksi/)).toBeInTheDocument()
  })
  it('shows initial loading and supports retry after API failure', async () => {
    const pending = deferred(); let fail = true
    mount({ handler: async url => { if (url === '/auth/me') return await pending.promise; if (fail) throw new Error('offline') } })
    expect(screen.getByRole('status', { name: 'Memuat Riwayat Nasabah' })).toBeInTheDocument()
    await act(async () => pending.resolve({ data: { data: manager } }))
    await screen.findByRole('heading', { name: 'Halaman belum dapat dimuat' })
    fail = false; fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' })); await ready()
  })
  it.each([401,403])('handles history API %s', async status => {
    mount({ handler: async url => { if (url.startsWith('/setoran')) throw { response: { status } } } })
    if (status === 401) { await screen.findByLabelText('Email'); expect(session.read()).toBeNull() } else await screen.findByRole('heading', { name: /403/ })
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
  it('exports filters without pagination or tokens in the URL and retries download errors', async () => {
    let fail = true
    const { get } = mount({ path: '/pengelola/riwayat-nasabah?search=NSB-&periode=tahun_ini&page=2', handler: async url => { if (url.startsWith('/setoran/export')) { if (fail) throw new Error('offline'); return { data: new Blob(['xlsx']) } } } })
    const create = vi.fn(() => 'blob:test'), revoke = vi.fn()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke }))
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await ready(); fireEvent.click(screen.getByRole('button', { name: 'Unduh laporan' }))
    await screen.findByRole('alert'); fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Coba unduh lagi' }))
    await waitFor(() => expect(create).toHaveBeenCalled())
    const url = get.mock.calls.find(([url]) => url.startsWith('/setoran/export'))[0]
    expect(url).toContain('search=NSB-'); expect(url).toContain('periode=tahun_ini')
    expect(url).not.toMatch(/page=|limit=|token=/)
    await waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:test'), { timeout: 2000 })
  })
})
