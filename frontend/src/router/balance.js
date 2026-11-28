import { redirect } from 'react-router-dom'
import { api, normalizeError, session } from '../services/api'
import { sessionInvalidated } from '../features/auth/authSlice'

export const balancePath = '/akun/saldo-riwayat'
export const periods = {
  tiga_bulan: '3 bulan terakhir',
  bulan_ini: 'Bulan ini',
  tahun_ini: 'Tahun ini',
}

export async function customerRead(store, url, signal) {
  const auth = store.getState().auth
  const token = session.read()?.token
  if (!token || !auth.user) throw redirect('/login')
  if (auth.user.peran !== 'nasabah' || !auth.user.aktif || auth.user.status_akun !== 'active') {
    throw new Response('Akses ditolak', { status: 403 })
  }
  const controller = new AbortController()
  const current = () => {
    const next = store.getState().auth
    return next.generation === auth.generation && next.user?.id === auth.user.id &&
      next.user?.peran === 'nasabah' && next.user.aktif && next.user.status_akun === 'active' &&
      session.read()?.token === token
  }
  const unsubscribe = store.subscribe(() => { if (!current()) controller.abort() })
  const abort = () => controller.abort()
  signal.addEventListener('abort', abort, { once: true })
  try {
    signal.throwIfAborted()
    const response = await api.get(url, { signal: controller.signal })
    signal.throwIfAborted()
    if (!current()) throw redirect('/login')
    return { value: response.data }
  } catch (error) {
    signal.throwIfAborted()
    if (!current()) throw redirect('/login')
    if (error.response?.status === 401) {
      session.clear()
      store.dispatch(sessionInvalidated())
      throw redirect('/login')
    }
    const status = error.response?.status
    return { error: status === 404 ? 'Transaksi tidak ditemukan.' :
      status === 403 ? 'Akses ditolak.' : normalizeError(error).message }
  } finally {
    unsubscribe()
    signal.removeEventListener('abort', abort)
  }
}

export function balanceLoader(store, sessions) {
  return async ({ request }) => {
    const user = await sessions.ensureSession()
    request.signal.throwIfAborted()
    const { generation, logoutStatus } = store.getState().auth
    if (!user || logoutStatus === 'loading') throw redirect('/login')
    if (user.peran === 'pengelola') throw redirect('/pengelola/ringkasan')
    const params = new URL(request.url).searchParams
    const periode = Object.hasOwn(periods, params.get('periode')) ? params.get('periode') : 'tiga_bulan'
    const page = /^[1-9]\d{0,5}$/.test(params.get('page')) ? Number(params.get('page')) : 1
    const query = new URLSearchParams({ periode, page, limit: 5 })
    const [balance, history] = await Promise.all([
      customerRead(store, '/saldo', request.signal),
      customerRead(store, '/setoran?' + query, request.signal),
    ])
    if (history.value && page > Math.max(1, history.value.meta.total_pages)) {
      throw redirect(balancePath + '?' + new URLSearchParams({ periode, page: Math.max(1, history.value.meta.total_pages) }))
    }
    return { balance, history, periode, page, owner: user.id, generation, loadedAt: Date.now() }
  }
}
