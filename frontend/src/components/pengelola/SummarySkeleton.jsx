import { useLocation } from 'react-router-dom'

export default function SummarySkeleton() {
  return <div className="summary-skeleton" role="status" aria-label="Memuat Ringkasan">
    <span className="sr-only">Memuat Ringkasan…</span>
    <div className="skeleton welcome-skeleton" />
    <div className="summary-cards">{[1, 2, 3, 4].map(key => <div className="skeleton card-skeleton" key={key} />)}</div>
    <div className="summary-bottom"><div className="skeleton list-skeleton" /><div className="skeleton list-skeleton" /></div>
  </div>
}
export function InitialFallback() {
  const location = useLocation()
  if (location.pathname === '/pengelola/riwayat-nasabah') return <main className="dashboard-initial" role="status" aria-label="Memuat Riwayat Nasabah"><p>Memuat riwayat setoran nasabah…</p><div className="skeleton list-skeleton" /></main>
  if (location.pathname === '/pengelola/persetujuan-akun') return <main className="dashboard-initial" role="status" aria-label="Memuat Kelola Akun Pengelola">
    <p>Memeriksa sesi dan memuat pengajuan akun pengelola…</p>
    <div className="summary-bottom"><div className="skeleton list-skeleton" /><div className="skeleton list-skeleton" /></div>
  </main>
  return <main className="dashboard-initial"><SummarySkeleton /></main>
}
