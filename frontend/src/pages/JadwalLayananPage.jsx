
import { useEffect, useState } from 'react'
import { api, normalizeError } from '../services/api'

import '../styles/jadwal-layanan.css'

const dateLabel = (value, options) => new Date(value + 'T00:00:00Z')
  .toLocaleDateString('id-ID', { ...options, timeZone: 'UTC' })

function shiftDays(value, days) {
  const date = new Date(value + 'T00:00:00Z')
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function WeeklySchedule({ dari, sampai }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      const rows = []
      for (let page = 1; ; page++) {
        const { data } = await api.get('/jadwal', {
          params: { dari, sampai, page, limit: 100 },
          signal: controller.signal,
        })
        rows.push(...data.data)
        if (page >= data.meta.total_pages) break
      }
      if (!controller.signal.aborted) setItems(rows)
    }
    load().catch(cause => {
      if (!controller.signal.aborted) setError(normalizeError(cause).message)
    })
    return () => controller.abort()
  }, [dari, sampai, attempt])

  if (error) return <div role="alert">{error} <button type="button" onClick={() => {
    setError('')
    setAttempt(value => value + 1)
  }}>Coba lagi</button></div>
  if (!items) return <p role="status">Memuat jadwal layanan…</p>
  if (!items.length) return <p role="status">Belum ada jadwal layanan untuk minggu ini.</p>

  return (
    <div className="schedule-list">
      {items.map(item => (
        <div className={`schedule-row ${item.tersedia ? '' : 'schedule-row-closed'}`} key={item.id}>
          <div className="schedule-date">
            <strong>{dateLabel(item.tanggal, { day: 'numeric' })}</strong>
            <span>{dateLabel(item.tanggal, { month: 'short' })}</span>
          </div>
          <div className="schedule-day-info">
            <h3>{dateLabel(item.tanggal, { weekday: 'long' })}</h3>
            <p>{item.nama_layanan}</p>
            {item.catatan && <p>{item.catatan}</p>}
          </div>
          <div className="schedule-time">
            <span>◷</span>
            {item.jam_mulai && item.jam_selesai
              ? `${item.jam_mulai.slice(0, 5)}–${item.jam_selesai.slice(0, 5)} WIB`
              : '—'}
          </div>
          <span className={`schedule-status ${item.tersedia ? '' : 'status-closed'}`}>
            {item.tersedia ? 'Tersedia' : 'Tutup'}
          </span>
        </div>
      ))}
    </div>
  )
}

function JadwalLayananPage() {
  const [weekOffset, setWeekOffset] = useState(0)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
  const weekday = new Date(today + 'T00:00:00Z').getUTCDay()
  const weekStart = shiftDays(today, weekOffset * 7 - (weekday + 6) % 7)
  const weekEnd = shiftDays(weekStart, 6)
  const rangeFormat = { day: 'numeric', month: 'long', year: 'numeric' }

  const changeWeek = (direction) => {
    setWeekOffset((current) => current + direction)
  }

  return (
    <main className="schedule-page">
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
          {/* WEEK NAVIGATION */}
          <div className="schedule-week-heading">
            <div>
              <span className="schedule-section-label">
                {weekOffset === 0 ? 'MINGGU INI' : 'JADWAL MINGGUAN'}
              </span>
              <h2>{dateLabel(weekStart, rangeFormat)} – {dateLabel(weekEnd, rangeFormat)}</h2>
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

          <WeeklySchedule key={weekStart} dari={weekStart} sampai={weekEnd} />

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
                  Lihat jadwal penjemputan yang tersedia di atas.
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
  )
}

export default JadwalLayananPage
