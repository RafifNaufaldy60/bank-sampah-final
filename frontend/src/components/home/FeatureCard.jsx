function FeatureCard({ number, title, description, icon, href }) {
  return (
    <a className="feature-card" href={href}>
      <div className="feature-card__top">
        <div className="feature-icon"><img src={icon} alt="" /></div>
        <span>{number}</span>
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="feature-link">Selengkapnya <span aria-hidden="true">→</span></div>
    </a>
  )
}

export default FeatureCard
