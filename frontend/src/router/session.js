import { redirect } from 'react-router-dom'
import { checkSession, sessionInvalidated } from '../features/auth/authSlice'
import { api, normalizeError, session } from '../services/api'

export const accountDestination = user => user?.peran === 'pengelola' ? '/pengelola/ringkasan' : '/akun'
export const isActiveManager = user => user?.peran === 'pengelola' && user.status_akun === 'active' && user.aktif === true

// One coordinator per Redux store. Parallel parent/child loaders await the same bootstrap.
export function createSessionLoaders(store) {
  let inFlight
  async function ensureSession() {
    if (inFlight) return await inFlight
    const auth = store.getState().auth
    const expired = auth.user && Date.parse(session.read()?.expires_at) <= Date.now()
    if (auth.initialized && auth.sessionStatus !== 'loading' && !expired) {
      if (auth.sessionStatus === 'failed') throw new Error(auth.sessionError?.message)
      return auth.user
    }
    inFlight = (async () => {
      if (store.getState().auth.sessionStatus === 'loading') {
        await new Promise(resolve => {
          const unsubscribe = store.subscribe(() => {
            if (store.getState().auth.sessionStatus !== 'loading') { unsubscribe(); resolve() }
          })
        })
      } else {
        await store.dispatch(checkSession({ retry: expired })).unwrap()
      }
      const current = store.getState().auth
      if (current.sessionStatus === 'failed') throw new Error(current.sessionError?.message)
      return current.user
    })()
    try { return await inFlight }
    finally { inFlight = null }
  }
  async function bootstrap() {
    // Failed bootstraps may be retried by the route error boundary.
    if (store.getState().auth.sessionStatus === 'failed') await store.dispatch(checkSession({ retry: true })).unwrap()
    await ensureSession()
    return null
  }
  async function manager({ request }, chair = false) {
    const user = await ensureSession()
    request.signal.throwIfAborted()
    if (!user || store.getState().auth.logoutStatus === 'loading') throw redirect('/login')
    if (!isActiveManager(user) || (chair && user.is_ketua !== true)) throw new Response('Akses ditolak', { status: 403 })
    return null
  }
  async function summary(args) {
    await manager(args)
    const token = session.read()?.token
    const generation = store.getState().auth.generation
    const controller = new AbortController()
    const abort = () => controller.abort()
    args.request.signal.addEventListener('abort', abort, { once: true })
    if (args.request.signal.aborted) abort()
    const unsubscribe = store.subscribe(() => {
      if (store.getState().auth.generation !== generation) abort()
    })
    const stale = () => store.getState().auth.generation !== generation || session.read()?.token !== token
    try {
      const result = await api.get('/ringkasan', { signal: controller.signal })
      if (stale()) throw redirect('/login')
      args.request.signal.throwIfAborted()
      return result.data.data
    } catch (error) {
      if (stale()) throw redirect('/login')
      if (args.request.signal.aborted || error.code === 'ERR_CANCELED') throw error
      if (error.response?.status === 401) {
        session.clear()
        store.dispatch(sessionInvalidated())
        throw redirect('/login')
      }
      if (error.response?.status === 403) throw new Response('Akses ditolak', { status: 403 })
      if (error instanceof Response) throw error
      throw new Error(normalizeError(error).message)
    } finally {
      unsubscribe()
      args.request.signal.removeEventListener('abort', abort)
    }
  }
  return { ensureSession, bootstrap, manager, summary, chair: args => manager(args, true) }
}
