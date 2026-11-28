import { useEffect, useState } from 'react'
import { api, normalizeError } from '../services/api'

import heroIllustration from '../assets/icons/Ilustrasi=Bahan terpilah.svg'
import botolPet from '../assets/icons/Material=Botol Plastik PET.svg'
import gelasPlastik from '../assets/icons/Material=Gelas Plastik.svg'
import kardus from '../assets/icons/Material=Kardus.svg'
import koran from '../assets/icons/Material=Koran & HVS.svg'
import kaleng from '../assets/icons/Material=Kaleng Aluminium.svg'
import besi from '../assets/icons/Material=Besi Campur.svg'
import kaca from '../assets/icons/Material=Botol Kaca.svg'
import jelantah from '../assets/icons/Material=Minyak Jelantah.svg'

import '../styles/info-harga.css'

const categories = ['Semua', 'Plastik', 'Kertas', 'Logam', 'Kaca', 'Lainnya']

const materialImages = new Map([
  ['Botol Plastik PET', botolPet],
  ['Gelas Plastik', gelasPlastik],
  ['Kardus', kardus],
  ['Koran/HVS', koran],
  ['Kaleng Aluminium', kaleng],
  ['Besi Campur', besi],
  ['Botol Kaca', kaca],
  ['Minyak Jelantah', jelantah],
])

const steps = [
  {
    number: '01',
    title: 'Pilah sesuai jenis',
    description: 'Jangan mencampur plastik, kertas, logam, dan kaca dalam satu wadah.',
  },
  {
    number: '02',
    title: 'Bersihkan & keringkan',
    description: 'Kosongkan isi, bilas seperlunya, lalu pastikan sampah tidak basah.',
  },
  {
    number: '03',
    title: 'Kemas dengan aman',
    description: 'Ikat atau masukkan ke wadah terpisah agar mudah ditimbang petugas.',
  },
]

function InfoHargaPage() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('Semua')

  const [prices, setPrices] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    api.get('/jenis-sampah', { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) setPrices(data.data)
      })
      .catch(cause => {
        if (!controller.signal.aborted) setError(normalizeError(cause).message)
      })
    return () => controller.abort()
  }, [attempt])

  const filteredPrices = (prices ?? []).filter((item) => {
    const matchesSearch = item.nama.toLowerCase().includes(search.trim().toLowerCase())
    const matchesCategory =
      selectedCategory === 'Semua' || item.kategori === selectedCategory

    return matchesSearch && matchesCategory
  })

  const formatRupiah = (price) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(price)

  return (
    <main className="info-price-page">
      {/* HERO */}
      <section className="info-price-hero">
        <div className="info-price-container info-price-hero-inner">
          <div className="info-price-hero-text">
            <span className="info-price-eyebrow">
              <span>♧</span> INFORMASI SETORAN
            </span>

            <h1>
              Kenali sampahmu,
              <br />
              ketahui nilainya.
            </h1>

            <p>
              Harga yang jelas dan panduan yang tepat untuk membantu
              kamu menyiapkan setoran tanpa kebingungan.
            </p>
          </div>

          <div className="info-price-hero-image">
            <img src={heroIllustration} alt="Ilustrasi bahan sampah terpilah" />
          </div>
        </div>
      </section>

      {/* DAFTAR HARGA */}
      <section className="info-price-content">
        <div className="info-price-container">
          <div className="info-price-search">
            <span className="search-icon">⌕</span>
            <input
              type="search"
              placeholder="Cari jenis sampah, misalnya botol plastik..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Cari jenis sampah"
            />
            <button
              type="button"
              onClick={() => document.querySelector('.info-price-grid')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Mulai Cari
            </button>
          </div>

          <div className="info-price-categories">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={selectedCategory === category ? 'active' : ''}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="info-price-grid">
            {error ? (
              <div className="info-price-empty" role="alert">
                <p>{error}</p>
                <button type="button" onClick={() => {
                  setError('')
                  setAttempt(value => value + 1)
                }}>Coba lagi</button>
              </div>
            ) : prices === null ? (
              <p className="info-price-empty" role="status">Memuat daftar harga…</p>
            ) : prices.length === 0 ? (
              <p className="info-price-empty" role="status">Belum ada jenis sampah dalam katalog.</p>
            ) : filteredPrices.length > 0 ? (
              filteredPrices.map((item) => (
                <article className="info-price-card" key={item.id}>
                  <div className="info-price-card-image">
                    <img src={materialImages.get(item.nama) ?? heroIllustration} alt="" />
                  </div>

                  <div className="info-price-card-info">
                    <span className="info-price-card-category">{item.kategori}</span>
                    <h3>{item.nama}</h3>
                    <p>{item.panduan}</p>
                  </div>

                  <div className="info-price-card-value">
                    {item.harga_per_kg == null ? <strong>Harga belum ditetapkan</strong> : (
                      <>
                        <strong>{formatRupiah(item.harga_per_kg)}</strong>
                        <small>/ {item.satuan}</small>
                      </>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <div className="info-price-empty">
                <h3>Sampah tidak ditemukan</h3>
                <p>Coba gunakan kata kunci atau kategori lainnya.</p>
              </div>
            )}
          </div>

          <div className="info-price-notice">
            <span>ⓘ</span>
            Harga dapat berubah mengikuti ketentuan pengelola dan harga pengepul.
          </div>
        </div>
      </section>

      {/* PANDUAN SETORAN */}
      <section className="info-price-guide">
        <div className="info-price-container">
          <div className="info-price-guide-heading">
            <div>
              <span>PANDUAN SETORAN</span>
              <h2>Siapkan dalam 3 langkah.</h2>
            </div>

            <p>
              Sampah yang bersih dan terpilah membantu proses penimbangan
              menjadi lebih cepat dan akurat.
            </p>
          </div>

          <div className="info-price-steps">
            {steps.map((step) => (
              <article className="info-price-step" key={step.number}>
                <strong>{step.number}</strong>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

export default InfoHargaPage
