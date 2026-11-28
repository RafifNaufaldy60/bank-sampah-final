import { useEffect, useRef, useState } from 'react'
import closeIcon from '../assets/balance/close.svg'
import { useStore } from 'react-redux'
import { customerRead } from '../router/balance'
import { depositDate, rupiah, weight } from './pengelola/format'

const clockFormat = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })

export default function DepositReceipt({ row, trigger, onClose }) {
  const dialog = useRef(null)
  const store = useStore()
  const [result, setResult] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const element = dialog.current
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    element.showModal()
    element.querySelector('button').focus()
    return () => {
      element.close()
      document.body.style.overflow = overflow
      if (trigger?.isConnected) trigger.focus()
    }
  }, [trigger])

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const data = await customerRead(store, '/setoran/' + row.setoran_id, controller.signal)
        if (!controller.signal.aborted) setResult(data)
      } catch {
        if (!controller.signal.aborted) setResult({ error: 'Sesi telah berubah. Buka kembali rincian setoran.' })
      }
    }
    load()
    return () => controller.abort()
  }, [store, row.setoran_id, attempt])

  const detail = result?.value?.data
  return <dialog className="deposit-receipt" ref={dialog} aria-labelledby="receipt-title"
    onKeyDown={event => {
      if (event.key !== 'Tab') return
      const buttons = event.currentTarget.querySelectorAll('button:not(:disabled)')
      const first = buttons[0]
      const last = buttons[buttons.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }}
    onCancel={event => { event.preventDefault(); onClose() }}
    onClick={event => { if (event.target === dialog.current) onClose() }}>
    <div className="receipt-body">
      <header><div><small>Rincian transaksi</small><h2 id="receipt-title">{row.kode_setoran}</h2></div>
        <button type="button" className="receipt-close" aria-label="Tutup rincian" onClick={onClose}><img src={closeIcon} alt="" /></button></header>
      {!result && <p role="status">Memuat rincian setoran…</p>}
      {result?.error && <div role="alert">{result.error} <button onClick={() => {
        setResult(null)
        setAttempt(value => value + 1)
      }}>Coba lagi</button></div>}
      {detail && <>
        <dl className="receipt-facts">
          <div><dt>Tanggal setoran</dt><dd>{depositDate(detail.tanggal_setoran)}</dd></div>
          <div><dt>Waktu pencatatan</dt><dd>{clockFormat.format(new Date(detail.dicatat_pada))} WIB</dd></div>
          <div><dt>Total berat</dt><dd>{weight(detail.berat_kg)}</dd></div>
          <div><dt>Status</dt><dd>{detail.status}</dd></div>
          <div><dt>Nasabah</dt><dd>{detail.nama_nasabah}</dd></div>
        </dl>
        <h3>Jenis sampah</h3>
        <ul>{detail.rincian.map(item => <li key={item.jenis_sampah_id}>
          <div><strong>{item.jenis_sampah}</strong><span>{weight(item.berat_kg)} × {rupiah(item.harga_per_kg)}/kg</span></div>
          <b>{rupiah(item.subtotal_rp)}</b>
        </li>)}</ul>
        <footer><span>Total nilai setoran</span><strong>{rupiah(detail.nilai_setoran_rp)}</strong></footer>
      </>}
    </div>
  </dialog>
}
