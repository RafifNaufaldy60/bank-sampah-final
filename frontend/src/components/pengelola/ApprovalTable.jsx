import { ApprovalBadge } from './ApprovalStatus'
import { approvalDate } from './approvalFormat'

export default function ApprovalTable({ accounts, meta, selectedId, onSelect, onPage, disabled, busy, onRetry }) {
  return <section className="approval-list approval-panel" aria-labelledby="approval-list-title" aria-busy={busy}>
    <div className="approval-list-heading"><h2 id="approval-list-title">Daftar Pengajuan Akun Pengelola</h2><button className="approval-refresh-list" aria-label="Muat ulang daftar" title="Muat ulang daftar" onClick={onRetry} disabled={disabled || busy}>{meta.pending_total} menunggu konfirmasi</button></div>
    {!accounts.length ? <p className="dashboard-empty">Belum ada pengajuan akun pengelola.</p> : <div className="approval-table-scroll" tabIndex={0} role="region" aria-label="Tabel pengajuan akun pengelola">
      <table className="approval-table"><colgroup><col className="approval-col-number" /><col /><col /><col /><col className="approval-col-status" /></colgroup><thead><tr><th scope="col">No</th><th scope="col">Nama Pengelola</th><th scope="col">Email</th><th scope="col">Tanggal Dibuat</th><th scope="col">Status</th></tr></thead>
        <tbody>{accounts.map((account, index) => <tr key={account.id} className={selectedId === account.id ? 'is-selected' : ''} onClick={() => { if (!disabled) onSelect(account.id) }}>
          <td>{(meta.page - 1) * meta.limit + index + 1}</td>
          <td><button className="approval-select" disabled={disabled} aria-pressed={selectedId === account.id} aria-label={`Pilih ${account.nama}, ${account.email}`} onClick={event => { event.stopPropagation(); onSelect(account.id) }}>{account.nama}</button></td>
          <td>{account.email}</td><td>{approvalDate(account.dibuat_pada)}</td><td><ApprovalBadge status={account.status_akun} /></td>
        </tr>)}</tbody>
      </table>
    </div>}
    {meta.total_pages > 1 && <div className="approval-pagination"><span>{`${(meta.page - 1) * meta.limit + 1}–${(meta.page - 1) * meta.limit + accounts.length} dari ${meta.total}`}</span>
      <nav aria-label="Halaman pengajuan"><button className="dashboard-button" disabled={disabled || busy || meta.page <= 1} onClick={() => onPage(meta.page - 1)}>Sebelumnya</button><span>{meta.page} / {meta.total_pages}</span><button className="dashboard-button" disabled={disabled || busy || meta.page >= meta.total_pages} onClick={() => onPage(meta.page + 1)}>Berikutnya</button></nav>
    </div>}
  </section>
}
