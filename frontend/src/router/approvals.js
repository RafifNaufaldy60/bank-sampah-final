import { redirect } from 'react-router-dom'
import { api, normalizeError, session } from '../services/api'
import { chairAccessDenied, profileReceived, sessionInvalidated } from '../features/auth/authSlice'
import { isActiveManager } from './session'

const forbidden = () => new Response('Akses ditolak', { status: 403 })
const validId = id => typeof id === 'string' && /^[1-9]\d*$/.test(id) && BigInt(id) <= 9223372036854775807n
export const canDecide = account => validId(account?.id) && account.peran === 'pengelola' && account.aktif === true && account.status_akun === 'pending' && account.is_ketua === false

// The router owns list/detail data. Redux owns only the current user's session.
export function createApprovalRoutes(store, sessions) {
  const unverified = new Set()
  let submitting = false

  async function authorized(request, work, parallelRead = false) {
    const initialized = store.getState().auth.initialized
    await sessions.manager({ request })
    const generation = store.getState().auth.generation
    const token = session.read()?.token
    const controller = new AbortController()
    const abort = () => controller.abort()
    const stale = () => generation !== store.getState().auth.generation || token !== session.read()?.token
    request.signal.addEventListener('abort', abort, { once: true })
    if (request.signal.aborted) abort()
    const unsubscribe = store.subscribe(() => { if (stale()) abort() })
    const assertCurrent = () => {
      if (stale()) throw redirect('/login')
      request.signal.throwIfAborted()
      const auth = store.getState().auth
      if (auth.chairAccessDenied || !isActiveManager(auth.user) || auth.user.is_ketua !== true) throw forbidden()
    }
    async function call(method, url, body) {
      try {
        const result = method === 'get'
          ? await api.get(url, { signal: controller.signal })
          : await api.post(url, body, { signal: controller.signal })
        assertCurrent()
        return result.data
      } catch (error) {
        if (stale()) throw redirect('/login')
        request.signal.throwIfAborted()
        if (error.response?.status === 401) {
          session.clear(); store.dispatch(sessionInvalidated()); throw redirect('/login')
        }
        if (error.response?.status === 403) {
          store.dispatch(chairAccessDenied()); throw forbidden()
        }
        throw error
      }
    }
    try {
      // A direct visit shares bootstrap's fresh profile; later visits/actions refresh it.
      const refreshProfile = async () => { if (initialized) {
        const result = await api.get('/auth/me', { signal: controller.signal })
        if (stale()) throw redirect('/login')
        request.signal.throwIfAborted()
        store.dispatch(profileReceived({ user: result.data.data, generation }))
      } }
      if (parallelRead) {
        assertCurrent()
        // Both requests still authorize on the server; publish only after the fresh profile passes.
        const [, result] = await Promise.all([refreshProfile(), work(call)])
        assertCurrent()
        return result
      }
      await refreshProfile()
      assertCurrent()
      return await work(call)
    } catch (error) {
      if (stale()) throw redirect('/login')
      request.signal.throwIfAborted()
      if (error.response?.status === 401) {
        session.clear(); store.dispatch(sessionInvalidated()); throw redirect('/login')
      }
      if (error.response?.status === 403) { store.dispatch(chairAccessDenied()); throw forbidden() }
      if (error instanceof Response) throw error
      throw new Error(normalizeError(error).message)
    } finally {
      abort(); unsubscribe(); request.signal.removeEventListener('abort', abort)
    }
  }

  async function loader({ request }) {
    return await authorized(request, async call => {
      const url = new URL(request.url)
      const pageInput = url.searchParams.get('page') || '1'
      const page = /^[1-9]\d{0,5}$/.test(pageInput) ? Number(pageInput) : 1
      let list = await call('get', `/pengajuan-pengelola?status=all&page=${page}&limit=20`)
      // Use backend metadata when a page is no longer available.
      const lastPage = Math.max(1, list.meta.total_pages)
      if (list.meta.page > lastPage) list = await call('get', `/pengajuan-pengelola?status=all&page=${lastPage}&limit=20`)
      const requestedId = url.searchParams.get('selected')
      const selected = list.data.find(account => account.id === requestedId) || null
      let detail = null, detailError = null, verification = null
      if (validId(requestedId)) {
        try {
          const result = await call('get', `/pengajuan-pengelola/${requestedId}`)
          if (result.data.id !== requestedId) throw new Error('Identitas respons tidak sesuai.')
          unverified.delete(requestedId)
          verification = { id: requestedId, status: result.data.status_akun }
          if (selected) detail = result.data
        } catch (error) {
          if (error instanceof Response || request.signal.aborted) throw error
          const normalized = normalizeError(error)
          if (normalized.status === 404) { unverified.delete(requestedId); verification = { id: requestedId, status: 'missing' } }
          detailError = normalized.status === 404 ? 'Pengajuan tidak ditemukan. Muat ulang daftar untuk memperbaruinya.' : 'Detail belum dapat dimuat. Silakan coba lagi.'
        }
      }
      return { ...list, selected, detail, detailError, verification }
    }, true)
  }

  async function action({ request }) {
    return await authorized(request, async call => {
      const form = await request.formData()
      const id = form.get('id'), intent = form.get('intent')
      const reason = String(form.get('alasan_penolakan') || '').trim()
      if (!validId(id) || !['setujui', 'tolak'].includes(intent)) return { type: 'error', message: 'Pilih pengajuan yang valid terlebih dahulu.' }
      if (intent === 'tolak' && (reason.length < 1 || reason.length > 1000)) return { type: 'error', id, message: 'Alasan penolakan harus berisi 1–1.000 karakter.' }
      if (submitting || unverified.has(id)) return { type: 'uncertain', id, message: 'Status keputusan belum terverifikasi. Muat ulang status sebelum mencoba lagi.' }
      submitting = true
      unverified.add(id)
      try {
        await call('post', `/pengajuan-pengelola/${id}/${intent}`, intent === 'setujui' ? {} : { alasan_penolakan: reason })
        unverified.delete(id)
        return { type: 'success', id, message: intent === 'setujui' ? 'Persetujuan berhasil. Akun pengelola kini aktif.' : 'Pengajuan akun pengelola berhasil ditolak.' }
      } catch (error) {
        if (error instanceof Response || request.signal.aborted) throw error
        const normalized = normalizeError(error)
        if (normalized.status && normalized.status < 500) unverified.delete(id)
        if (normalized.status === 409) return { type: 'conflict', id, message: 'Pengajuan sudah berubah atau telah diputuskan oleh ketua lain. Daftar dan status terkini dimuat ulang.' }
        if (normalized.status === 404) return { type: 'error', id, message: 'Pengajuan tidak ditemukan. Daftar dimuat ulang.' }
        if (!normalized.status || normalized.status >= 500) return { type: 'uncertain', id, message: 'Konfirmasi keputusan belum diterima. Hasilnya belum diketahui; status diperiksa kembali tanpa mengirim ulang keputusan.' }
        return { type: 'error', id, message: normalized.message }
      } finally { submitting = false }
    })
  }
  return { loader, action }
}
