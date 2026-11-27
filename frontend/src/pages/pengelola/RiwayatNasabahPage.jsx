import { useEffect, useRef, useState } from 'react'
import { useDispatch, useStore } from 'react-redux'
import { useLoaderData, useNavigate, useNavigation } from 'react-router-dom'
import { api, normalizeError, session } from '../../services/api'
import { sessionInvalidated } from '../../features/auth/authSlice'
import { rupiah, weight } from '../../components/pengelola/format'
import { historyParams } from '../../router/history'
import searchIcon from '../../assets/history/search.svg'
import chevron from '../../assets/history/chevron.svg'
import verified from '../../assets/history/verified.svg'
import '../../styles/history.css'

const historyDate = value => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(`${value}T00:00:00+07:00`))

export default function RiwayatNasabahPage() {
  const result = useLoaderData()
  return <HistoryContent result={result} />
}
function HistoryContent({ result }) {
  const navigate = useNavigate(), navigation = useNavigation(), dispatch = useDispatch(), store = useStore()
  const params = new URLSearchParams(result.query)
  const [term, setTerm] = useState(params.get('search') || '')
  const [editing, setEditing] = useState(false)
  const [downloading, setDownloading] = useState(false), [error, setError] = useState('')
  const timer = useRef(), download = useRef()
  const [syncedQuery, setSyncedQuery] = useState(result.query)
  if (syncedQuery !== result.query) {
    setSyncedQuery(result.query)
    if (!editing) setTerm(params.get('search') || '')
  }
  const busy = navigation.state !== 'idle'
  const dirty = term.trim() !== (params.get('search') || '')
  useEffect(() => () => { clearTimeout(timer.current); download.current?.abort() }, [])
  function change(values) {
    clearTimeout(timer.current)
    timer.current = null
    setEditing(false)
    const next = historyParams(result.query)
    next.set('page', '1')
    for (const [key, value] of Object.entries(values)) { if (value) next.set(key, value); else next.delete(key) }
    navigate(`?${next}`, { replace: true, preventScrollReset: true })
  }
  function search(value) {
    setTerm(value); setEditing(true); clearTimeout(timer.current)
    timer.current = setTimeout(() => change({ search: value.trim() }), 350)
  }
  async function exportReport() {
    if (download.current || busy || dirty || !result.meta.total) return
    const controller = new AbortController(); download.current = controller
    const generation = store.getState().auth.generation
    const unsubscribe = store.subscribe(() => { if (store.getState().auth.generation !== generation) controller.abort() })
    setDownloading(true); setError('')
    try {
      const query = new URLSearchParams(result.query); query.delete('page'); query.delete('limit')
      const response = await api.get(`/setoran/export.xlsx?${query}`, { responseType: 'blob', signal: controller.signal })
      controller.signal.throwIfAborted()
      if (!response.data.size) throw new Error('File laporan kosong.')
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url; link.download = `riwayat-setoran-${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())}.xlsx`
      document.body.append(link); link.click(); link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (failure) {
      if (controller.signal.aborted) return
      if (failure.response?.status === 401) { session.clear(); dispatch(sessionInvalidated()); navigate('/login', { replace: true }); return }
      if (failure.response?.status === 403) { navigate('/akun', { replace: true }); return }
      setError(normalizeError(failure).message)
    } finally { unsubscribe(); download.current = null; setDownloading(false) }
  }
  const { data, meta } = result
  const pages = Array.from({ length: Math.min(3, meta.total_pages) }, (_, i) => Math.max(1, Math.min(meta.page - 1, meta.total_pages - 2)) + i)
  return <section className="history-panel" aria-label="Riwayat setoran seluruh nasabah">
    <form className="history-toolbar" onSubmit={event => { event.preventDefault(); change({ search: term.trim() }) }}>
      <label className="history-search"><span className="sr-only">Cari nama, kode nasabah, atau kode transaksi</span><img src={searchIcon} alt="" /><input value={term} onChange={event => search(event.target.value)} maxLength={100} placeholder="Cari nama, ID nasabah, atau ID transaksi..." type="search" /></label>
      <label className="history-period"><span className="sr-only">Periode transaksi</span><select value={params.get('periode') || ''} onChange={event => change({ periode: event.target.value, search: term.trim() })}><option value="">Semua periode</option><option value="bulan_ini">Bulan ini</option><option value="tiga_bulan">Tiga bulan terakhir</option><option value="tahun_ini">Tahun ini</option></select><img src={chevron} alt="" /></label>
      <button className="history-export" type="button" disabled={downloading || busy || dirty || !meta.total} onClick={exportReport}>{downloading ? 'Mengunduh…' : 'Unduh laporan'}</button>
      {(term || params.get('periode')) && <button type="button" className="dashboard-button" onClick={() => { setTerm(''); change({ search: '', periode: '' }) }}>Hapus filter</button>}
    </form>
    {busy && <p role="status" className="history-message">Memuat riwayat…</p>}
    {error && <p role="alert" className="history-message">{error} <button className="dashboard-button" onClick={exportReport}>Coba unduh lagi</button></p>}
    <div className="history-scroll" role="region" aria-label="Tabel riwayat nasabah" tabIndex={0} aria-busy={busy}>
      <table className="history-table"><thead><tr>{['Nasabah', 'Transaksi', 'Jenis sampah', 'Berat', 'Nilai', 'Status'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{data.map(row => <tr key={row.setoran_id}><td><strong>{row.nama_nasabah}</strong><small>{row.kode_nasabah}</small></td><td><strong>{historyDate(row.tanggal_setoran)}</strong><small>{row.kode_setoran}</small></td><td>{row.jenis_sampah}</td><td>{weight(row.berat_kg)}</td><td><strong>{rupiah(row.nilai_setoran_rp)}</strong></td><td><span className="history-status">{row.status === 'Terverifikasi' && <img src={verified} alt="" />}{row.status === 'Terverifikasi' ? 'Terverifikasi' : row.status}</span></td></tr>)}</tbody>
      </table>
    </div>
    {!data.length && <p className="history-message">{params.get('search') || params.get('periode') ? 'Tidak ditemukan transaksi yang cocok dengan pencarian atau filter.' : 'Belum ada riwayat setoran nasabah.'}</p>}
    <footer className="history-footer"><span>Menampilkan {data.length} dari {meta.total.toLocaleString('id-ID')} transaksi</span><nav aria-label="Halaman riwayat"><button aria-label="Halaman sebelumnya" disabled={busy || dirty || meta.page <= 1} onClick={() => change({ page: String(meta.page - 1) })}>‹</button>{pages.map(page => <button key={page} aria-label={`Halaman ${page}`} aria-current={page === meta.page ? 'page' : undefined} disabled={busy || dirty} onClick={() => change({ page: String(page) })}>{page}</button>)}<button aria-label="Halaman berikutnya" disabled={busy || dirty || meta.page >= meta.total_pages} onClick={() => change({ page: String(meta.page + 1) })}>›</button></nav></footer>
  </section>
}
