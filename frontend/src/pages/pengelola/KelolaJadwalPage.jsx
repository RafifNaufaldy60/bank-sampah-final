import { useEffect, useRef, useState } from 'react'
import { Link, useBeforeUnload, useBlocker, useFetcher, useLoaderData, useLocation, useNavigate, useNavigation, useRevalidator } from 'react-router-dom'
import { scheduleBase, parseSchedule } from '../../router/schedules'
import info from '../../assets/schedules/info.svg'
import plus from '../../assets/schedules/plus.svg'
import close from '../../assets/schedules/close.svg'
import clock from '../../assets/schedules/clock.svg'
import clockFirst from '../../assets/schedules/clock-first.svg'
import '../../styles/schedules.css'
const date = (value, options = { day: 'numeric', month: 'long', year: 'numeric' }) => value ? new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', ...options }).format(new Date(`${value}T00:00:00+07:00`)) : 'Tanpa batas'
const hours = row => row.jam_mulai && row.jam_selesai ? `${row.jam_mulai.slice(0,5).replace(':','.') }–${row.jam_selesai.slice(0,5).replace(':','.')}` : '—'
function Confirm({ message, accept, cancel, busy = false }) {
  const dialog = useRef()
  useEffect(() => { const node = dialog.current; const previous = document.activeElement; node.showModal(); return () => { node.close(); previous?.focus() } }, [])
  return <dialog className="schedule-dialog" ref={dialog} aria-label="Konfirmasi perubahan" onCancel={event => { event.preventDefault(); if (!busy) cancel() }}><h2>Konfirmasi</h2><p>{message}</p><div><button className="dashboard-button" onClick={cancel} disabled={busy}>Batal</button><button className="schedule-save" onClick={accept} disabled={busy}>Lanjutkan</button></div></dialog>
}
function ScheduleList({ data, readOnly = false }) {
  const fetcher = useFetcher(), navigate = useNavigate(), navigation = useNavigation()
  const revalidator = useRevalidator(), [acknowledged, setAcknowledged] = useState(null)
  const [target, setTarget] = useState(null), sending = useRef(false)
  const busy = fetcher.state !== 'idle' || navigation.state !== 'idle' || revalidator.state !== 'idle'
  const uncertain = fetcher.data?.uncertain && acknowledged !== fetcher.data
  useEffect(() => { if (fetcher.state === 'idle') sending.current = false }, [fetcher.state, fetcher.data])
  const { list, query } = data
  function page(value) { const params = new URLSearchParams(query); params.set('page', value); navigate(`?${params}`) }
  function period(value) {
    if (!value) { navigate('?'); return }
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date())
    const start = new Date(`${list.meta.dari || today}T00:00:00Z`); start.setUTCDate(start.getUTCDate() - ((start.getUTCDay()+6)%7) + Number(value)*7)
    const end = new Date(start); end.setUTCDate(end.getUTCDate()+6)
    navigate(`?dari=${start.toISOString().slice(0,10)}&sampai=${end.toISOString().slice(0,10)}`)
  }
  function toggle() {
    if (sending.current || busy) return
    sending.current = true
    fetcher.submit({ intent: 'toggle', id: target.id, tersedia: String(!target.tersedia) }, { method: 'post', action: scheduleBase })
    setTarget(null)
  }
  return <section className="schedule-panel" aria-label="Daftar jadwal" aria-busy={busy}>
    <header><div><h2>{new URLSearchParams(query).has('dari') ? 'Jadwal layanan' : 'Jadwal minggu ini'}</h2><p>{date(list.meta.dari)} – {date(list.meta.sampai)}</p></div>{!readOnly && <label><span className="sr-only">Periode jadwal</span><select value={new URLSearchParams(query).has('dari') ? 'custom' : ''} onChange={event => period(event.target.value)}><option value="">Minggu ini</option><option value="-1">Minggu sebelumnya</option><option value="1">Minggu berikutnya</option>{new URLSearchParams(query).has('dari') && <option value="custom">Periode dipilih</option>}</select></label>}</header>
    {fetcher.data?.error && <p className="schedule-message" role="alert">{fetcher.data.error}{uncertain && <> Hasil belum pasti. <button className="dashboard-button" disabled={busy} onClick={async () => { await revalidator.revalidate(); setAcknowledged(fetcher.data) }}>Muat ulang daftar</button> sebelum mencoba kembali.</>}</p>}
    {fetcher.data?.success && <p className="schedule-message" role="status">{fetcher.data.success}</p>}
    {!list.data.length && <p className="schedule-message">Belum ada jadwal pada periode ini.</p>}
    {list.data.map((row, i) => <div className="schedule-row" key={row.id}><div className="schedule-day"><strong>{date(row.tanggal, { day: '2-digit' })}</strong><small>{date(row.tanggal, { month: 'short' })}</small></div><div><strong>{date(row.tanggal, { weekday: 'long' })}</strong><small>{data.services.find(service => service.kode === row.layanan_kode)?.nama || row.nama_layanan}{!row.tersedia && ' · Tutup'}</small></div><p className="schedule-hours"><img src={i === 0 ? clockFirst : clock} alt="" />{hours(row)} <span className="sr-only">WIB</span></p>{!readOnly && <><button className="schedule-switch" type="button" role="switch" aria-checked={row.tersedia} aria-label={`${row.tersedia ? 'Nonaktifkan' : 'Aktifkan'} ${row.nama_layanan}, ${date(row.tanggal)}`} disabled={busy || uncertain} onClick={() => setTarget(row)} /><Link className="dashboard-button" to={`${scheduleBase}/${row.id}/edit`}>Ubah<span className="sr-only"> {row.nama_layanan}, {date(row.tanggal)}</span></Link></>}</div>)}
    {!readOnly && list.meta.total_pages > 1 && <footer><button className="dashboard-button" disabled={busy || list.meta.page <= 1} onClick={() => page(list.meta.page-1)}>Sebelumnya</button><span aria-current="page">{list.meta.page} / {list.meta.total_pages}</span><button className="dashboard-button" disabled={busy || list.meta.page >= list.meta.total_pages} onClick={() => page(list.meta.page+1)}>Berikutnya</button></footer>}
    {target && <Confirm message={`${target.tersedia ? 'Nonaktifkan' : 'Aktifkan'} ${target.nama_layanan} pada ${date(target.tanggal)}, ${hours(target)} WIB? Pengajuan terkait tetap disimpan.`} accept={toggle} cancel={() => setTarget(null)} />}
  </section>
}
export default function KelolaJadwalPage({ form = false }) {
  const data = useLoaderData(), location = useLocation()
  return <div className="schedule-page"><div className="schedule-toolbar"><div className="schedule-info"><img src={info} alt="" /><div><strong>Jadwal layanan nasabah</strong><p>Status ketersediaan tersimpan pada jadwal layanan.</p></div></div>{form ? <Link className="schedule-add" to={scheduleBase}><img src={close} alt="" />Tutup</Link> : <><Link className="dashboard-button" to={`${scheduleBase}/pengajuan-penjemputan`}>Pengajuan penjemputan</Link><Link className="schedule-add" to={`${scheduleBase}/tambah`}><img src={plus} alt="" />Tambah jadwal</Link></>}</div>
    {location.state?.scheduleSuccess && <p className="schedule-message" role="status">Jadwal berhasil disimpan.</p>}
    {form && <ScheduleForm key={data.detail?.id || 'new'} data={data} />}
    <ScheduleList data={data} readOnly={form} />
  </div>
}
function ScheduleForm({ data }) {
  const fetcher = useFetcher(), navigate = useNavigate(), element = useRef(), sending = useRef(false)
  const initial = { tanggal: data.detail?.tanggal || '', layanan_kode: data.detail?.layanan_kode || '', jam: data.detail ? hours(data.detail).replace('—','') : '' }
  const [value, setValue] = useState(initial), [errors, setErrors] = useState({})
  const busy = fetcher.state !== 'idle', success = !!fetcher.data?.success
  const dirty = JSON.stringify(value) !== JSON.stringify(initial)
  const blocker = useBlocker(({ currentLocation, nextLocation }) => !success && dirty && currentLocation.pathname !== nextLocation.pathname)
  useBeforeUnload(event => { if (dirty && !success) { event.preventDefault(); event.returnValue = '' } })
  useEffect(() => { if (fetcher.state === 'idle') sending.current = false; if (success) navigate(`${scheduleBase}?dari=${fetcher.data.tanggal}&sampai=${fetcher.data.tanggal}`, { replace: true, state: { scheduleSuccess: true } }) }, [fetcher.state, fetcher.data, success, navigate])
  function submit(event) {
    event.preventDefault(); if (busy || sending.current || fetcher.data?.uncertain) return
    const form = new FormData(element.current), parsed = parseSchedule(form, data.services, data.detail?.tersedia ?? true)
    setErrors(parsed.errors)
    const first = Object.keys(parsed.errors)[0]
    if (first) { element.current.elements.namedItem(first)?.focus(); return }
    sending.current = true; fetcher.submit(form, { method: 'post' })
  }
  const allErrors = { ...fetcher.data?.errors, ...errors }
  return <section><h2 className="schedule-form-title">{data.detail ? 'Edit jadwal' : 'Tambah jadwal'}</h2><form ref={element} className="schedule-form" onSubmit={submit} noValidate>
    {['tanggal', 'layanan_kode', 'jam'].map((name, i) => <div className="schedule-field" key={name}><label htmlFor={`schedule-${name}`}>{['Tanggal','Jenis layanan','Jam layanan (WIB)'][i]}</label>{name === 'layanan_kode' ? <select id={`schedule-${name}`} name={name} required value={value[name]} disabled={busy} aria-invalid={!!allErrors[name]} aria-describedby={allErrors[name] ? `error-${name}` : undefined} onChange={e => setValue({ ...value, [name]: e.target.value })}><option value="">Pilih jenis layanan</option>{data.services.map(service => <option key={service.kode} value={service.kode}>{service.nama}</option>)}</select> : <input id={`schedule-${name}`} name={name} type={name === 'tanggal' ? 'date' : 'text'} placeholder={name === 'jam' ? '08.00–15.00' : undefined} value={value[name]} disabled={busy} aria-invalid={!!allErrors[name]} aria-describedby={allErrors[name] ? `error-${name}` : undefined} onChange={e => setValue({ ...value, [name]: e.target.value })} />}{allErrors[name] && <span id={`error-${name}`} role="alert">{allErrors[name]}</span>}</div>)}
    <button className="schedule-save" disabled={busy || success || fetcher.data?.uncertain || !data.services.length}>{busy ? 'Menyimpan…' : 'Simpan jadwal'}</button>
    {fetcher.data?.error && <p className="schedule-form-error" role="alert">{fetcher.data.error}{fetcher.data.uncertain && ' Hasil belum pasti. Kembali ke daftar untuk memeriksa sebelum membuat jadwal lagi.'}</p>}
  </form>{blocker.state === 'blocked' && <Confirm message="Perubahan belum disimpan. Tinggalkan halaman ini?" accept={() => blocker.proceed()} cancel={() => blocker.reset()} />}</section>
}
