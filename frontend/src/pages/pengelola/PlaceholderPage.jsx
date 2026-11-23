import { Link } from 'react-router-dom'
export default function PlaceholderPage({ title }) {
  return <section className="dashboard-message"><h2>{title}</h2><p>Halaman ini sedang dalam pengembangan.</p><Link className="dashboard-button" to="/pengelola/ringkasan">Kembali ke Ringkasan</Link></section>
}
