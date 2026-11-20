import LinkButton from '../common/LinkButton'

function HeroSection({ content, heroImage, activeCustomerIcon }) {
  return (
    <section className="hero-section" id="beranda">
      <div className="container hero-grid">
        <div className="hero-copy">
          <div className="pill">
            <span className="pill__dot">✓</span>
            {content.eyebrow}
          </div>

          <h1>
            {content.title}<br />
            <span>{content.highlightedTitle}</span>
          </h1>

          <p className="hero-description">{content.description}</p>

          <div className="hero-actions">
            {content.actions.map((action) => (
              <LinkButton href={action.href} variant={action.variant} key={action.label}>
                {action.label}
                {action.showArrow && <span aria-hidden="true">→</span>}
              </LinkButton>
            ))}
          </div>

          <div className="hero-benefits">
            {content.benefits.map((benefit) => (
              <span key={benefit}><b>✓</b> {benefit}</span>
            ))}
          </div>
        </div>

        <div className="hero-visual" aria-label="Warga membawa sampah terpilah">
          <div className="decor decor--circle" />
          <div className="decor decor--leaf" />

          <div className="hero-photo-frame">
            <img src={heroImage} alt="Warga membawa kantong hasil pemilahan sampah" />
            <div className="impact-card">
              <div>
                <span>{content.impact.label}</span>
                <strong>{content.impact.value}</strong>
              </div>
              <div className="impact-icon" aria-hidden="true">♻</div>
            </div>
          </div>

          <div className="active-card">
            <div className="active-card__icon"><img src={activeCustomerIcon} alt="" /></div>
            <div>
              <span>{content.activeCustomers.label}</span>
              <strong>{content.activeCustomers.value}</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default HeroSection
