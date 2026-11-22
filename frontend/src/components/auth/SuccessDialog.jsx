import { useEffect, useRef } from 'react'
import loginCustomer from '../../assets/auth/success-0.svg'
import loginManager from '../../assets/auth/success-1.svg'
import registerCustomer from '../../assets/auth/success-2.svg'
import registerManager from '../../assets/auth/success-3.svg'

export default function SuccessDialog({ type, peran, onClose }) {
  const ref = useRef(null)
  const registration = type === 'register'
  const manager = peran === 'pengelola'
  useEffect(() => {
    const dialog = ref.current
    const previous = document.activeElement
    dialog.showModal()
    return () => { dialog.close(); if (previous?.isConnected) previous.focus() }
  }, [])
  return <dialog ref={ref} className="auth-dialog" aria-labelledby="success-title" aria-describedby="success-description" onCancel={event => { event.preventDefault(); onClose() }}>
    <button className="dialog-close" aria-label="Tutup pemberitahuan" onClick={onClose}>×</button>
    <img src={registration ? manager ? registerManager : registerCustomer : manager ? loginManager : loginCustomer} alt="" />
    <h2 id="success-title">{registration ? 'Pendaftaran Berhasil!' : 'Selamat Datang Kembali!'}</h2>
    <div id="success-description">{registration
      ? manager ? <p>Pendaftaran berhasil. Akun Anda menunggu persetujuan ketua.</p> : <><p>Akun nasabah berhasil dibuat.</p><p>Selamat bergabung dengan Bank Sampah Desa!</p></>
      : <p>{manager ? 'Selamat datang kembali. Kamu berhasil masuk ke akun pengelola Bank Sampah Desa.' : 'Kamu berhasil masuk ke akun nasabah Bank Sampah Desa.'}</p>}</div>
    {registration && <button className="dialog-login" onClick={onClose}>Lanjut ke halaman masuk</button>}
  </dialog>
}
