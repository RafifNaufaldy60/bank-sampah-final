// API fixture only: never imported by application code or sent to Neon.
export const manager = { id: '9007199254740993', nama: 'Nama Dari Backend', email: 'uji@example.test', peran: 'pengelola', is_ketua: true, aktif: true, status_akun: 'active' }
export const summaryFixture = {
  pengelola: { id: manager.id, nama: manager.nama, peran: 'pengelola' },
  metrik: { hari_ini: '2026-11-23', nilai_hari_ini_rp: '11725', berat_hari_ini_kg: '3.625', transaksi_hari_ini: '1', nasabah_aktif: '12', hari_tersedia_minggu_ini: '2' },
  transaksi_terbaru: [{ setoran_id: '9007199254740995', nama_nasabah: 'Nasabah Pengujian', jenis_sampah: 'Botol Plastik PET, Kardus', berat_kg: '3.625', nilai_setoran_rp: '11725', status: 'Terverifikasi' }],
  jadwal_hari_ini: [{ id: '9007199254740997', nama_layanan: 'Setoran umum', tanggal: '2026-11-23', jam_mulai: '08:00:00', jam_selesai: '15:00:00', tersedia: true, catatan: null }],
  periode: { hari: '2026-11-23', minggu: { dari: '2026-11-23', sampai: '2026-11-29' }, zona_waktu: 'Asia/Jakarta' },
}
