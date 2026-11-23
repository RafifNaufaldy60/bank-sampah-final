import { Link, useLoaderData, useRevalidator } from 'react-router-dom'
import { dashboardAsset } from '../../components/pengelola/navigation'
import { dateID, decimalID, initials, rupiah, timeID, weight } from '../../components/pengelola/format'

export function SummaryCard({ icon, title, value, description }) {
  return <article className="summary-card"><div className="summary-icon"><img src={dashboardAsset(icon)} alt="" /></div><h3>{title}</h3><p className="summary-value">{value}</p><p className="summary-description">{description}</p></article>
}
export function RecentTransactions({ transactions }) {
  return <section className="summary-panel recent-transactions" aria-labelledby="transactions-title">
    <header className="summary-panel-header"><div><h2 id="transactions-title">Transaksi terbaru</h2><p>Setoran yang baru masuk ke sistem.</p></div><Link to="/pengelola/riwayat-nasabah">Lihat semua <img src={dashboardAsset('arrow')} alt="" /></Link></header>
    {transactions.length === 0 ? <p className="dashboard-empty">Belum ada transaksi.</p> : <ul className="transaction-list">{transactions.map(transaction => <li key={transaction.setoran_id}>
      <span className="transaction-avatar" aria-hidden="true">{initials(transaction.nama_nasabah)}</span><div className="transaction-customer"><strong>{transaction.nama_nasabah}</strong><span>{transaction.jenis_sampah}</span></div><span className="transaction-weight">{weight(transaction.berat_kg)}</span><strong className="transaction-amount">{rupiah(transaction.nilai_setoran_rp)}</strong>
    </li>)}</ul>}
  </section>
}
export function TodaySchedule({ schedules }) {
  return <section className="summary-panel today-schedule" aria-labelledby="schedule-title"><header className="summary-panel-header"><div><h2 id="schedule-title">Jadwal hari ini</h2><p>Layanan hari ini.</p></div></header>
    {schedules.length === 0 ? <p className="dashboard-empty">Tidak ada jadwal hari ini.</p> : <ul className="schedule-list">{schedules.map(schedule => <li key={schedule.id}><span className="schedule-icon"><img src={dashboardAsset('clock')} alt="" /></span><div><strong>{schedule.nama_layanan}</strong><p>{timeID(schedule.jam_mulai)} – {timeID(schedule.jam_selesai)} WIB</p><small>{schedule.tersedia === true ? 'Tersedia' : 'Tutup'}</small>{schedule.catatan && <p>{schedule.catatan}</p>}</div></li>)}</ul>}
    <Link className="dashboard-button schedule-link" to="/pengelola/kelola-jadwal">Kelola jadwal</Link>
  </section>
}
export default function RingkasanPage() {
  const { pengelola, metrik, transaksi_terbaru, jadwal_hari_ini, periode } = useLoaderData()
  const revalidator = useRevalidator()
  return <div className="ringkasan-page">
    <section className="summary-welcome"><div><p>{dateID(periode.hari)}</p><h2>Selamat datang, {pengelola.nama.split(' ')[0]}.</h2><p>Ada {decimalID(metrik.transaksi_hari_ini)} transaksi setoran yang tercatat hari ini.</p></div><Link to="/pengelola/catatan-setoran"><img src={dashboardAsset('plus')} alt="" />Catat setoran</Link></section>
    <div className="summary-cards">
      <SummaryCard icon="money" title="Nilai Setoran Hari Ini" value={rupiah(metrik.nilai_hari_ini_rp)} description="Setoran tercatat hari ini" />
      <SummaryCard icon="weight" title="Jumlah Sampah Terkumpul" value={weight(metrik.berat_hari_ini_kg)} description={`${decimalID(metrik.transaksi_hari_ini)} transaksi hari ini`} />
      <SummaryCard icon="customers" title="Jumlah Nasabah Aktif" value={`${decimalID(metrik.nasabah_aktif)} Nasabah`} description="Akun nasabah yang aktif" />
      <SummaryCard icon="calendar" title="Jadwal Tersedia" value={`${decimalID(metrik.hari_tersedia_minggu_ini)} Hari`} description="Minggu ini · Senin–Minggu" />
    </div>
    <div className="summary-bottom"><RecentTransactions transactions={transaksi_terbaru} /><TodaySchedule schedules={jadwal_hari_ini} /></div>
    <div className="summary-refresh"><span>Waktu Indonesia Barat (Asia/Jakarta)</span><button className="dashboard-button" onClick={() => revalidator.revalidate()} disabled={revalidator.state !== 'idle'}>{revalidator.state === 'idle' ? 'Perbarui Ringkasan' : 'Memperbarui…'}</button></div>
  </div>
}
