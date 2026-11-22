import FeatureCard from './FeatureCard'

function FeaturesSection({ heading, features }) {
  return (
    <section className="features-section" id="info-harga">
      <div className="container">
        <div className="section-heading section-heading--split">
          <div>
            <span className="eyebrow">{heading.eyebrow}</span>
            <h2>{heading.titleLine1}<br />{heading.titleLine2}</h2>
          </div>
          <p>{heading.description}</p>
        </div>

        <div className="feature-grid">
          {features.map((feature) => (
            <FeatureCard {...feature} key={feature.number} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default FeaturesSection
