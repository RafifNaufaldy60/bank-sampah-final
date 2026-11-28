import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createMemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import App from '../App'
import { createAppRoutes } from '../router'
import { balancePath } from '../router/balance'
import { createAppStore } from '../app/store'
import { login } from '../features/auth/authSlice'
import { api, session } from '../services/api'
import { manager, summaryFixture } from './summaryFixture'

const user = { id: '12', nama: 'Nasabah A', kode_akun: 'NSB-A', peran: 'nasabah', aktif: true, status_akun: 'active' }
const rows = ['101', '102'].map(id => ({ setoran_id: id, kode_setoran: 'TRX-' + id,
  tanggal_setoran: '2026-11-18', dicatat_pada: '2026-11-18T03:42:00Z', nama_nasabah: user.nama,
  jenis_sampah: 'Kardus', berat_kg: '2.125', nilai_setoran_rp: '5950', status: 'Terverifikasi' }))
const wrap = data => ({ data: { data } })
const details = row => wrap({ ...row, rincian: [{ jenis_sampah_id: 3, jenis_sampah: 'Item ' + row.setoran_id,
  berat_kg: '2.125', harga_per_kg: '2800', subtotal_rp: '5950' }] })
const pending = () => Promise.withResolvers()
function mount(handler, account = user) {
  if (account) session.write({ token: 'a', expires_at: '2099-01-01T00:00:00Z' })
  const get = vi.spyOn(api, 'get').mockImplementation(async url => {
    if (url === '/auth/me') return wrap(account)
    const response = await handler?.(url)
    if (response) return response
    if (url === '/saldo') return wrap({ total_kg: '12.345', saldo_rp: '9007199254740993' })
    if (url.startsWith('/setoran?')) return { data: { data: rows, meta: { total: 7, total_pages: 2 } } }
    throw new Error('Unexpected request ' + url)
  })
  const store = createAppStore()
  const router = createMemoryRouter(createAppRoutes(store), { initialEntries: [balancePath] })
  render(<Provider store={store}><App router={router} /></Provider>)
  return { router, get, store }
}

test('agregat presisi, pagination, reset filter dan pembatalan respons periode lama', async () => {
  const slow = pending()
  const { router } = mount(url => url.includes('periode=bulan_ini') ? slow.promise : null)
  expect(await screen.findByText('Rp 9.007.199.254.740.993')).toBeVisible()
  fireEvent.click(screen.getByText('Berikutnya'))
  await screen.findByText('2 / 2 · 7 transaksi')
  fireEvent.change(screen.getByLabelText('Periode riwayat'), { target: { value: 'bulan_ini' } })
  await screen.findByText('Memuat periode…')
  fireEvent.change(screen.getByLabelText('Periode riwayat'), { target: { value: 'tahun_ini' } })
  await screen.findByText('1 / 2 · 7 transaksi')
  await act(async () => slow.resolve({ data: { data: [], meta: { total_pages: 0, total: 0 } } }))
  expect(router.state.location.search).toBe('?periode=tahun_ini&page=1')
  expect(screen.getByText('Rp 9.007.199.254.740.993')).toBeVisible()
  expect(screen.getByText('TRX-101')).toBeVisible()
})

test('rincian terlambat tidak mengganti pilihan baru, fokus kembali ke tombol', async () => {
  const slow = pending()
  const { get } = mount(url => url === '/setoran/101' ? slow.promise : url === '/setoran/102' ? details(rows[1]) : null)
  const [first, second] = await screen.findAllByRole('button', { name: /^Rincian TRX/ })
  fireEvent.click(first)
  await screen.findByText('Memuat rincian setoran…')
  fireEvent.click(screen.getByRole('button', { name: 'Tutup rincian' }))
  expect(first).toHaveFocus()
  fireEvent.click(second.closest('tr'))
  const dialog = screen.getByRole('dialog', { name: 'TRX-102' })
  expect(await within(dialog).findByText('Item 102')).toBeVisible()
  await act(async () => slow.resolve(details(rows[0])))
  expect(screen.queryByText('Item 101')).toBeNull()
  expect(within(dialog).getByText('10.42 WIB')).toBeVisible()
  expect(get.mock.calls.filter(([url]) => url === '/setoran/101')).toHaveLength(1)
  fireEvent(dialog, new Event('cancel', { cancelable: true }))
  expect(second).toHaveFocus()
  expect(document.body.style.overflow).not.toBe('hidden')
})

