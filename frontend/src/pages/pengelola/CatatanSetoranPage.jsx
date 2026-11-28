import { useEffect, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { api, normalizeError, session } from '../../services/api'
import { sessionInvalidated } from '../../features/auth/authSlice'
import { rupiah } from '../../components/pengelola/format'
import '../../styles/catatan-setoran.css'

const todayJakarta = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date())

function normalizeWeight(value) {
  const normalized = value.trim().replace(',', '.')
  if (!/^\d{1,9}(?:\.\d{1,3})?$/.test(normalized)) return null
  const [whole, fraction = ''] = normalized.split('.')
  const milli = BigInt(whole) * 1000n + BigInt((fraction + '000').slice(0, 3))
  return milli > 0n ? milli : null
}

function previewTotal(milli, price) {
  if (milli === null || price === null) return null
  try {
    const p = BigInt(String(price).split('.')[0])
    const amount = (milli * p + 500n) / 1000n
    return amount.toString()
  } catch {
    return null
  }
}

function formatWeight(milli) {
  const whole = milli / 1000n
  const fraction = (milli % 1000n).toString().padStart(3, '0').replace(/0+$/, '')
  return fraction ? `${whole}.${fraction.padEnd(3, '0')}` : whole.toString()
}

export default function CatatanSetoranPage() {
  const dispatch = useDispatch(), navigate = useNavigate()
  const [customers, setCustomers] = useState([])
  const [customerMeta, setCustomerMeta] = useState({ page: 1, total_pages: 0 })
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [open, setOpen] = useState(false)
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [customerError, setCustomerError] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [types, setTypes] = useState([])
  const [typesLoading, setTypesLoading] = useState(true)
  const [typesError, setTypesError] = useState('')
  const [typeId, setTypeId] = useState('')
  const [weightText, setWeightText] = useState('')
  const [date, setDate] = useState(todayJakarta())
  const [price, setPrice] = useState(null)
  const [priceLoading, setPriceLoading] = useState(false)
  const [priceError, setPriceError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [success, setSuccess] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})
  const idempotencyKey = useRef(null)
  const customerRequest = useRef(null)
  const typesRequest = useRef(null)
  const priceRequest = useRef(null)
  const debounce = useRef(null)
  const combobox = useRef(null)
  const popup = useRef(null)
  const mounted = useRef(true)

  async function loadCustomers(term = '', page = 1, append = false) {
    if (customerRequest.current) customerRequest.current.abort()
    const controller = new AbortController()
    customerRequest.current = controller
    setLoadingCustomers(true); setCustomerError('')
    try {
      const params = { page: String(page), limit: '20' }
      if (term.trim()) params.search = term.trim()
      const response = await api.get('/nasabah', { params, signal: controller.signal })
      if (!mounted.current) return
      const rows = Array.isArray(response?.data?.data) ? response.data.data : []
      setCustomers(previous => append ? [...previous, ...rows] : rows)
      setCustomerMeta(response?.data?.meta || { page: 1, total_pages: 0 })
      setActiveIndex(-1)
    } catch (error) {
      if (!mounted.current) return
      if (controller.signal.aborted) return
      handleSessionError(error)
      setCustomerError(normalizeError(error).message)
    } finally {
      if (customerRequest.current === controller) {
        customerRequest.current = null
        if (mounted.current) setLoadingCustomers(false)
      }
    }
  }

  function handleSessionError(error) {
    if (error.response?.status === 401) {
      session.clear(); dispatch(sessionInvalidated()); navigate('/login', { replace: true })
    }
    if (error.response?.status === 403) navigate('/akun', { replace: true })
  }

  async function loadTypes() {
    if (typesRequest.current) typesRequest.current.abort()
    const controller = new AbortController()
    typesRequest.current = controller
    setTypesLoading(true); setTypesError('')
    try {
      const response = await api.get('/jenis-sampah', { signal: controller.signal })
      if (!mounted.current) return
      setTypes(Array.isArray(response?.data?.data) ? response.data.data : [])
    } catch (error) {
      if (!mounted.current) return
      if (controller.signal.aborted) return
      if (error.code === 'ERR_CANCELED') return
      handleSessionError(error)
      setTypesError(normalizeError(error).message)
    } finally {
      if (typesRequest.current === controller) typesRequest.current = null
      if (mounted.current) setTypesLoading(false)
    }
  }

  useEffect(() => {
    mounted.current = true
    loadTypes()
    return () => {
      mounted.current = false
      clearTimeout(debounce.current)
      customerRequest.current?.abort()
      typesRequest.current?.abort()
      priceRequest.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (!open) return
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => loadCustomers(search, 1, false), 300)
  }, [search, open])

  useEffect(() => {
    if (!open) return
    function outside(event) {
      if (!popup.current?.contains(event.target) && !combobox.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [open])

  useEffect(() => {
    if (!typeId) { setPrice(null); setPriceError(''); return }
    if (priceRequest.current) priceRequest.current.abort()
    const controller = new AbortController()
    priceRequest.current = controller
    setPriceLoading(true); setPrice(null); setPriceError('')
    async function loadPrice() {
      try {
        const response = await api.get(`/jenis-sampah/${typeId}/harga`, { params: { tanggal: date }, signal: controller.signal })
        if (controller.signal.aborted) return
        const item = response.data.data
        if (item.status_tarif === 'tersedia' && item.harga_per_kg) setPrice(item.harga_per_kg)
        else setPriceError('Harga untuk jenis dan tanggal ini belum ditetapkan.')
      } catch (error) {
        if (controller.signal.aborted) return
        if (error.code === 'ERR_CANCELED') return
        handleSessionError(error)
        setPriceError(normalizeError(error).message)
      } finally {
        if (priceRequest.current === controller) { priceRequest.current = null; setPriceLoading(false) }
      }
    }
    loadPrice()
  }, [typeId, date])

  function chooseCustomer(customer) {
    setSelected(customer)
    setSearch(customer.nama)
    setOpen(false)
    setActiveIndex(-1)
  }

  function changeSearch(value) {
    setSearch(value)
    setOpen(true)
    if (selected) setSelected(null)
  }

  function clearCustomer() {
    setSelected(null); setSearch(''); setOpen(true)
  }

  function keyboard(event) {
    if (!open && ['ArrowDown', 'ArrowUp'].includes(event.key)) { setOpen(true); event.preventDefault(); return }
    if (event.key === 'Escape') { setOpen(false); setActiveIndex(-1); return }
    if (!open) return
    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex(index => Math.min(index + 1, customers.length - 1)) }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex(index => Math.max(index - 1, 0)) }
    if (event.key === 'Enter' && activeIndex >= 0) { event.preventDefault(); chooseCustomer(customers[activeIndex]) }
  }

  async function save(event) {
    event.preventDefault()
    if (saving) return
    const errors = {}
    if (!selected) errors.customer = 'Pilih nasabah dari daftar.'
    if (!typeId) errors.type = 'Pilih jenis sampah.'
    const milli = normalizeWeight(weightText)
    if (!milli) errors.weight = 'Berat harus positif, maksimal 3 desimal dan kurang dari 1 miliar kg.'
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.date = 'Pilih tanggal yang valid.'
    else if (date > todayJakarta()) errors.date = 'Tanggal setoran tidak boleh di masa depan.'
    if (price === null) errors.price = 'Harga yang tersedia diperlukan sebelum menyimpan.'
    setFieldErrors(errors); setSaveError('')
    if (Object.keys(errors).length) return
    if (!idempotencyKey.current) idempotencyKey.current = crypto.randomUUID()
    setSaving(true)
    try {
      const response = await api.post('/setoran', {
        nasabah_id: selected.id,
        tanggal_setoran: date,
        pengajuan_penjemputan_id: null,
        rincian: [{ jenis_sampah_id: Number(typeId), berat_kg: formatWeight(milli) }],
      }, { headers: { 'Idempotency-Key': idempotencyKey.current } })
      setSuccess(response.data.data)
      setSelected(null); setSearch(''); setTypeId(''); setWeightText(''); setDate(todayJakarta())
      setPrice(null); setFieldErrors({}); idempotencyKey.current = null
    } catch (error) {
      if (error.response?.status === 401) { handleSessionError(error); return }
      setSaveError(normalizeError(error).message)
    } finally { setSaving(false) }
  }

  const milli = normalizeWeight(weightText)
  const total = previewTotal(milli, price)
  const selectedType = types.find(item => String(item.id) === String(typeId))
  const canLoadMore = customerMeta.page < customerMeta.total_pages

  return <div className="catatan-setoran-page">
    {success && <div className="deposit-success" role="status"><strong>Setoran berhasil disimpan</strong><span>{success.kode_setoran} — {rupiah(success.nilai_setoran_rp)}</span><button type="button" aria-label="Tutup notifikasi sukses" onClick={() => setSuccess(null)}>×</button></div>}
    <div className="deposit-grid">
      <form id="deposit-form" className="deposit-form" onSubmit={save} noValidate>
        <section className="deposit-card" aria-labelledby="customer-title">
          <header className="deposit-card-title"><span>1</span><div><h2 id="customer-title">Data nasabah</h2><p>Pilih nasabah yang melakukan setoran.</p></div></header>
          <div className="deposit-field customer-combobox">
            <label htmlFor="customer-search">Cari nama / ID nasabah</label>
            <div ref={combobox} className="customer-input-wrap">
              <input id="customer-search" role="combobox" aria-expanded={open} aria-controls="customer-options" aria-autocomplete="list" aria-activedescendant={activeIndex >= 0 ? `customer-option-${activeIndex}` : undefined}
                value={search} onFocus={() => setOpen(true)} onChange={event => changeSearch(event.target.value)} onKeyDown={keyboard} placeholder="Cari nama atau ID nasabah" maxLength={100} />
              {selected && <button type="button" className="customer-clear" aria-label="Hapus pilihan nasabah" onClick={clearCustomer}>×</button>}
            </div>
            {open && <div ref={popup} className="customer-popup" id="customer-options" role="listbox">
              {loadingCustomers && <p className="customer-message" role="status">Memuat daftar nasabah…</p>}
              {!loadingCustomers && customerError && <div className="customer-message" role="alert"><span>{customerError}</span><button type="button" onClick={() => loadCustomers(search, 1, false)}>Coba lagi</button></div>}
              {!loadingCustomers && !customerError && customers.length === 0 && <p className="customer-message">{search.trim() ? 'Tidak ada nasabah yang cocok.' : 'Belum ada nasabah terdaftar.'}</p>}
              {!loadingCustomers && customers.map((customer, index) => <button type="button" role="option" aria-selected={index === activeIndex} id={`customer-option-${index}`} className={index === activeIndex ? 'active' : ''} key={customer.id} onMouseDown={event => event.preventDefault()} onClick={() => chooseCustomer(customer)}>
                <strong>{customer.nama}</strong><span>{customer.kode_akun}</span>
              </button>)}
              {!loadingCustomers && canLoadMore && <button type="button" className="load-more" onClick={() => loadCustomers(search, customerMeta.page + 1, true)}>Muat lebih banyak</button>}
            </div>}
            {fieldErrors.customer && <p className="field-error" role="alert">{fieldErrors.customer}</p>}
            <label htmlFor="customer-id">ID Nasabah</label>
            <input id="customer-id" value={selected?.kode_akun || ''} readOnly placeholder="Dipilih otomatis" />
          </div>
        </section>
        <section className="deposit-card" aria-labelledby="detail-title">
          <header className="deposit-card-title"><span>2</span><div><h2 id="detail-title">Detail penimbangan</h2><p>Masukkan jenis dan berat hasil timbangan.</p></div></header>
          <div className="deposit-field">
            <label htmlFor="waste-type">Jenis sampah</label>
            {typesLoading ? <p className="field-state" role="status">Memuat jenis sampah…</p> : typesError ? <div className="field-state field-error" role="alert">{typesError} <button type="button" onClick={loadTypes}>Coba lagi</button></div> :
              <select id="waste-type" value={typeId} onChange={event => { setTypeId(event.target.value); setFieldErrors(previous => ({ ...previous, type: undefined })); }}>
                <option value="">Pilih jenis sampah</option>{types.map(item => <option key={item.id} value={item.id}>{item.nama}</option>)}
              </select>}
            {fieldErrors.type && <p className="field-error" role="alert">{fieldErrors.type}</p>}
            <div className="detail-row">
              <div><label htmlFor="weight">Berat hasil timbangan (kg)</label><input id="weight" inputMode="decimal" value={weightText} onChange={event => setWeightText(event.target.value)} placeholder="Contoh: 5" />{fieldErrors.weight && <p className="field-error" role="alert">{fieldErrors.weight}</p>}</div>
              <div><label htmlFor="unit-price">Harga satuan / kg</label><input id="unit-price" value={priceLoading ? 'Memuat…' : price ? rupiah(price) : ''} readOnly placeholder="Dipilih otomatis" />{priceError && <p className="field-error" role="alert">{priceError}</p>}{fieldErrors.price && <p className="field-error" role="alert">{fieldErrors.price}</p>}</div>
            </div>
            <label htmlFor="deposit-date">Tanggal setoran</label>
            <input id="deposit-date" type="date" max={todayJakarta()} value={date} onChange={event => setDate(event.target.value)} />{fieldErrors.date && <p className="field-error" role="alert">{fieldErrors.date}</p>}
          </div>
        </section>
        {saveError && <p className="save-error" role="alert">{saveError}</p>}
      </form>
      <aside className="deposit-summary" aria-labelledby="summary-title">
        <h2 id="summary-title">Ringkasan setoran</h2>
        <dl><div><dt>Nasabah</dt><dd>{selected?.nama || 'Belum dipilih'}</dd></div><div><dt>ID nasabah</dt><dd>{selected?.kode_akun || '-'}</dd></div><div><dt>Jenis sampah</dt><dd>{selectedType?.nama || 'Belum dipilih'}</dd></div><div><dt>Berat</dt><dd>{milli ? `${(Number(milli) / 1000).toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} kg` : '-'}</dd></div><div><dt>Harga satuan</dt><dd>{price ? rupiah(price) : '-'}</dd></div></dl>
        <div className="deposit-total"><span>Total setoran</span><strong>{total ? rupiah(total) : '-'}</strong></div>
        <button className="deposit-save" type="submit" form="deposit-form" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan transaksi'}</button>
        <p className="deposit-note"><span>i</span> Pastikan data setoran sudah sesuai sebelum disimpan.</p>
      </aside>
    </div>
  </div>
}
