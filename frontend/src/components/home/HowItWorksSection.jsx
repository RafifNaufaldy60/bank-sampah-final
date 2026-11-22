import LinkButton from '../common/LinkButton'
import StepCard from './StepCard'

function HowItWorksSection({ content, steps }) {
  return (
    <section className="how-section" id="cara-kerja">
      <div className="container how-grid">
        <div className="how-intro">
          <span className="eyebrow eyebrow--light">{content.eyebrow}</span>
          <h2>{content.titleLine1}<br />{content.titleLine2}</h2>
          <p>{content.description}</p>
          <LinkButton href="#panduan" variant="neutral">{content.buttonLabel}</LinkButton>
        </div>

        <div className="steps-grid" id="panduan">
          {steps.map((step) => (
            <StepCard {...step} key={step.number} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default HowItWorksSection
