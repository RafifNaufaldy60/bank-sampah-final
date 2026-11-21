# Hasil verifikasi — persetujuan pengelola, 21 November 2026

Neon **hanya diinspeksi read-only** pada pekerjaan ini. Koneksi awal sandbox EACCES, kemudian inspeksi dengan akses jaringan yang sesuai berhasil. Bukti metadata terbaru: [account-inspection.json](account-inspection.json). Database `bank_sampah/public` memiliki 1 pengelola dan 7 nasabah aktif; migration yang tercatat masih hanya 001, checksum cocok. Migration 002 dan bootstrap tidak dijalankan pada Neon.

Pengujian mutasi memakai **PostgreSQL lokal 18.6**, database `bank_sampah_approval_test` pada loopback port 55439. Schema fixture dibuat dari metadata dasar, bukan salinan data pribadi, lalu dibersihkan. `TEST_DATABASE_URL` wajib dan tidak boleh menunjuk database proyek yang sama. Frontend tidak diubah.

| Pemeriksaan yang benar-benar dijalankan | Hasil |
| --- | --- |
| `node --test test/unit.test.js test/approval.test.js test/integration.test.js test/regression.test.js test/postman.test.js` | **43 lulus**, 0 gagal, 0 dilewati (termasuk parent subtest) |
| `npm run check` | Semua JavaScript valid |
| CLI resmi Postman 1.80.0 `collection lint` | **79 request, 0 error, 0 warning** |
| `npm run test:postman:integration` dengan CLI resmi | **79 request, 239 assertion lulus**, 0 gagal; database lokal terpisah |
| `git diff --check` | Tidak ada error whitespace |
| Cleanup database tes | 0 schema `bs_test_*` tersisa; server PostgreSQL sementara dihentikan setelah tes |

Tes baru meliputi backfill akun aktif/nonaktif, default pending, constraint ketua/status, migration tracking dan konflik schema; bootstrap tepat dua, idempotensi tanpa reset password, rollback konflik, mode existing eksplisit, penolakan nasabah/pending/blokir; nasabah active, pengelola pending tanpa sesi, pending/ditolak 403 hanya setelah password benar, sandi salah generik termasuk sandi pendek; allowlist registrasi/profil; daftar/detail/pagination/filter; 401/403/404/409; keputusan bersamaan satu pemenang dan metadata utuh; token lama pada pending/ditolak/nonaktif dan pencabutan ketua terbaru dari DB.

Seluruh tes fitur lama tetap berjalan: setoran multijenis, saldo, retry/idempotensi, tarif, jadwal, penjemputan, kepemilikan, riwayat, ringkasan, ekspor XLSX, logout dan revocation. Semua 55 request Postman lama dipertahankan, ditambah 24 request persetujuan/otorisasi/logout ketua. `yaml` hanya dev dependency untuk tooling/tes.

Belum diuji: penerapan migration/bootstrap pada Neon produksi (sengaja tidak dilakukan), impor visual lewat UI Postman Local Mode, dan integrasi frontend. Validasi format v3 dan eksekusi HTTP melalui CLI resmi **sudah** diuji. Bukti hasil ini tidak menyatakan sudah deploy.

File utama perubahan: migration 002; `auth-controller`, `approval-controller`, middleware auth, routes, `account-service`, `chair-bootstrap`; CLI bootstrap/inspeksi akun/runner Postman dan create-manager; test approval/integration/regression/postman serta helper DB terpisah; package/lockfile, `.env.example`; README/API/panduan persetujuan/panduan Postman/verifikasi; environment dan collection YAML. Snapshot schema dasar lama dan migration 001 tidak diubah.

## Riwayat verifikasi 18 November 2026 (sebelum fitur persetujuan)

Catatan berikut berasal dari pekerjaan sebelumnya; aturan registrasi, fallback database tes, dan artefak Postman lama telah digantikan oleh implementasi/panduan 21 November di atas. Penerapan migration 001 di bawah adalah peristiwa lama, bukan penerapan migration pada pekerjaan ini.

