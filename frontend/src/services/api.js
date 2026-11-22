import axios from 'axios'

const key = 'bank-sampah.session'
// No previous frontend session mechanism exists. Persist only the opaque token and expiry per tab.
export const session = {
  read() {
    try { return JSON.parse(sessionStorage.getItem(key)) } catch { return null }
  },
  write(value) { sessionStorage.setItem(key, JSON.stringify(value)) },
  clear() { sessionStorage.removeItem(key) },
}
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api', timeout: 15000 })
api.interceptors.request.use(config => {
  // Public auth requests never carry a previous session.
  if (!['/auth/login', '/auth/register'].includes(config.url)) {
    const token = session.read()?.token
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export function normalizeError(error) {
  const status = error.response?.status || 0
  const body = error.response?.data?.error
  const code = body?.code || (status >= 500 ? 'INTERNAL_ERROR' : 'NETWORK_ERROR')
  const messages = {
    NETWORK_ERROR: 'Tidak dapat terhubung ke server. Periksa koneksi Anda dan coba lagi.',
    INTERNAL_ERROR: 'Server sedang mengalami gangguan. Silakan coba lagi.',
    ACCOUNT_PENDING: 'Akun Anda menunggu persetujuan ketua.',
    ACCOUNT_REJECTED: 'Pendaftaran akun Anda ditolak. Hubungi pengelola untuk informasi lebih lanjut.',
    LOGIN_GAGAL: 'Email atau kata sandi salah, atau akun tidak aktif.',
    TERLALU_BANYAK_PERMINTAAN: 'Terlalu banyak permintaan dari jaringan ini. Silakan coba lagi nanti.',
    DATA_DUPLIKAT: 'Email atau data akun sudah digunakan.',
  }
  const normalized = { status, code, message: messages[code] || body?.message || 'Permintaan gagal. Silakan coba lagi.' }
  if (code === 'LOGIN_LOCKED' && Number.isFinite(Number(body.retry_after_seconds))) {
    normalized.locked_until = body.locked_until
    normalized.retry_after_seconds = Number(body.retry_after_seconds)
    // Relative server duration avoids depending on the client's wall clock matching the server.
    normalized.deadline = Date.now() + normalized.retry_after_seconds * 1000
  }
  return normalized
}
