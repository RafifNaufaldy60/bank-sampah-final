
import { useState } from 'react'
import Header from '../components/layout/Header'
import Footer from '../components/layout/Footer'
import {
  headerNavigation,
  headerActions,
  footerContent,
} from '../data/homepageData'

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

const wastePrices = [
  { name: 'Botol Plastik PET', category: 'Plastik', price: 4200, unit: 'kg', image: botolPet, description: 'Bersih, kering, tanpa tutup' },
  { name: 'Gelas Plastik', category: 'Plastik', price: 3200, unit: 'kg', image: gelasPlastik, description: 'Pisahkan label dan sedotan' },
  { name: 'Kardus', category: 'Kertas', price: 2800, unit: 'kg', image: kardus, description: 'Lipat dan ikat, kondisi kering' },
  { name: 'Koran & HVS', category: 'Kertas', price: 3000, unit: 'kg', image: koran, description: 'Tidak basah atau berminyak' },
  { name: 'Kaleng Aluminium', category: 'Logam', price: 10500, unit: 'kg', image: kaleng, description: 'Kosongkan, bilas, dan pipihkan' },
  { name: 'Besi Campur', category: 'Logam', price: 4500, unit: 'kg', image: besi, description: 'Bebas dari material berbahaya' },
  { name: 'Botol Kaca', category: 'Kaca', price: 1200, unit: 'kg', image: kaca, description: 'Utuh, bersih, tanpa tutup' },
  { name: 'Minyak Jelantah', category: 'Lainnya', price: 6000, unit: 'liter', image: jelantah, description: 'Simpan dalam botol tertutup' },
]

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

  const filteredPrices = wastePrices.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory =
      selectedCategory === 'Semua' || item.category === selectedCategory

    return matchesSearch && matchesCategory
  })

  const formatRupiah = (price) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(price)

  return (
    <div className="site-shell info-price-page">
      <Header navigation={headerNavigation} actions={headerActions} />

      <main>
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
              {filteredPrices.length > 0 ? (
                filteredPrices.map((item) => (
                  <article className="info-price-card" key={item.name}>
                    <div className="info-price-card-image">
                      <img src={item.image} alt={item.name} />
                    </div>

                    <div className="info-price-card-info">
                      <span className="info-price-card-category">{item.category}</span>
                      <h3>{item.name}</h3>
                      <p>{item.description}</p>
                    </div>

                    <div className="info-price-card-value">
                      <strong>{formatRupiah(item.price)}</strong>
                      <small>/ {item.unit}</small>
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

      <Footer {...footerContent} />
    </div>
  )
}

export default InfoHargaPage
