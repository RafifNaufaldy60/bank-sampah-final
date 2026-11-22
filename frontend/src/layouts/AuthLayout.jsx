import { Link } from 'react-router-dom'
import panel from '../assets/auth/panel.svg'
import circles from '../assets/auth/circles.svg'
import logo from '../assets/auth/logo.svg'
import illustration from '../assets/auth/illustration.svg'
import back from '../assets/auth/back.svg'
import money from '../assets/auth/money.svg'
import notes from '../assets/auth/notes.svg'
import calendar from '../assets/auth/calendar.svg'
import registerPanel from '../assets/auth/register-panel.svg'
import registerCircles from '../assets/auth/register-circles.svg'
import registerIllustration from '../assets/auth/register-illustration.svg'

export default function AuthLayout({ registration = false, children }) {
  return <main className="auth-layout">
    <aside className="auth-story" aria-label="Bank Sampah Rahayu Lestari">
      <img className="auth-panel" src={registration ? registerPanel : panel} alt="" />
      <img className="auth-circles" src={registration ? registerCircles : circles} alt="" />
      <div className="auth-story-content">
        <Link to="/" className="auth-brand"><img src={logo} alt="" /><span><strong>Rahayu<span>Lestari</span></strong><small>BANK SAMPAH DESA</small></span></Link>
        <div className="auth-story-copy"><h2>Bijak memilah sampah,<br /><span>wujudkan bumi bebas<br />sampah.</span></h2>
          <p>Kelola sampah dengan mudah, pantau saldo, dan ubah kebiasaan kecil menjadi dampak, baik untuk lingkungan sekitar.</p>
        </div>
        <div className="auth-benefits">{[[money, 'Harga', 'transparan'], [notes, 'Riwayat', 'tercatat rapi'], [calendar, 'Jadwal', 'terorganisir']].map(([icon, first, second]) => <div className="auth-benefit" key={first}><span><img src={icon} alt="" /></span><b>{first}<br />{second}</b></div>)}</div>
      </div>
      <img className="auth-illustration" src={registration ? registerIllustration : illustration} alt="Ilustrasi pemilahan sampah dan daun" />
    </aside>
    <section className="auth-main">
      <nav className="auth-nav" aria-label="Navigasi akun"><Link to="/"><img src={back} alt="" />Kembali ke Beranda</Link><span>{registration ? 'Sudah punya akun?' : 'Belum punya akun?'} <Link to={registration ? '/login' : '/register'}>{registration ? 'Masuk' : 'Daftar'}</Link></span></nav>
      <div className="auth-heading"><h1>{registration ? 'Buat akun baru' : 'Masuk ke Akun Anda'}</h1><p>{registration ? 'Bergabung dan mulai kelola sampahmu secara digital.' : 'Pilih peran dan masukkan data akun Anda untuk melanjutkan.'}</p></div>
      {children}
    </section>
  </main>
}