Implementasi diuji dengan Node.js 24.19.0, npm 11.17.0, Express 5.3.0, pg 8.23.1, dan PostgreSQL Neon 18.7. Semua perintah dijalankan dari folder `backend`.

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run check` | Semua berkas JavaScript lolos pemeriksaan sintaks |
| `npm test` | 6 test lulus, 0 gagal, 0 dilewati |
| `npm run test:integration` | 18 skenario lulus; reporter Node mencatat 19 test termasuk parent; 0 gagal/dilewati; sekitar 355 detik |
| `npm run test:regression` | 3 skenario lulus; reporter mencatat 4 test termasuk parent; 0 gagal/dilewati; sekitar 60 detik |
| Audit setelah perbaikan dependensi | 0 kerentanan dilaporkan, 255 package diaudit oleh npm install |
| `npm run db:migrate` | Migrasi `001_sessions_and_idempotency.sql` berhasil diterapkan ke Neon |
| `npm run db:verify` | Migrasi tersedia, fungsi/view existing identik dengan hasil inspeksi, endpoint publik berhasil |
| `git diff --check` | Tidak ada error whitespace |
| Pemeriksaan rahasia | Tidak ada connection string atau password Neon aktual dalam berkas source, SQL, JSON, dokumentasi, atau `.env.example`; `.env` tetap diabaikan Git |

## Isolasi pengujian

Pengujian mutasi memakai schema sementara `bs_test_*` di PostgreSQL sungguhan, dengan akun fiktif, sequence baru, dan salinan definisi fungsi/view yang diarahkan ke schema tersebut. Runner memeriksa agar foreign key tidak menuju schema lain. Fixture tidak menyalin data pribadi existing. Semua schema uji dihapus pada teardown; pemeriksaan akhir menemukan **0 schema uji tersisa**.

Tidak ada akun, setoran, jadwal, atau pengajuan uji yang dimasukkan ke schema `public`. Pada fixture integrasi, data lama sengaja dibuat sebelum migrasi untuk memastikan migrasi tetap mempertahankan data tersebut.

## Cakupan yang berhasil

- Koneksi database dan CORS untuk origin React lokal, termasuk preflight dengan Authorization/Idempotency-Key; origin lain ditolak.
- Migrasi atomik, dapat dijalankan ulang, dan mempertahankan akun/transaksi lama pada fixture.
- Registrasi hanya nasabah; field peran ditolak; email tidak peka huruf besar/kecil; hash sandi memakai salt berbeda.
- Pengelola dibuat lewat service yang digunakan CLI lokal. Email nasabah tidak bisa dipakai untuk promosi otomatis.
- Login benar/salah, identitas akun, token palsu, peran, sesi kedaluwarsa, akun nonaktif, logout dan pencabutan token.
- Pembatas percobaan autentikasi menghasilkan 429 dan Retry-After; pemeriksaan URL invalid tidak membocorkan input.
- Katalog delapan jenis, kategori/pencarian, harga pada tanggal tertentu, dan jenis tanpa tarif tetap tampil.
- Pencarian nasabah aktif menurut nama/kode, serta pagination.
- Tambah/edit/tutup jadwal ketiga layanan; jadwal tutup tetap terlihat; validasi jam dan hak akses.
- Perhitungan setoran multijenis: 1,125 kg PET × Rp4.200 + 2,5 kg kardus × Rp2.800 = **Rp11.725** dan **3,625 kg**.
- Pembulatan subtotal PostgreSQL: 0,001 kg × Rp10.500 = **Rp11**.
- Saldo dan rincian langsung mencerminkan transaksi setelah commit; saldo nasabah lain tetap terpisah.
- Retry bersamaan dengan kunci sama menghasilkan satu transaksi dan respons 201/200. Perubahan isi atau pengelola dengan kunci sama ditolak 409.
- Retry setelah tarif berubah tetap mengembalikan nilai lama; transaksi dengan fingerprint NULL juga dapat dibandingkan melalui detail yang tersimpan.
- Berat/tanggal/jenis ganda/pengiriman harga atau ID pengelola palsu ditolak. Kegagalan salah satu harga me-rollback header dan semua rincian.
- Tarif historis sesuai tanggal; perubahan harga tidak mengubah detail transaksi lama.
- Kepemilikan daftar/rincian transaksi dan pengajuan; ID milik nasabah lain menghasilkan 404. Filter pencarian tidak meloloskan injeksi SQL.
- Filter tiga bulan, bulan berjalan, tahun berjalan, rentang tanggal inklusif, pagination termasuk halaman kosong. Saldo utama tidak ikut terfilter.
- Pergantian hari Jakarta, pergantian tahun, serta minggu Senin–Minggu.
- Ringkasan nilai/berat hari ini, nasabah aktif, tanggal layanan berbeda per minggu, lima transaksi terbaru, jadwal hari ini.
- Pengajuan menunggu terhubung ke akun sesi; jadwal yang salah layanan atau tutup ditolak pada persetujuan.
- Dua pengelola menyetujui bersamaan: satu berhasil, satu 409. Persetujuan versus penolakan bersamaan juga hanya memiliki satu keputusan akhir.
- Persetujuan tidak menambah saldo. Penolakan menyimpan alasan, pengelola, dan waktu yang dapat dibaca pemilik.
- Jadwal terikat tidak dapat ditutup/diubah waktu layanannya. Percobaan menutup jadwal bersamaan dengan persetujuan tetap konsisten.
- Setoran penjemputan memvalidasi pemilik, status, dan tanggal jadwal. Kegagalan tidak mengubah status menjadi selesai.
- Dua setoran dengan kunci berbeda untuk pengajuan sama: hanya satu tersimpan. Link transaksi dan status selesai tersimpan atomik; retry tidak menggandakan saldo.
- Ekspor XLSX dibuka kembali menggunakan ExcelJS dan diperiksa isinya: seluruh hasil filter dari semua halaman, sheet transaksi/rincian, tanggal, nilai, serta teks seperti `=2+2` tetap string.
- Tarif Minyak Jelantah ditetapkan **hanya dalam fixture uji**, lalu transaksi 1,25 kg × Rp6.000 menghasilkan Rp7.500. Tarif tanggal sebelumnya tetap kosong.

## Verifikasi akhir database utama

Pemeriksaan baca-saja setelah migrasi menghasilkan:

```json
{
  "migrasi": ["001_sessions_and_idempotency.sql"],
  "fungsi_dan_view_existing": "tidak berubah",
  "jumlah_data": {
    "akun": "0", "setoran": "0", "pengajuan": "0", "jadwal": "0",
    "jenis_sampah": "8", "harga": "7"
  },
  "schema_uji_tersisa": "0",
  "pemeriksaan_http": "health, katalog, layanan, jadwal 200; saldo tanpa login 401"
}
```

Migrasi hanya menambahkan tabel sesi, kolom fingerprint nullable, indeks sesi, dan tabel catatan migrasi. Tidak ada perubahan harga, akun bootstrap otomatis, atau penggantian fungsi/view existing. Akun pengelola sungguhan dibuat operator melalui `npm run create:pengelola`; kredensialnya ditentukan saat prompt terminal. Server smoke test dihentikan setelah verifikasi; jalankan `npm run dev` untuk penggunaan lokal.

## Batas hasil verifikasi

Pengujian dilakukan melalui HTTP API dan PostgreSQL, belum melalui layar React karena frontend masih template. Pembuatan akun pengelola dan hashing diuji melalui service yang sama dengan CLI; interaksi mengetik pada prompt tersembunyi tidak diuji otomatis. Beban besar, deployment beberapa instance, integrasi HTTPS produksi, dan file XLSX pada aplikasi Excel desktop tidak diuji. XLSX diverifikasi dengan pembacaan ulang ExcelJS.

Audit awal menemukan dependensi `uuid` lama dari ExcelJS. Setelah override ke 11.1.1, audit bersih dan pengujian ekspor diulang. Audit bersih berarti tidak ada advisory yang dilaporkan npm saat pemeriksaan ini, bukan jaminan bahwa seluruh aplikasi bebas kerentanan.
