import { Link } from 'react-router-dom'

function LinkButton({ href, variant = 'primary', size = 'default', children, className = '' }) {
  const classes = [
    'btn',
    `btn--${variant}`,
    size === 'small' ? 'btn--small' : '',
    className,
  ].filter(Boolean).join(' ')

  if (href.startsWith('/')) return <Link className={classes} to={href}>{children}</Link>
  return (
    <a className={classes} href={href}>
      {children}
    </a>
  )
}

export default LinkButton
