function StatsSection({ stats }) {
  return (
    <section className="stats-strip" aria-label="Statistik bank sampah">
      <div className="container stats-grid">
        {stats.map((stat) => (
          <article className="stat-item" key={stat.label}>
            <div className="stat-icon"><img src={stat.icon} alt="" /></div>
            <div>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default StatsSection
