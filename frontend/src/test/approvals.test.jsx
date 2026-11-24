import { StrictMode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { createMemoryRouter } from 'react-router-dom'
import App from '../App'
import { createAppRoutes } from '../router'
import { createAppStore } from '../app/store'
import { logout } from '../features/auth/authSlice'
import { api, session } from '../services/api'
import { manager } from './summaryFixture'

const target = { id: '9007199254740997', nama: 'Siti Pengujian', email: 'siti@example.test', peran: 'pengelola', is_ketua: false, aktif: true, status_akun: 'pending', dibuat_pada: '2026-11-18T00:00:00Z' }
const second = { ...target, id: '9007199254740999', nama: 'Dewi Pengujian', email: 'dewi@example.test' }
const response = data => ({ data: { data } })
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const failure = status => ({ response: { status, data: { error: { code: 'TEST_ERROR', message: 'Permintaan ditolak server.' } } } })
function mount({ user = manager, accounts = [target, second], path = '/pengelola/persetujuan-akun', getHandler, postHandler } = {}) {
  const state = { user, accounts: accounts.map(a => ({ ...a })) }
  if (user) session.write({ token: 'chair-fixture', expires_at: '2099-01-01T00:00:00Z' })
  const get = vi.spyOn(api, 'get').mockImplementation(async (url, options) => {
    const override = await getHandler?.(url, options, state)
    if (override) return override
    if (url === '/auth/me') return response(state.user)
    if (url.includes('?status=')) {
      const params = new URL(url, 'http://test').searchParams
      const page = Number(params.get('page')), limit = Number(params.get('limit'))
      const rows = state.accounts.filter(a => a.status_akun === params.get('status'))
      return { data: { data: rows.slice((page - 1) * limit, page * limit), meta: { page, limit, total: rows.length, total_pages: Math.ceil(rows.length / limit) } } }
    }
    const account = state.accounts.find(a => url.endsWith(`/${a.id}`))
    if (!account) throw failure(404)
    return response({ ...account })
  })
  const post = vi.spyOn(api, 'post').mockImplementation(async (url, body, options) => {
    const override = await postHandler?.(url, body, options, state)
    if (override) return override
    if (url === '/auth/logout') return response({})
    const account = state.accounts.find(a => url.includes(`/${a.id}/`))
    if (account.status_akun !== 'pending') throw failure(409)
    account.status_akun = url.endsWith('/setujui') ? 'active' : 'ditolak'
    account.alasan_penolakan = body.alasan_penolakan || null
    return response({ ...account })
  })
  const store = createAppStore()
  const router = createMemoryRouter(createAppRoutes(store), { initialEntries: [path] })
  render(<StrictMode><Provider store={store}><App router={router} /></Provider></StrictMode>)
  return { state, store, router, get, post }
}
const ready = () => screen.findByRole('heading', { name: 'Daftar Pengajuan Akun Pengelola' })
const panel = () => screen.getByRole('region', { name: 'Detail pengajuan Akun' })
async function select(account = target) {
  fireEvent.click(screen.getByRole('button', { name: `Pilih ${account.nama}, ${account.email}` }))
  await waitFor(() => expect(within(panel()).getByText(account.email)).toBeInTheDocument())
}

describe('Kelola Akun Pengelola', () => {
  it('loads pending from the backend once, waits for session, and disables decisions without selection', async () => {
    const pending = deferred()
    const { get } = mount({ accounts: [target, { ...second, status_akun: 'active' }], getHandler: async url => url === '/auth/me' ? await pending.promise : undefined })
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Memuat Kelola Akun Pengelola' })).toBeInTheDocument()
    await act(async () => pending.resolve(response(manager)))
    await ready()
    expect(screen.queryByText(second.email)).not.toBeInTheDocument()
    expect(screen.getByText('1 menunggu konfirmasi')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Setujui' })).toBeDisabled()
    expect(get.mock.calls.map(c => c[0])).toEqual(['/auth/me', '/pengajuan-pengelola?status=pending&page=1&limit=20'])
  })
  it.each([{ is_ketua: false }, { peran: 'nasabah' }, { is_ketua: 'true' }, { status_akun: 'pending' }, { aktif: false }])('rejects direct access for %o', async flags => {
    const { get } = mount({ user: { ...manager, ...flags } })
    await screen.findByRole('heading', { name: /403/ })
    expect(get.mock.calls.some(c => c[0].startsWith('/pengajuan-pengelola'))).toBe(false)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
  it('redirects guests to login without private requests', async () => {
    const { get } = mount({ user: null })
    await screen.findByLabelText('Email')
    expect(get).not.toHaveBeenCalled()
  })
  it('refreshes backend permission when entering from an initialized session', async () => {
    const { state, router } = mount({ path: '/pengelola/kelola-jadwal' })
    await screen.findByText('Halaman ini sedang dalam pengembangan.')
    state.user = { ...manager, is_ketua: false }
    await act(async () => { await router.navigate('/pengelola/persetujuan-akun') })
    await screen.findByRole('heading', { name: /403/ })
    expect(screen.queryByRole('link', { name: 'Kelola Akun Pengelola' })).not.toBeInTheDocument()
  })
  it('selects via keyboard and row click, preserving bigint IDs', async () => {
    mount(); await ready()
    const button = screen.getByRole('button', { name: `Pilih ${target.nama}, ${target.email}` })
    button.focus(); await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(within(panel()).getByText(target.email)).toBeInTheDocument())
    expect(button).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByText(second.email).closest('tr'))
    await waitFor(() => expect(within(panel()).getByText(second.id)).toBeInTheDocument())
  })
  it('aborts a slow detail and ignores its late response after another row is selected', async () => {
    const pending = deferred(); let signal
    mount({ getHandler: async (url, options) => { if (url === `/pengajuan-pengelola/${target.id}`) { signal = options.signal; return await pending.promise } } })
    await ready(); fireEvent.click(screen.getByRole('button', { name: `Pilih ${target.nama}, ${target.email}` }))
    await waitFor(() => expect(signal).toBeDefined())
    expect(screen.getByText('Memuat detail pengelola…')).toBeInTheDocument()
    await select(second)
    expect(signal.aborted).toBe(true)
    await act(async () => pending.resolve(response(target)))
    expect(within(panel()).queryByText(target.email)).not.toBeInTheDocument()
    expect(within(panel()).getByText(second.email)).toBeInTheDocument()
  })
  it('approves the captured target once, refreshes once, and preserves the chair session', async () => {
    const pending = deferred()
    const { post, get, state, store } = mount({ postHandler: async (_url, _body, _options, current) => { await pending.promise; current.accounts[0].status_akun = 'active'; return response(current.accounts[0]) } })
    await ready(); await select()
    const before = get.mock.calls.filter(c => c[0].includes('?status=')).length
    const button = screen.getByRole('button', { name: 'Setujui' })
    fireEvent.click(button); fireEvent.click(button)
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    expect(button).toBeDisabled()
    expect(screen.queryByText(/Persetujuan berhasil/)).not.toBeInTheDocument()
    expect(post.mock.calls[0][0]).toBe(`/pengajuan-pengelola/${target.id}/setujui`)
    expect(post.mock.calls[0][1]).toEqual({})
    await act(async () => pending.resolve())
    await screen.findByText(/Persetujuan berhasil/)
    await waitFor(() => expect(screen.queryByText(target.email)).not.toBeInTheDocument())
    expect(state.accounts[0]).toMatchObject({ status_akun: 'active', is_ketua: false })
    expect(store.getState().auth.user.id).toBe(manager.id)
    expect(session.read().token).toBe('chair-fixture')
    expect(get.mock.calls.filter(c => c[0].includes('?status=')).length - before).toBe(1)
    expect(screen.getByText('1 menunggu konfirmasi')).toBeInTheDocument()
  })
  it('validates rejection and submits the trimmed reason to the target API', async () => {
    const { post } = mount(); await ready(); await select()
    fireEvent.click(screen.getByRole('button', { name: 'Tolak' }))
    const field = screen.getByLabelText('Alasan penolakan')
    fireEvent.change(field, { target: { value: '   ' } }); fireEvent.click(screen.getByRole('button', { name: 'Kirim penolakan' }))
    expect(post).not.toHaveBeenCalled()
    fireEvent.change(field, { target: { value: 'x'.repeat(1001) } }); fireEvent.click(screen.getByRole('button', { name: 'Kirim penolakan' }))
    expect(post).not.toHaveBeenCalled()
    fireEvent.change(field, { target: { value: '  Data belum lengkap.  ' } }); fireEvent.click(screen.getByRole('button', { name: 'Kirim penolakan' }))
    await screen.findByText('Pengajuan akun pengelola berhasil ditolak.')
    expect(post.mock.calls[0].slice(0, 2)).toEqual([`/pengajuan-pengelola/${target.id}/tolak`, { alasan_penolakan: 'Data belum lengkap.' }])
  })
  it('revalidates 409 without overwriting the other chair decision', async () => {
    const { post } = mount({ postHandler: async (_url, _body, _options, state) => { state.accounts[0].status_akun = 'ditolak'; throw failure(409) } })
    await ready(); await select(); fireEvent.click(screen.getByRole('button', { name: 'Setujui' }))
    await screen.findByText(/Pengajuan sudah berubah/)
    await waitFor(() => expect(screen.queryByText(target.email)).not.toBeInTheDocument())
    expect(post).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/Persetujuan berhasil/)).not.toBeInTheDocument()
  })
  it.each([true, false])('verifies uncertain network outcome by GET, committed=%s, without retrying POST', async committed => {
    const { post, get } = mount({ postHandler: async (_url, _body, _options, state) => { if (committed) state.accounts[0].status_akun = 'active'; throw new Error('connection lost') } })
    await ready(); await select(); const before = get.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: 'Setujui' }))
    await screen.findByText(committed ? 'Status terkini: Disetujui.' : 'Status terkini: Menunggu.')
    expect(post).toHaveBeenCalledTimes(1)
    expect(get.mock.calls.slice(before).some(c => c[0] === `/pengajuan-pengelola/${target.id}`)).toBe(true)
    expect(screen.queryByText(/Persetujuan berhasil/)).not.toBeInTheDocument()
  })
  it('keeps decisions blocked until an uncertain result can be verified', async () => {
    let failDetail = false
    const { post } = mount({ getHandler: async url => { if (failDetail && url === `/pengajuan-pengelola/${target.id}`) throw new Error('offline') }, postHandler: async () => { failDetail = true; throw new Error('offline') } })
    await ready(); await select(); fireEvent.click(screen.getByRole('button', { name: 'Setujui' }))
    await screen.findByText(/Status belum dapat diverifikasi/)
    expect(screen.getByRole('button', { name: 'Setujui' })).toBeDisabled()
    failDetail = false; fireEvent.click(screen.getByRole('button', { name: 'Coba lagi detail' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Setujui' })).toBeEnabled())
    expect(post).toHaveBeenCalledTimes(1)
  })
  it('moves to the previous page when the last row is decided', async () => {
    const accounts = Array.from({ length: 21 }, (_, i) => ({ ...target, id: String(100 + i), nama: `Pengelola ${i}`, email: `p${i}@example.test` }))
    mount({ accounts, path: '/pengelola/persetujuan-akun?page=2' }); await ready(); await select(accounts[20])
    fireEvent.click(screen.getByRole('button', { name: 'Setujui' }))
    await screen.findByText('1–20 dari 20')
    expect(screen.getByText('Pilih satu baris pengajuan untuk melihat detail akun.')).toBeInTheDocument()
  })
  it('renders the required empty message', async () => {
    mount({ accounts: [] }); await ready()
    expect(screen.getByText('Belum ada pengajuan akun pengelola.')).toBeInTheDocument()
  })
  it.each(['list', 'detail'])('removes page data and menu when the %s API denies chair access', async source => {
    let deny = false
    const { router } = mount({ getHandler: async url => {
      if (deny && (source === 'list' ? url.includes('?status=') : url === `/pengajuan-pengelola/${target.id}`)) throw failure(403)
    } })
    await ready(); await select(); deny = true
    fireEvent.click(screen.getByRole('button', { name: 'Muat ulang daftar' }))
    await screen.findByRole('heading', { name: /403/ })
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Kelola Akun Pengelola' })).not.toBeInTheDocument()
    expect(JSON.stringify(router.state.loaderData)).not.toContain(target.email)
  })
  it('shows detail 404 with retry and blocks decisions', async () => {
    mount({ path: `/pengelola/persetujuan-akun?selected=${target.id}`, getHandler: async url => { if (url === `/pengajuan-pengelola/${target.id}`) throw failure(404) } })
    await ready()
    expect(screen.getByText('Pengajuan tidak ditemukan. Muat ulang daftar untuk memperbaruinya.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Coba lagi detail' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Setujui' })).toBeDisabled()
  })
  it.each([{ aktif: false }, { status_akun: 'active' }, { is_ketua: true }])('never enables decisions for ineligible detail %o', async flags => {
    mount({ getHandler: async url => url === `/pengajuan-pengelola/${target.id}` ? response({ ...target, ...flags }) : undefined })
    await ready(); await select()
    expect(screen.getByRole('button', { name: 'Setujui' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Tolak' })).toBeDisabled()
  })
  it('retries list and detail errors without dummy data', async () => {
    let failList = true, failDetail = true
    mount({ getHandler: async url => { if ((failList && url.includes('?status=')) || (failDetail && url === `/pengajuan-pengelola/${target.id}`)) throw failure(500) } })
    await screen.findByRole('heading', { name: 'Halaman belum dapat dimuat' })
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    failList = false; fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' })); await ready()
    fireEvent.click(screen.getByRole('button', { name: `Pilih ${target.nama}, ${target.email}` }))
    await screen.findByText('Detail belum dapat dimuat. Silakan coba lagi.')
    failDetail = false; fireEvent.click(screen.getByRole('button', { name: 'Coba lagi detail' }))
    await waitFor(() => expect(within(panel()).getByText(target.email)).toBeInTheDocument())
  })
  it.each([401, 403])('clears private page after decision API returns %s', async status => {
    const { store } = mount({ postHandler: async () => { throw failure(status) } })
    await ready(); await select(); fireEvent.click(screen.getByRole('button', { name: 'Setujui' }))
    if (status === 401) { await screen.findByLabelText('Email'); expect(store.getState().auth.user).toBeNull() }
    else { await screen.findByRole('heading', { name: /403/ }); expect(screen.queryByRole('link', { name: 'Kelola Akun Pengelola' })).not.toBeInTheDocument() }
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText(target.email)).not.toBeInTheDocument()
  })
  it('handles missing target and backend validation errors', async () => {
    let status = 400
    const { post } = mount({ postHandler: async () => { throw failure(status) } })
    await ready(); await select(); fireEvent.click(screen.getByRole('button', { name: 'Setujui' }))
    await screen.findByText('Permintaan ditolak server.')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Setujui' })).toBeEnabled())
    status = 404; fireEvent.click(screen.getByRole('button', { name: 'Setujui' }))
    await screen.findByText('Pengajuan tidak ditemukan. Daftar dimuat ulang.')
    expect(post).toHaveBeenCalledTimes(2)
  })
  it('aborts detail on logout and ignores late private responses', async () => {
    const pending = deferred(); let signal
    const { store } = mount({ getHandler: async (url, options) => { if (url === `/pengajuan-pengelola/${target.id}`) { signal = options.signal; return await pending.promise } } })
    await ready(); fireEvent.click(screen.getByRole('button', { name: `Pilih ${target.nama}, ${target.email}` }))
    await waitFor(() => expect(signal).toBeDefined())
    await act(async () => { await store.dispatch(logout()).unwrap() })
    expect(signal.aborted).toBe(true)
    await act(async () => pending.resolve(response(target)))
    await screen.findByLabelText('Email')
    expect(screen.queryByText(target.email)).not.toBeInTheDocument()
  })
})
