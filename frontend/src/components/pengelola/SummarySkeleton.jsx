export default function SummarySkeleton() {
  return <div className="summary-skeleton" role="status" aria-label="Memuat Ringkasan">
    <span className="sr-only">Memuat Ringkasan…</span>
    <div className="skeleton welcome-skeleton" />
    <div className="summary-cards">{[1, 2, 3, 4].map(key => <div className="skeleton card-skeleton" key={key} />)}</div>
    <div className="summary-bottom"><div className="skeleton list-skeleton" /><div className="skeleton list-skeleton" /></div>
  </div>
}
export function InitialFallback() {
  return <main className="dashboard-initial"><SummarySkeleton /></main>
}
