import Brand from '../common/Brand'

function Footer({ description, socialLinks, serviceLinks, address, openingHours, copyright }) {
  return (
    <footer className="site-footer">
      <div className="footer-decor footer-decor--left" />
      <div className="footer-decor footer-decor--right" />

      <div className="container footer-content">
        <div className="footer-grid">
          <div className="footer-brand">
            <Brand showEyebrow />
            <p>{description}</p>
            <div className="socials">
              {socialLinks.map((social) => (
                <a href={social.href} aria-label={social.label} key={social.label}>
                  <img src={social.icon} alt="" />
                </a>
              ))}
            </div>
          </div>

          <div className="footer-links">
            <h3>Layanan</h3>
            {serviceLinks.map((link) => (
              <a href={link.href} key={link.label}>{link.label}</a>
            ))}
          </div>

          <div className="footer-address">
            <h3>Bank Sampah Desa RahayuLestari</h3>
            <p><span aria-hidden="true">⌖</span> {address}</p>
            <p><span aria-hidden="true">◷</span> {openingHours}</p>
          </div>
        </div>

        <div className="footer-bottom">{copyright}</div>
      </div>
    </footer>
  )
}

export default Footer
