import person from '../../assets/auth/person.svg'
import manager from '../../assets/auth/manager.svg'
import selected from '../../assets/auth/selected.svg'
import registerManager from '../../assets/auth/register-manager.svg'

export default function RolePicker({ value, onChange, disabled, registration }) {
  return <fieldset className="auth-role-picker" disabled={disabled}>
    <legend className={registration ? '' : 'sr-only'}>{registration ? 'Daftar sebagai' : 'Pilih peran'}</legend>
    {registration && <p>Pilih jenis akun yang sesuai dengan peranmu.</p>}
    <div className="auth-role-options">{[['nasabah', 'Nasabah', 'Penyetor Sampah', person], ['pengelola', 'Pengelola', 'Admin Bank Sampah', registration ? registerManager : manager]].map(([role, title, detail, icon]) => <label className={`auth-role ${value === role ? 'is-selected' : ''}`} key={role}>
      <input type="radio" name="peran" value={role} checked={value === role} onChange={() => onChange(role)} />
      <span className="auth-role-icon"><img src={icon} alt="" /></span><span className="auth-role-text"><b>{title}</b><small>{detail}</small></span>
      {value === role ? <img src={selected} alt="" /> : <span className="auth-radio-empty" />}
    </label>)}</div>
  </fieldset>
}
