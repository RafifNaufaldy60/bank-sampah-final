import { useEffect, useRef } from 'react'
import { useFetcher, useLoaderData, useNavigate, useNavigation, useRevalidator } from 'react-router-dom'
import ApprovalTable from '../../components/pengelola/ApprovalTable'
import ApprovalDetail from '../../components/pengelola/ApprovalDetail'
import ApprovalStatus from '../../components/pengelola/ApprovalStatus'
import '../../styles/approvals.css'

export default function KelolaAkunPage() {
  const data = useLoaderData()
  const fetcher = useFetcher()
  const navigation = useNavigation()
  const navigate = useNavigate()
  const revalidator = useRevalidator()
  const submitting = useRef(false)
  const deciding = fetcher.state !== 'idle'
  const refreshing = revalidator.state !== 'idle' || fetcher.state === 'loading'
  const navigating = navigation.state !== 'idle'
  const pendingId = navigation.location ? new URLSearchParams(navigation.location.search).get('selected') : data.selected?.id
  const detailLoading = navigating && pendingId !== data.selected?.id
  const selectedId = navigating ? pendingId : data.selected?.id
  useEffect(() => { if (fetcher.state === 'idle') submitting.current = false }, [fetcher.state, fetcher.data])

  function select(id) { if (!submitting.current) navigate(`?page=${data.meta.page}&selected=${encodeURIComponent(id)}`, { replace: true, preventScrollReset: true }) }
  function decide(id, intent, reason) {
    if (submitting.current || deciding || navigating || refreshing) return
    submitting.current = true
    // Capture the target now; the action never reads the signed-in chair's ID.
    fetcher.submit({ id, intent, ...(reason ? { alasan_penolakan: reason } : {}) }, { method: 'post' })
  }
  const uncertain = fetcher.data?.type === 'uncertain' && fetcher.data.id === data.selected?.id && data.verification?.id !== data.selected?.id
  return <div className="approval-page">
    <ApprovalStatus result={fetcher.data} verification={data.verification} busy={deciding} />
    {refreshing && <p className="approval-refresh" role="status">Memperbarui daftar pengajuan…</p>}
    <div className="approval-columns">
      <ApprovalTable accounts={data.data} meta={data.meta} selectedId={selectedId} disabled={deciding} busy={refreshing || navigating} onSelect={select} onPage={page => navigate(`?page=${page}`, { preventScrollReset: true })} onRetry={() => revalidator.revalidate()} />
      <ApprovalDetail key={selectedId || 'none'} selected={data.selected} detail={data.detail} error={data.detailError} loading={detailLoading} busy={deciding} blocked={uncertain || refreshing || navigating} onRetry={() => revalidator.revalidate()} onDecision={decide} />
    </div>
  </div>
}
