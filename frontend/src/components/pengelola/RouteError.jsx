import { isRouteErrorResponse, Link, useRevalidator, useRouteError } from 'react-router-dom'

export function ForbiddenPage() {
  return <section className="dashboard-message"><h1>403 — Akses ditolak</h1><p>Akun Anda tidak memiliki akses ke halaman ini.</p><Link to="/akun">Kembali ke akun</Link></section>
}
export default function RouteError() {
  const error = useRouteError()
  const revalidator = useRevalidator()
  if (isRouteErrorResponse(error) && error.status === 403) return <ForbiddenPage />
  return <section className="dashboard-message"><h1>Halaman belum dapat dimuat</h1>
    <p role="alert">{error?.message || 'Permintaan gagal. Silakan coba lagi.'}</p>
    <button className="dashboard-button" onClick={() => revalidator.revalidate()} disabled={revalidator.state !== 'idle'}>{revalidator.state === 'idle' ? 'Coba lagi' : 'Memuat…'}</button>
    <Link to="/">Kembali ke Beranda</Link>
  </section>
}
