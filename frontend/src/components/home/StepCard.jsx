function StepCard({ number, title, description, icon }) {
  return (
    <article className="step-card">
      <div className="step-card__top">
        <div className="step-icon"><img src={icon} alt="" /></div>
        <strong>{number}</strong>
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
    </article>
  )
}

export default StepCard
