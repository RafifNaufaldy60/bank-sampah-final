import { redirect } from 'react-router-dom'
import { api, session, normalizeError } from '../services/api'
import { sessionInvalidated } from '../features/auth/authSlice'
export const scheduleBase = '/pengelola/kelola-jadwal'
export const validScheduleId = id => typeof id === 'string' && /^[1-9]\d*$/.test(id) && BigInt(id) <= 9223372036854775807n
export function scheduleQuery(search) {
  const input = new URLSearchParams(search), query = new URLSearchParams()
  for (const key of ['dari', 'sampai']) if (input.get(key)) query.set(key, input.get(key))
  query.set('page', /^[1-9]\d{0,5}$/.test(input.get('page')) ? input.get('page') : '1')
  query.set('limit', '20')
  return query
}
export function parseSchedule(form, services, available = true) {
  const tanggal = String(form.get('tanggal') || ''), layanan_kode = String(form.get('layanan_kode') || '')
  const range = String(form.get('jam') || '').trim().replaceAll('.', ':').split(/\s*[–—-]\s*/)
  const errors = {}
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal) || !Number.isFinite(Date.parse(tanggal)) || new Date(tanggal).toISOString().slice(0,10) !== tanggal) errors.tanggal = 'Pilih tanggal yang valid.'
  if (!services.some(service => service.kode === layanan_kode)) errors.layanan_kode = 'Pilih jenis layanan.'
  const empty = !String(form.get('jam') || '').trim()
  if (!(empty && !available) && (range.length !== 2 || range.some(time => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) || range[0] >= range[1])) errors.jam = 'Gunakan HH.mm–HH.mm; jam selesai harus setelah jam mulai (WIB).'
  return { errors, value: { tanggal, layanan_kode, jam_mulai: empty ? null : range[0], jam_selesai: empty ? null : range[1] } }
}
export function createScheduleRoutes(store, sessions) {
  let mutating = false
  async function authorized(request, work) {
    await sessions.manager({ request })
    const generation = store.getState().auth.generation, token = session.read()?.token
    const controller = new AbortController(), abort = () => controller.abort()
    const stale = () => generation !== store.getState().auth.generation || token !== session.read()?.token
    request.signal.addEventListener('abort', abort, { once: true }); if (request.signal.aborted) abort()
    const unsubscribe = store.subscribe(() => { if (stale()) abort() })
    const call = async (method, url, data) => {
      const result = await api.request({ method, url, data, signal: controller.signal })
      if (stale()) throw redirect('/login')
      request.signal.throwIfAborted()
      return result.data
    }
    try { return await work(call) }
    catch (error) {
      if (stale()) throw redirect('/login')
      request.signal.throwIfAborted()
      if (error instanceof Response) throw error
      if (error.response?.status === 401) { session.clear(); store.dispatch(sessionInvalidated()); throw redirect('/login') }
      if (error.response?.status === 403) throw new Response('Akses ditolak', { status: 403 })
      if (request.method !== 'GET') return { error: normalizeError(error).message, uncertain: !error.response || error.response.status >= 500 }
      throw new Error(error.response?.status === 404 ? 'Jadwal tidak ditemukan.' : normalizeError(error).message)
    } finally { abort(); unsubscribe(); request.signal.removeEventListener('abort', abort) }
  }
  async function loader({ request, params }) {
    return authorized(request, async call => {
      const query = scheduleQuery(new URL(request.url).search)
      if (params.id && !validScheduleId(params.id)) throw new Response('ID jadwal tidak valid.', { status: 400 })
      const [master, list, detail] = await Promise.all([call('get', '/layanan'), call('get', `/jadwal?${query}`), params.id ? call('get', `/jadwal/${params.id}`) : null])
      if (!master.data?.length) throw new Response('Data jenis layanan belum tersedia. Hubungi pengelola data layanan atau coba lagi.', { status: 503 })
      const lastPage = Math.max(1, list.meta.total_pages)
      if (list.meta.page > lastPage) {
        query.set('page', String(lastPage))
        throw redirect(`${new URL(request.url).pathname}?${query}`)
      }
      return { services: master.data, list, detail: detail?.data || null, query: query.toString() }
    })
  }
  async function action({ request, params }) {
    if (mutating) return { error: 'Penyimpanan sedang berlangsung.' }
    mutating = true
    try { return await authorized(request, async call => {
      const form = await request.formData(), intent = form.get('intent')
      if (intent === 'toggle') {
        const id = form.get('id')
        if (!validScheduleId(id) || !['true','false'].includes(form.get('tersedia'))) return { error: 'Jadwal tidak valid.' }
        await call('patch', `/jadwal/${id}`, { tersedia: form.get('tersedia') === 'true' })
        return { success: 'Status jadwal berhasil diperbarui.' }
      }
      if (params.id && !validScheduleId(params.id)) return { error: 'ID jadwal tidak valid.' }
      const [master, detail] = await Promise.all([call('get', '/layanan'), params.id ? call('get', `/jadwal/${params.id}`) : null])
      const current = detail?.data
      const parsed = parseSchedule(form, master.data, current?.tersedia ?? true)
      if (Object.keys(parsed.errors).length) return { errors: parsed.errors }
      const saved = await call(params.id ? 'patch' : 'post', params.id ? `/jadwal/${params.id}` : '/jadwal', parsed.value)
      return { success: 'Jadwal berhasil disimpan.', tanggal: saved.data.tanggal }
    }) } finally { mutating = false }
  }
  return { loader, action }
}
