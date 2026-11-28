import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import InfoHargaPage from '../pages/InfoHargaPage'
import { api } from '../services/api'

test('menampilkan tarif API dan memfilter katalog termasuk jenis tanpa harga', async () => {
  const get = vi.spyOn(api, 'get').mockResolvedValue({ data: { data: [
    { id: 1, nama: 'Botol Plastik PET', kategori: 'Plastik', harga_per_kg: '5125', satuan: 'kg' },
    { id: 12, nama: 'Kertas Arsip', kategori: 'Kertas', harga_per_kg: null, satuan: 'kg' },
  ] } })
  render(<MemoryRouter><InfoHargaPage /></MemoryRouter>)
  expect(await screen.findByText(/Rp\s*5\.125/)).toBeVisible()
  expect(screen.getByText('/ kg')).toBeVisible()
  expect(get).toHaveBeenCalledWith('/jenis-sampah', expect.anything())
  fireEvent.click(screen.getByRole('button', { name: 'Kertas' }))
  expect(screen.queryByText('Botol Plastik PET')).toBeNull()
  expect(screen.getByText('Kertas Arsip')).toBeVisible()
  expect(screen.getByText('Harga belum ditetapkan')).toBeVisible()
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'kaca' } })
  expect(screen.getByText('Sampah tidak ditemukan')).toBeVisible()
})
