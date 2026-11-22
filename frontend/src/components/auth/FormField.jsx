import { useState } from 'react'

export default function FormField({ label, id, type = 'text', ...props }) {
  const [visible, setVisible] = useState(false)
  return <div className="auth-field"><label htmlFor={id}>{label}</label><div className="auth-input-wrap">
    <input id={id} type={type === 'password' && visible ? 'text' : type} {...props} />
    {type === 'password' && <button className="password-toggle" type="button" aria-label={`${visible ? 'Sembunyikan' : 'Tampilkan'} ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? 'Sembunyikan' : 'Lihat'}</button>}
  </div></div>
}
