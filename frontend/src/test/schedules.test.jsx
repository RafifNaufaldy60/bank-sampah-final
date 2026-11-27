import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createMemoryRouter } from 'react-router-dom'
import App from '../App'
import { createAppRoutes } from '../router'
import { createAppStore } from '../app/store'
import { api, session } from '../services/api'
import { manager } from './summaryFixture'
import { scheduleBase, parseSchedule } from '../router/schedules'
const services = [{ kode: 'penimbangan', nama: 'Penimbangan' }, { kode: 'penjemputan', nama: 'Penjemputan' }, { kode: 'setoran_umum', nama: 'Setoran umum' }]
const row = { id: '9007199254740993', layanan_kode: 'penimbangan', nama_layanan: 'Penimbangan', tanggal: '2026-11-27', jam_mulai: '08:00:00', jam_selesai: '15:00:00', tersedia: true, catatan: 'Catatan lama', status: 'tersedia' }
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
function mount({ user = manager, path = scheduleBase, rows = [row], handler } = {}) {
  if (user) session.write({ token: 'schedule-test', expires_at: '2099-01-01T00:00:00Z' })
  vi.spyOn(api, 'get').mockResolvedValue({ data: { data: user } })
  const request = vi.spyOn(api, 'request').mockImplementation(async config => {
    const override = await handler?.(config)
    if (override) return override
    const { url, method, data } = config
    if (url === '/layanan') return { data: { data: services } }
    if (method !== 'get') return { data: { data: { ...row, ...data } } }
    if (url.startsWith('/jadwal?')) return { data: { data: rows, meta: { dari: '2026-11-23', sampai: '2026-11-29', page: Number(new URL(url, 'http://test').searchParams.get('page')), limit: 20, total: rows.length, total_pages: 1 } } }
    return { data: { data: row } }
  })
  const store = createAppStore(), router = createMemoryRouter(createAppRoutes(store), { initialEntries: [path] })
  render(<Provider store={store}><App router={router} /></Provider>)
  return { request, router, store }
}
const ready = () => screen.findByRole('region', { name: 'Daftar jadwal' })
const fill = () => {
  fireEvent.change(screen.getByLabelText('Tanggal'), { target: { value: '2026-11-27' } })
  fireEvent.change(screen.getByLabelText('Jenis layanan'), { target: { value: 'penjemputan' } })
  fireEvent.change(screen.getByLabelText('Jam layanan (WIB)'), { target: { value: '08.00–15.00' } })
}
describe('Kelola Jadwal', () => {
  it.each([true, false])('allows both managers and keeps chair navigation: %s', async is_ketua => {
    const { router } = mount({ user: { ...manager, is_ketua } }); await ready()
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    expect(!!screen.queryByRole('link', { name: 'Kelola Akun Pengelola' })).toBe(is_ketua)
    for (const path of [`${scheduleBase}/tambah`, `${scheduleBase}/${row.id}/edit`]) {
      await act(async () => router.navigate(path)); await ready()
      expect(screen.getByRole('link', { name: 'Kelola Jadwal' })).toHaveAttribute('aria-current', 'page')
      expect(screen.getByLabelText('Jenis layanan')).toBeInTheDocument()
    }
  })
  it.each([null, { ...manager, peran: 'nasabah' }, { ...manager, aktif: false }])('rejects unauthorized form access %o', async user => {
    const { request } = mount({ user, path: `${scheduleBase}/tambah` })
    if (!user) await screen.findByLabelText('Email'); else await screen.findByRole('heading', { name: /403/ })
    expect(request).not.toHaveBeenCalled()
  })
  it('creates with service code, local date and times; prevents repeated submission', async () => {
    const pending = deferred()
    const { request, router } = mount({ path: `${scheduleBase}/tambah`, handler: async config => config.method === 'post' ? await pending.promise : undefined }); await ready()
    expect(screen.getByLabelText('Jenis layanan')).toHaveValue('')
    expect(within(screen.getByLabelText('Jenis layanan')).getAllByRole('option')).toHaveLength(4)
    fill(); const save = screen.getByRole('button', { name: 'Simpan jadwal' })
    fireEvent.click(save); fireEvent.click(save)
    await waitFor(() => expect(request.mock.calls.filter(([c]) => c.method === 'post')).toHaveLength(1))
    expect(request.mock.calls.find(([c]) => c.method === 'post')[0].data).toEqual({ tanggal: '2026-11-27', layanan_kode: 'penjemputan', jam_mulai: '08:00', jam_selesai: '15:00' })
    expect(screen.getByRole('button', { name: 'Menyimpan…' })).toBeDisabled()
    await act(async () => pending.resolve({ data: { data: row } }))
    await waitFor(() => expect(router.state.location.pathname).toBe(scheduleBase))
    expect(screen.getByText('Jadwal berhasil disimpan.')).toBeInTheDocument()
    expect(router.state.location.search).toContain('dari=2026-11-27')
  })
  it('loads direct edit by bigint ID and patches the selected schedule only', async () => {
    const { request } = mount({ path: `${scheduleBase}/${row.id}/edit` }); await ready()
    expect(request.mock.calls.some(([c]) => c.url === `/jadwal/${row.id}`)).toBe(true)
    expect(screen.getByLabelText('Tanggal')).toHaveValue(row.tanggal)
    expect(screen.getByLabelText('Jenis layanan')).toHaveValue(row.layanan_kode)
    expect(screen.getByLabelText('Jam layanan (WIB)')).toHaveValue('08.00–15.00')
    fireEvent.change(screen.getByLabelText('Jam layanan (WIB)'), { target: { value: '09.00–16.00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Simpan jadwal' }))
    await waitFor(() => expect(request.mock.calls.some(([c]) => c.method === 'patch')).toBe(true))
    const mutation = request.mock.calls.find(([c]) => c.method === 'patch')[0]
    expect(mutation.url).toBe(`/jadwal/${row.id}`)
    expect(mutation.data).toEqual({ tanggal: row.tanggal, layanan_kode: row.layanan_kode, jam_mulai: '09:00', jam_selesai: '16:00' })
  })
  it('validates required fields and focuses first error without sending', async () => {
    const { request } = mount({ path: `${scheduleBase}/tambah` }); await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Simpan jadwal' }))
    expect(screen.getByLabelText('Tanggal')).toHaveFocus()
    expect(screen.getAllByRole('alert')).toHaveLength(3)
    fill(); fireEvent.change(screen.getByLabelText('Jam layanan (WIB)'), { target: { value: '15.00–08.00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Simpan jadwal' }))
    expect(screen.getByLabelText('Jam layanan (WIB)')).toHaveFocus()
    expect(request.mock.calls.every(([c]) => c.method === 'get')).toBe(true)
  })
  it('warns on unsaved navigation; cancel keeps inputs and leaving does not save', async () => {
    const { request, router } = mount({ path: `${scheduleBase}/tambah` }); await ready(); fill()
    fireEvent.click(screen.getByRole('link', { name: 'Tutup' }))
    await screen.findByRole('dialog'); fireEvent.click(screen.getByRole('button', { name: 'Batal' }))
    expect(screen.getByLabelText('Jenis layanan')).toHaveValue('penjemputan')
    fireEvent.click(screen.getByRole('link', { name: 'Tutup' })); fireEvent.click(await screen.findByRole('button', { name: 'Lanjutkan' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(scheduleBase))
    expect(request.mock.calls.every(([c]) => c.method === 'get')).toBe(true)
  })
  it('confirms status change and sends only availability without deleting', async () => {
    const { request } = mount(); await ready(); fireEvent.click(screen.getByRole('switch'))
    expect(await screen.findByRole('dialog')).toHaveTextContent('27 November 2026')
    fireEvent.click(screen.getByRole('button', { name: 'Lanjutkan' }))
    await screen.findByText('Status jadwal berhasil diperbarui.')
    expect(request.mock.calls.find(([c]) => c.method === 'patch')[0]).toMatchObject({ url: `/jadwal/${row.id}`, data: { tersedia: false } })
    expect(request.mock.calls.filter(([c]) => c.method === 'patch')).toHaveLength(1)
  })
  it('preserves input and displays backend conflict without silently closing', async () => {
    mount({ path: `${scheduleBase}/${row.id}/edit`, handler: async c => { if (c.method === 'patch') throw { response: { status: 409, data: { error: { code: 'JADWAL_TERIKAT', message: 'Jadwal sudah terikat pengajuan.' } } } } } }); await ready()
    fireEvent.change(screen.getByLabelText('Jam layanan (WIB)'), { target: { value: '09.00–16.00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Simpan jadwal' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Jadwal sudah terikat pengajuan.')
    expect(screen.getByLabelText('Jam layanan (WIB)')).toHaveValue('09.00–16.00')
    expect(screen.getByRole('button', { name: 'Simpan jadwal' })).toBeEnabled()
  })
  it('does not retry uncertain creates automatically', async () => {
    const { request } = mount({ path: `${scheduleBase}/tambah`, handler: async c => { if (c.method === 'post') throw new Error('network failure') } }); await ready(); fill()
    fireEvent.click(screen.getByRole('button', { name: 'Simpan jadwal' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Hasil belum pasti')
    expect(screen.getByRole('button', { name: 'Simpan jadwal' })).toBeDisabled()
    expect(request.mock.calls.filter(([c]) => c.method === 'post')).toHaveLength(1)
  })
  it.each([401,403,404])('handles edit endpoint status %s', async status => {
    mount({ path: `${scheduleBase}/${row.id}/edit`, handler: async c => { if (c.url === `/jadwal/${row.id}`) throw { response: { status } } } })
    if (status === 401) { await screen.findByLabelText('Email'); expect(session.read()).toBeNull() }
    else if (status === 403) await screen.findByRole('heading', { name: /403/ })
    else expect(await screen.findByRole('alert')).toHaveTextContent('Jadwal tidak ditemukan.')
    expect(screen.queryByLabelText('Tanggal')).not.toBeInTheDocument()
  })
  it('rejects invalid IDs before loading detail', async () => {
    const { request } = mount({ path: `${scheduleBase}/invalid/edit` })
    expect(await screen.findByRole('alert')).toHaveTextContent('ID jadwal tidak valid.')
    expect(request).not.toHaveBeenCalled()
  })
  it('shows initial loading, retries failed master and renders empty state', async () => {
    const pending = deferred(); let fail = true
    mount({ rows: [], handler: async c => { if (c.url === '/layanan' && fail) { await pending.promise; throw new Error('offline') } } })
    expect(screen.getByRole('status', { name: 'Memuat Kelola Jadwal' })).toBeInTheDocument()
    await act(async () => pending.resolve())
    await screen.findByRole('alert'); fail = false; fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }))
    await screen.findByText('Belum ada jadwal pada periode ini.')
  })
  it('resets page on server-side week filtering', async () => {
    const { request, router } = mount({ path: `${scheduleBase}?page=2`, handler: async c => {
      if (c.url.startsWith('/jadwal?')) return { data: { data: [row], meta: { page: Number(new URL(c.url, 'http://test').searchParams.get('page')), total: 21, total_pages: 2, limit: 20, dari: '2026-11-23', sampai: '2026-11-29' } } }
    } }); await ready()
    fireEvent.change(screen.getByLabelText('Periode jadwal'), { target: { value: '1' } })
    await waitFor(() => expect(router.state.location.search).toContain('dari='))
    expect(request.mock.calls.at(-1)[0].url).toContain('page=1')
    expect(request.mock.calls.at(-1)[0].url).toContain('sampai=')
  })
  it('pickup link explains that the page is not yet available', async () => {
    mount(); await ready(); fireEvent.click(screen.getByRole('link', { name: 'Pengajuan penjemputan' }))
    await screen.findByText('Halaman ini sedang dalam pengembangan.')
  })
  it('waits for edit detail instead of showing an empty form', async () => {
    const pending = deferred()
    mount({ path: `${scheduleBase}/${row.id}/edit`, handler: async c => c.url === `/jadwal/${row.id}` ? await pending.promise : undefined })
    expect(screen.queryByLabelText('Tanggal')).not.toBeInTheDocument()
    await act(async () => pending.resolve({ data: { data: row } }))
    await ready(); expect(screen.getByLabelText('Tanggal')).toHaveValue(row.tanggal)
  })
  it('rejects empty master data rather than inventing dropdown choices', async () => {
    mount({ path: `${scheduleBase}/tambah`, handler: async c => c.url === '/layanan' ? { data: { data: [] } } : undefined })
    expect(await screen.findByRole('alert')).toHaveTextContent('Data jenis layanan belum tersedia')
    expect(screen.queryByLabelText('Jenis layanan')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeEnabled()
  })
  it('paginates using server metadata while preserving the date filter', async () => {
    const { router } = mount({ path: `${scheduleBase}?dari=2026-11-23&sampai=2026-11-29`, handler: async c => {
      if (c.url.startsWith('/jadwal?')) return { data: { data: [row], meta: { page: Number(new URL(c.url, 'http://test').searchParams.get('page')), total: 21, total_pages: 2, limit: 20, dari: '2026-11-23', sampai: '2026-11-29' } } }
    } }); await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Berikutnya' }))
    await screen.findByText('2 / 2')
    expect(router.state.location.search).toContain('page=2')
    expect(router.state.location.search).toContain('dari=2026-11-23')
    expect(screen.getByRole('button', { name: 'Berikutnya' })).toBeDisabled()
  })
  it('corrects out-of-range URLs using server totals', async () => {
    const { router } = mount({ path: `${scheduleBase}?page=99&dari=2026-11-23&sampai=2026-11-29` }); await ready()
    expect(router.state.location.search).toContain('page=1')
    expect(router.state.location.search).toContain('dari=2026-11-23')
  })
  it('reactivates through the same confirmation and PATCH endpoint', async () => {
    const { request } = mount({ rows: [{ ...row, tersedia: false }] }); await ready()
    fireEvent.click(screen.getByRole('switch', { name: /Aktifkan/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Lanjutkan' }))
    await screen.findByText('Status jadwal berhasil diperbarui.')
    expect(request.mock.calls.find(([c]) => c.method === 'patch')[0].data).toEqual({ tersedia: true })
  })
  it('retains status after conflict and allows reloading after uncertain status change', async () => {
    let fail = 'conflict'
    mount({ handler: async c => {
      if (c.method === 'patch') {
        if (fail === 'conflict') throw { response: { status: 409, data: { error: { code: 'JADWAL_TERIKAT', message: 'Jadwal terikat penjemputan.' } } } }
        if (fail === 'network') throw new Error('offline')
      }
    } }); await ready()
    fireEvent.click(screen.getByRole('switch')); fireEvent.click(await screen.findByRole('button', { name: 'Lanjutkan' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Jadwal terikat penjemputan.')
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
    fail = 'network'; fireEvent.click(screen.getByRole('switch')); fireEvent.click(await screen.findByRole('button', { name: 'Lanjutkan' }))
    await screen.findByRole('button', { name: 'Muat ulang daftar' })
    expect(screen.getByRole('switch')).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Muat ulang daftar' }))
    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled())
  })
  it('accepts past dates and empty hours only for closed schedules', () => {
    const form = new FormData(); form.set('tanggal', '2000-02-29'); form.set('layanan_kode', 'penimbangan'); form.set('jam', '')
    expect(parseSchedule(form, services, false).errors).toEqual({})
    expect(parseSchedule(form, services, true).errors.jam).toBeTruthy()
    form.set('tanggal','2026-02-30')
    expect(parseSchedule(form, services, false).errors.tanggal).toBeTruthy()
  })
})
