import { redirect } from 'react-router-dom'
import { api, session, normalizeError } from '../services/api'
import { sessionInvalidated } from '../features/auth/authSlice'

export function historyParams(search) {
  const input = new URLSearchParams(search), params = new URLSearchParams()
  const term = (input.get('search') || '').trim().slice(0, 100)
  if (term) params.set('search', term)
  if (['bulan_ini', 'tiga_bulan', 'tahun_ini'].includes(input.get('periode'))) params.set('periode', input.get('periode'))
  params.set('page', /^[1-9]\d{0,5}$/.test(input.get('page')) ? input.get('page') : '1')
  params.set('limit', '5')
  return params
}

export function createHistoryRoutes(store, sessions) {
  async function loader({ request }) {
    await sessions.manager({ request })
    const generation = store.getState().auth.generation
    const token = session.read()?.token
    const controller = new AbortController()
    const stale = () => store.getState().auth.generation !== generation || session.read()?.token !== token
    const abort = () => controller.abort()
    request.signal.addEventListener('abort', abort, { once: true })
    if (request.signal.aborted) abort()
    const unsubscribe = store.subscribe(() => { if (stale()) abort() })
    try {
      const params = historyParams(new URL(request.url).search)
      let result = (await api.get(`/setoran?${params}`, { signal: controller.signal })).data
      const last = Math.max(1, result.meta.total_pages)
      if (result.meta.page > last) {
        params.set('page', String(last))
        result = (await api.get(`/setoran?${params}`, { signal: controller.signal })).data
      }
      if (stale()) throw redirect('/login')
      request.signal.throwIfAborted()
      return { ...result, query: params.toString() }
    } catch (error) {
      if (stale()) throw redirect('/login')
      request.signal.throwIfAborted()
      if (error.response?.status === 401) { session.clear(); store.dispatch(sessionInvalidated()); throw redirect('/login') }
      if (error.response?.status === 403) throw new Response('Akses ditolak', { status: 403 })
      if (error instanceof Response) throw error
      throw new Error(normalizeError(error).message)
    } finally { unsubscribe(); request.signal.removeEventListener('abort', abort) }
  }
  return { loader }
}
