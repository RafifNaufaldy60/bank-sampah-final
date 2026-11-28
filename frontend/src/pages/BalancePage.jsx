import { useState } from 'react'
import { useSelector } from 'react-redux'
import { Navigate, useLoaderData, useNavigation, useNavigate, useRevalidator } from 'react-router-dom'
import { balancePath, periods } from '../router/balance'
import { decimalID, depositDate, rupiah, weight } from '../components/pengelola/format'
import DepositReceipt from '../components/DepositReceipt'
import wallet from '../assets/icons/Ilustrasi=Tabungan.svg'
import scale from '../assets/balance/scale.svg'
import check from '../assets/balance/check.svg'
import arrow from '../assets/balance/detail.svg'
import verified from '../assets/history/verified.svg'
import '../styles/balance.css'

function SectionError({ message }) {
  const retry = useRevalidator()
  return <div className="balance-message" role="alert">{message} <button disabled={retry.state !== 'idle'} onClick={() => retry.revalidate()}>
    {retry.state === 'idle' ? 'Coba lagi' : 'Memuat…'}</button></div>
}

export default function BalancePage() {
  const data = useLoaderData()
  const auth = useSelector(state => state.auth)
  if (!auth.user) return <Navigate to="/login" replace />
  if (auth.logoutStatus === 'loading') return <p role="status">Sedang keluar…</p>
  if (auth.user.peran !== 'nasabah') return <Navigate to="/pengelola/ringkasan" replace />
  if (!auth.user.aktif || auth.user.status_akun !== 'active') return <p role="alert">Akses ditolak.</p>
  if (data.owner !== auth.user.id || data.generation !== auth.generation) {
    return <Navigate to={balancePath + '?periode=' + data.periode} replace />
  }
  return <CustomerBalance key={data.owner + '-' + data.generation} data={data} user={auth.user} />
}

function CustomerBalance({ data, user }) {
  const { balance, history, periode, page } = data
  const summary = balance.value?.data
  const list = history.value
  const navigation = useNavigation()
  const navigate = useNavigate()
  const [selection, setSelection] = useState(null)
  const pending = navigation.location?.pathname === balancePath
  const nextPeriod = pending ? new URLSearchParams(navigation.location.search).get('periode') : null
  const changingPeriod = pending && nextPeriod !== periode
  function change(period, nextPage) {
    setSelection(null)
    navigate('?' + new URLSearchParams({ periode: period, page: nextPage }), { preventScrollReset: true })
  }
  function select(row, trigger) {
    setSelection({ row, trigger })
  }
  return <main className="customer-balance" aria-label="Saldo dan riwayat">
    <div className="container">
      <header className="balance-welcome"><div>Selamat datang kembali,<h1>{user.nama}</h1></div>
        <span>ID Nasabah · {user.kode_akun}</span></header>
      {summary ? <section className="balance-cards" aria-label="Ringkasan sepanjang waktu">
        <article className="balance-money"><div>Saldo tabungan sampah<h2>{rupiah(summary.saldo_rp)}</h2>
          <small><img src={check} alt="" /> Dimuat {new Date(data.loadedAt).toLocaleDateString('id-ID', {
            day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta',
          })}</small></div><img src={wallet} alt="" /></article>
        <article className="balance-weight"><span><img src={scale} alt="" /></span>
          <div>Total sampah disetor<h2>{decimalID(summary.total_kg)} <small>kg</small></h2><small>Sepanjang waktu</small></div>
        </article>
      </section> : <SectionError message={balance.error || 'Saldo belum dapat dimuat.'} />}
      <section className="balance-history" aria-labelledby="history-title">
        <header><div><h2 id="history-title">Riwayat setoran</h2><p>Semua transaksi yang telah dicatat pengurus.</p></div>
          <select aria-label="Periode riwayat" value={nextPeriod || periode} onChange={e => change(e.target.value, 1)}>
            {Object.entries(periods).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select></header>
        {pending && <p className="balance-message" role="status">{changingPeriod ? 'Memuat periode…' : 'Memuat halaman…'}</p>}
        {history.error && <SectionError message={history.error} />}
        {list && <>
          <div className="balance-scroll" role="region" aria-label="Riwayat transaksi" tabIndex={0} aria-busy={pending}>
            <table><thead><tr>{['Tanggal', 'Jenis sampah', 'Berat', 'Nilai setoran', 'Status', ''].map(title =>
              <th key={title} scope="col">{title || <span className="sr-only">Rincian</span>}</th>)}</tr></thead>
              <tbody>{list.data.map(row => <tr key={row.setoran_id} onClick={e => select(row, e.currentTarget.querySelector('button'))}>
                <td><strong>{depositDate(row.tanggal_setoran)}</strong><small>{row.kode_setoran}</small></td>
                <td>{row.jenis_sampah}</td><td>{weight(row.berat_kg)}</td><td>{rupiah(row.nilai_setoran_rp)}</td>
                <td><span className="balance-status">{row.status === 'Terverifikasi' && <img src={verified} alt="" />}{row.status}</span></td>
                <td><button className="balance-detail" aria-label={'Rincian ' + row.kode_setoran}
                  onClick={e => { e.stopPropagation(); select(row, e.currentTarget) }}><img src={arrow} alt="" /></button></td>
              </tr>)}</tbody></table>
          </div>
          {!list.data.length && <p className="balance-message">{summary && /^0(?:\.0+)?$/.test(summary.total_kg)
            ? 'Anda belum pernah menyetor sampah.' : 'Tidak ada setoran dalam periode ini.'}</p>}
          {list.meta.total_pages > 1 && <nav className="balance-pager" aria-label="Halaman riwayat">
            <button disabled={pending || page <= 1} onClick={() => change(periode, page - 1)}>Sebelumnya</button>
            <span>{page} / {list.meta.total_pages} · {list.meta.total} transaksi</span>
            <button disabled={pending || page >= list.meta.total_pages} onClick={() => change(periode, page + 1)}>Berikutnya</button>
          </nav>}
        </>}
      </section>
      {selection && <DepositReceipt key={selection.row.setoran_id} {...selection} onClose={() => setSelection(null)} />}
    </div>
  </main>
}
