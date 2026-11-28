import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import JadwalLayananPage from '../pages/JadwalLayananPage'
import { api } from '../services/api'

test('menampilkan hasil API sesuai minggu WIB yang dipilih nasabah', async () => {
  // Senin dini hari di Jakarta, masih Minggu di UTC.
  vi.setSystemTime(new Date('2026-11-22T18:00:00Z'))
  const get = vi.spyOn(api, 'get')
    .mockResolvedValueOnce({ data: { data: [], meta: { total_pages: 0 } } })
    .mockResolvedValueOnce({ data: {
      data: [{ id: '9', tanggal: '2026-12-06', nama_layanan: 'Penjemputan',
        jam_mulai: null, jam_selesai: null, tersedia: false, catatan: 'Kendaraan diservis' }],
      meta: { total_pages: 1 },
    } })

  render(<MemoryRouter><JadwalLayananPage /></MemoryRouter>)
  expect(await screen.findByText('Belum ada jadwal layanan untuk minggu ini.')).toBeVisible()
  expect(get.mock.calls[0][1].params).toMatchObject({ dari: '2026-11-23', sampai: '2026-11-29' })

  fireEvent.click(screen.getByRole('button', { name: 'Minggu berikutnya' }))
  expect(await screen.findByText('Kendaraan diservis')).toBeVisible()
  expect(screen.getByText('Tutup')).toBeVisible()
  expect(screen.getByRole('heading', { name: 'Minggu' })).toBeVisible()
  expect(get.mock.calls[1][1].params).toMatchObject({ dari: '2026-11-30', sampai: '2026-12-06' })
})
