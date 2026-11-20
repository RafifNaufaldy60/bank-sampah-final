import Brand from '../common/Brand'
import LinkButton from '../common/LinkButton'

function Header({ navigation, actions }) {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <a href="#beranda" className="brand-link" aria-label="Rahayu Lestari - Beranda">
          <Brand />
        </a>

        <nav className="main-nav" aria-label="Navigasi utama">
          {navigation.map((item) => (
            <a className={item.active ? 'active' : ''} href={item.href} key={item.label}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="header-actions">
          {actions.map((action) => (
            <LinkButton
              href={action.href}
              variant={action.variant}
              size="small"
              key={action.label}
            >
              {action.label}
            </LinkButton>
          ))}
        </div>
      </div>
    </header>
  )
}

export default Header
