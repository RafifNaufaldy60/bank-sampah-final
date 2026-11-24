export const approvalLabels = { pending: 'Menunggu', active: 'Disetujui', ditolak: 'Ditolak', missing: 'Tidak ditemukan' }

export function approvalDate(value, long = false) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: long ? 'long' : 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(date)
}