test('saldo gagal independen, coba lagi, dan keadaan belum pernah menyetor', async () => {
  let failed = true
  mount(url => {
    if (url === '/saldo' && failed) throw new Error('offline')
    if (url === '/saldo') return wrap({ saldo_rp: '0', total_kg: '0.000' })
    return { data: { data: [], meta: { total: 0, total_pages: 0 } } }
  })
  await screen.findByRole('alert')
  expect(screen.queryByText('Rp 0')).toBeNull()
  expect(screen.getByText('Tidak ada setoran dalam periode ini.')).toBeVisible()
  failed = false
  fireEvent.click(screen.getByText('Coba lagi'))
  expect(await screen.findByText('Anda belum pernah menyetor sampah.')).toBeVisible()
  expect(screen.getByText('Rp 0')).toBeVisible()
})

test('pergantian akun menghilangkan saldo dan membatalkan respons rincian sebelumnya', async () => {
  const slow = pending()
  const { store } = mount(url => {
    if (url === '/setoran/101') return slow.promise
    if (session.read()?.token === 'b') return url === '/saldo' ? wrap({ saldo_rp: '0', total_kg: '0' }) :
      { data: { data: [], meta: { total: 0, total_pages: 0 } } }
  })
  fireEvent.click(await screen.findByRole('button', { name: 'Rincian TRX-101' }))
  await screen.findByText('Memuat rincian setoran…')
  await act(async () => {
    session.write({ token: 'b', expires_at: '2099-01-01T00:00:00Z' })
    store.dispatch(login.fulfilled({ ...user, id: '13', nama: 'Nasabah B', email: 'b@example.test' }, 'test'))
  })
  await screen.findByText('Anda belum pernah menyetor sampah.')
  await act(async () => slow.resolve(details(rows[0])))
  expect(screen.queryByText('TRX-101')).toBeNull()
  expect(screen.queryByText('Rp 9.007.199.254.740.993')).toBeNull()
})

test('tamu dan sesi kedaluwarsa diarahkan ke login', async () => {
  mount(url => { if (url === '/saldo') throw { response: { status: 401 } } })
  await screen.findByLabelText('Email')
  expect(session.read()).toBeNull()
})

test('akses langsung tanpa sesi tidak meminta saldo atau riwayat', async () => {
  const { get } = mount(null, null)
  await screen.findByLabelText('Email')
  expect(get).not.toHaveBeenCalled()
})

test('pengelola diarahkan ke ringkasan tanpa memuat riwayat pribadi', async () => {
  const { get } = mount(url => url === '/ringkasan' ? wrap(summaryFixture) : null, manager)
  await screen.findByRole('heading', { name: 'Ringkasan Dashboard' })
  expect(get.mock.calls.some(([url]) => url === '/saldo' || url.startsWith('/setoran'))).toBe(false)
})

test('saldo tetap terlihat ketika riwayat gagal dan riwayat dapat dimuat ulang', async () => {
  let failed = true
  mount(url => { if (failed && url.startsWith('/setoran?')) throw new Error('offline') })
  await screen.findByRole('alert')
  expect(screen.getByText('Rp 9.007.199.254.740.993')).toBeVisible()
  failed = false
  fireEvent.click(screen.getByText('Coba lagi'))
  expect(await screen.findByText('TRX-101')).toBeVisible()
})

test.each([403, 404])('error rincian %s dapat dicoba kembali', async status => {
  let failed = true
  mount(url => {
    if (url !== '/setoran/101') return
    if (failed) throw { response: { status } }
    return details(rows[0])
  })
  fireEvent.click(await screen.findByRole('button', { name: 'Rincian TRX-101' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(status === 403 ? 'Akses ditolak' : 'Transaksi tidak ditemukan')
  failed = false
  fireEvent.click(screen.getByText('Coba lagi'))
  expect(await screen.findByText('Item 101')).toBeVisible()
})
