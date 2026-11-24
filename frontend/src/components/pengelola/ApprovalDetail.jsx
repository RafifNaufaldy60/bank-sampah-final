import { useState } from 'react'
import { canDecide } from '../../router/approvals'
import { ApprovalBadge } from './ApprovalStatus'
import { approvalDate, approvalLabels } from './approvalFormat'

export default function ApprovalDetail({ selected, detail, error, loading, busy, blocked, onRetry, onDecision }) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [validation, setValidation] = useState('')
  const valid = !loading && !busy && !blocked && !error && detail?.id === selected?.id && canDecide(detail)
  function submit(event) {
    event.preventDefault()
    if (!valid) return
    if (!reason.trim() || reason.trim().length > 1000) { setValidation('Alasan penolakan harus berisi 1–1.000 karakter.'); return }
    setValidation('')
    onDecision(detail.id, 'tolak', reason.trim())
  }
  return <section className="approval-detail approval-panel" aria-labelledby="approval-detail-title" aria-busy={loading}>
    <h2 id="approval-detail-title">Detail pengajuan Akun</h2>
    {loading ? <p role="status" className="approval-detail-placeholder">Memuat detail pengelola…</p>
      : !selected ? <p className="approval-detail-placeholder">Pilih satu baris pengajuan untuk melihat detail akun.</p>
        : error ? <div className="approval-detail-placeholder"><p role="alert">{error}</p><button className="dashboard-button" onClick={onRetry}>Coba lagi detail</button></div>
          : detail && <>
            <div className="approval-detail-status"><span title={`ID akun ${detail.id}`}>{detail.kode_akun || detail.id}</span><ApprovalBadge status={detail.status_akun} detail /></div>
            <dl><div><dt>Nama Pengelola</dt><dd>{detail.nama}</dd></div><div><dt>Email</dt><dd>{detail.email}</dd></div><div><dt>Tanggal Pembuatan Akun</dt><dd>{approvalDate(detail.dibuat_pada, true)}</dd></div><div><dt>Jenis Akun</dt><dd>Pengelola Bank Sampah</dd></div><div><dt>Status Pengajuan</dt><dd>{detail.status_akun === 'pending' ? 'Menunggu Persetujuan Admin' : approvalLabels[detail.status_akun]}</dd></div>{detail.alasan_penolakan && <div><dt>Alasan Penolakan</dt><dd>{detail.alasan_penolakan}</dd></div>}</dl>
            {!detail.aktif && <p role="alert">Akun ini tidak lagi memenuhi syarat untuk diputuskan.</p>}
          </>}
    <div className="approval-decisions"><button className="approval-primary" disabled={!valid || rejecting} onClick={() => onDecision(detail.id, 'setujui')}>Setujui</button><button className="approval-secondary" disabled={!valid || rejecting} onClick={() => setRejecting(true)}>Tolak</button></div>
    {rejecting && valid && <form className="approval-rejection" onSubmit={submit} noValidate>
      <p>Menolak pengajuan <strong>{detail.nama}</strong> ({detail.email}).</p>
      <label htmlFor="rejection-reason">Alasan penolakan</label><textarea id="rejection-reason" value={reason} onChange={event => setReason(event.target.value)} rows={4} aria-invalid={!!validation} aria-describedby="rejection-help" required />
      <small id="rejection-help">Wajib diisi, 1–1.000 karakter.</small>{validation && <p role="alert">{validation}</p>}
      <div><button className="approval-primary" type="submit">Kirim penolakan</button><button className="approval-secondary" type="button" onClick={() => setRejecting(false)}>Batal</button></div>
    </form>}
    {busy && <p role="status">Mengirim keputusan dan memperbarui daftar…</p>}
  </section>
}
