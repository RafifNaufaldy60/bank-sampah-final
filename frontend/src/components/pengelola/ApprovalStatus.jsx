import { approvalLabels } from './approvalFormat'

export function ApprovalBadge({ status, detail = false }) {
  return <span className={`approval-badge approval-badge-${status}`}>{detail && status === 'pending' ? 'Menunggu konfirmasi' : approvalLabels[status] || 'Tidak diketahui'}</span>
}

export default function ApprovalStatus({ result, verification, busy }) {
  if (!result) return null
  const verified = verification?.id === result.id
  return <div className={`approval-notice approval-notice-${result.type}`} role={result.type === 'success' ? 'status' : 'alert'}>
    <p>{result.message}</p>
    {result.id && <small>ID akun: {result.id}</small>}
    {result.type === 'uncertain' && <p>{busy ? 'Memeriksa status terkini…' : verified
      ? `Status terkini: ${approvalLabels[verification.status] || verification.status}.`
      : 'Status belum dapat diverifikasi. Gunakan Muat ulang daftar sebelum mengambil keputusan berikutnya.'}</p>}
  </div>
}

