
import { useState } from 'react'
import Header from '../components/layout/Header'
import Footer from '../components/layout/Footer'
import {
  headerNavigation,
  headerActions,
  footerContent,
} from '../data/homepageData'

import '../styles/jadwal-layanan.css'

const initialMonday = new Date(2026, 5, 29)

const serviceSchedule = [
  { day: 'Senin', type: 'Penimbangan', time: '08.00–12.00', status: 'Tersedia' },
  { day: 'Selasa', type: 'Setoran umum', time: '08.00–15.00', status: 'Tersedia' },
  { day: 'Rabu', type: 'Layanan tutup', time: '—', status: 'Tutup' },
  { day: 'Kamis', type: 'Setoran umum', time: '08.00–15.00', status: 'Tersedia' },
  { day: 'Jumat', type: 'Penjemputan area A', time: '09.00–14.00', status: 'Tersedia' },
  { day: 'Sabtu', type: 'Setoran & edukasi', time: '08.00–12.00', status: 'Tersedia' },
]

const formatDate = (date) => date.toLocaleDateString('id-ID', {
  day: 'numeric',
})

const formatMonth = (date) => date.toLocaleDateString('id-ID', {
  month: 'long',
})

const formatWeekRange = (start) => {
  const end = new Date(start)
  end.setDate(start.getDate() + 5)

  if (start.getMonth() === end.getMonth()) {
    return `${formatDate(start)} – ${formatDate(end)} ${formatMonth(end)} ${end.getFullYear()}`
  }

  return `${formatDate(start)} ${formatMonth(start)} – ${formatDate(end)} ${formatMonth(end)} ${end.getFullYear()}`
}

function JadwalLayananPage() {
  const [weekOffset, setWeekOffset] = useState(0)

  const weekStart = new Date(initialMonday)
  weekStart.setDate(initialMonday.getDate() + weekOffset * 7)

  const displayedSchedule = serviceSchedule.map((item, index) => {
    const date = new Date(weekStart)
    date.setDate(weekStart.getDate() + index)

    return {
      ...item,
      date,
    }
  })

  const changeWeek = (direction) => {
    setWeekOffset((current) => current + direction)
  }

  return (
    <div className="site-shell schedule-page">
      <Header navigation={headerNavigation} actions={headerActions} />

      <main>
        {/* HERO */}
        <section className="schedule-hero">
          <div className="schedule-container schedule-hero-inner">
            <div className="schedule-hero-content">
              <span className="schedule-eyebrow">
                <span>▦</span> JADWAL LAYANAN
              </span>

              <h1>
                Atur waktu setoran
                <br />
                dengan lebih pasti.
              </h1>

              <p>
                Jadwal penyetoran, penimbangan, dan penjemputan
                yang diperbarui oleh pengurus.
              </p>
            </div>

            <div className="schedule-hero-visual" aria-hidden="true">
              <div className="schedule-orbit">
                <div className="schedule-orbit-icon icon-bottle">♧</div>
                <div className="schedule-orbit-icon icon-paper">▤</div>
                <div className="schedule-orbit-icon icon-leaf">♧</div>
                <div className="schedule-orbit-icon icon-can">▥</div>

                <div className="calendar-circle">
                  <div className="calendar-illustration">
                    <div className="calendar-rings">
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                    <div className="calendar-top" />
                    <div className="calendar-grid">
                      {Array.from({ length: 9 }).map((_, index) => (
                        <span
                          className={index === 4 ? 'calendar-checked' : ''}
                          key={index}
                        >
                          {index === 4 ? '✓' : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CONTENT */}
        <section className="schedule-content">
          <div className="schedule-container">
            {/* ANNOUNCEMENT */}
            <div className="schedule-announcement">
              <div className="announcement-icon">ⓘ</div>
              <div>
                <h3>Perubahan jadwal Rabu, 1 Juli</h3>
                <p>
                  Layanan ditutup sementara untuk kegiatan desa.
                  Setoran kembali dibuka Kamis, 2 Juli pukul 08.00 WIB.
                </p>
                <small>Diperbarui 27 Juni 2026, 14.30 WIB</small>
              </div>
            </div>

            {/* WEEK NAVIGATION */}
            <div className="schedule-week-heading">
              <div>
                <span className="schedule-section-label">
                  {weekOffset === 0 ? 'MINGGU INI' : 'JADWAL MINGGUAN'}
                </span>
                <h2>{formatWeekRange(weekStart)}</h2>
              </div>

              <div className="week-navigation">
                <button
                  type="button"
                  onClick={() => changeWeek(-1)}
                  aria-label="Minggu sebelumnya"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => changeWeek(1)}
                  aria-label="Minggu berikutnya"
                >
                  ›
                </button>
              </div>
            </div>

            {/* SCHEDULE LIST */}
            <div className="schedule-list">
              {displayedSchedule.map((item) => (
                <div
                  className={`schedule-row ${item.status === 'Tutup' ? 'schedule-row-closed' : ''}`}
                  key={item.day}
                >
                  <div className="schedule-date">
                    <strong>{formatDate(item.date)}</strong>
                    <span>{formatMonth(item.date).slice(0, 3)}</span>
                  </div>

                  <div className="schedule-day-info">
                    <h3>{item.day}</h3>
                    <p>{item.type}</p>
                  </div>

                  <div className="schedule-time">
                    <span>◷</span>
                    {item.time}
                  </div>

                  <span
                    className={`schedule-status ${item.status === 'Tutup' ? 'status-closed' : ''}`}
                  >
                    {item.status}
                  </span>
                </div>
              ))}
            </div>

            {/* SERVICE INFORMATION */}
            <div className="schedule-service-cards">
              <article className="schedule-service-card">
                <div className="service-card-icon">▤</div>
                <div className="service-card-content">
                  <h3>Setoran langsung</h3>
                  <p>
                    Datang ke Bank Sampah Rahayu pada jadwal tersedia.
                    Bawa sampah yang sudah dipilah, bersih, dan kering.
                  </p>
                  <span className="service-info-pill">
                    ♧ &nbsp; Jl. Melati No. 18, Mojoroto
                  </span>
                </div>
              </article>

              <article className="schedule-service-card">
                <div className="service-card-icon">♧</div>
                <div className="service-card-content">
                  <h3>Layanan penjemputan</h3>
                  <p>
                    Penjemputan area A dilakukan setiap Jumat.
                    Hubungi pengurus paling lambat satu hari sebelumnya.
                  </p>
                  <span className="service-info-pill">
                    ◇ &nbsp; Minimal setoran 10 kg
                  </span>
                </div>
              </article>
            </div>
          </div>
        </section>
      </main>

      <Footer {...footerContent} />
    </div>
  )
}

export default JadwalLayananPage
