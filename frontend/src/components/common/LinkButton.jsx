function LinkButton({ href, variant = 'primary', size = 'default', children, className = '' }) {
  const classes = [
    'btn',
    `btn--${variant}`,
    size === 'small' ? 'btn--small' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <a className={classes} href={href}>
      {children}
    </a>
  )
}

export default LinkButton
