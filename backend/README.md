# Backend Bank Sampah Digital

API untuk pengelola dan nasabah. Kontrak endpoint, parameter, contoh JSON, hak akses, dan menu frontend tersedia di [docs/API.md](docs/API.md).

Pembaruan 22 November 2026: login/register React, pemulihan sesi, dan lockout persisten 5 password salah / 15 menit tersedia. Lihat [laporan implementasi, migration 003, dan pengujian](docs/AUTH-FRONTEND.md). Migration 003 belum diterapkan ke Neon; migration 001/002 tidak diubah. Menurut informasi pengguna, migration persetujuan dan dua ketua sudah tersedia, sehingga jangan mengulang bootstrap pada database existing.

Untuk mencoba API satu per satu melalui Postman, gunakan [panduan Postman](docs/POSTMAN.md) dan artefak v3 YAML di folder `postman`. Collection menambahkan data uji ke database yang dipakai backend; panduan menjelaskan pemilihan database tujuan, akun pengelola, variabel lokal, dan hasil setiap tahap.

Pembaruan persetujuan pengelola 21 November 2026: lihat [migration, bootstrap dua ketua, dan kontrak persetujuan](docs/PERSETUJUAN-PENGELOLA.md). Schema Neon aktual diperiksa read-only; migration 002 belum dijalankan pada Neon.

## Kondisi awal yang diperiksa

Pemeriksaan dilakukan 18 November 2026. Repository awal hanya mempunyai `backend/index.js` dengan `GET /api/health`. Tidak ditemukan `AGENTS.md`. Frontend masih template React/Vite, tanpa formulir Bank Sampah atau hasil ekspor Figma Make. Implementasi API mengikuti kebutuhan dalam tugas; integrasi halaman React belum dilakukan.

| Bagian | Versi yang diperiksa |
| --- | --- |
| Node.js / npm | 24.19.0 / 11.17.0 |
| Express / pg | 5.3.0 / 8.23.1 |
| cors / dotenv | 2.8.6 / 18.0.10 |
| PostgreSQL Neon | 18.7; zona waktu server awal GMT |
| Tambahan ekspor XLSX | ExcelJS 4.4.0, dikunci di lockfile |

Dependensi transitif `uuid` milik ExcelJS diarahkan ke 11.1.1 melalui `overrides` untuk memperbaiki advisory yang ditemukan saat audit. Penggunaan `uuid.v4()` CommonJS oleh ExcelJS tetap kompatibel dan ekspor diuji lagi setelah perubahan.

Frontend menggunakan React 19.3.1, Vite 8.3.6, dan Axios 1.21.1. Tidak ada perubahan pada frontend. `package.json` backend menetapkan Node 24.19 sampai sebelum 25 agar sesuai runtime yang diuji; `npm ci` menggunakan versi dalam lockfile.

Neon diperiksa melalui transaksi `BEGIN READ ONLY`, menggunakan `DATABASE_URL` yang sudah ada di `.env`. Hasil metadata dan referensi publik tersimpan di [database-inspection.json](docs/database-inspection.json). Berkas ini tidak menyertakan email, nama akun, sandi, sesi, atau connection string.

Pada pemeriksaan awal tersedia:

- Delapan tabel: `akun`, `jenis_sampah`, `harga_sampah`, `setoran`, `detail_setoran`, `layanan`, `jadwal_layanan`, `pengajuan_penjemputan`.
- Fungsi `catat_setoran(bigint,bigint,date,uuid,jsonb)` yang mengambil tarif berlaku pada tanggal setoran, memvalidasi akun aktif/berat/tanggal, dan menyimpan beberapa rincian sekaligus.
- View `v_harga_terkini`, `v_riwayat_setoran`, `v_saldo_nasabah`, dan `v_ringkasan_pengelola`, semuanya dipakai API.
- Kolom generated untuk kode akun, peran pada foreign key, dan subtotal dengan `round(berat_kg * harga_per_kg)`. Kode transaksi berasal dari view.
- Unique key `kunci_permintaan`; unique `pengajuan_penjemputan_id`; foreign key gabungan memastikan setoran penjemputan milik nasabah yang benar.
- Nol akun, transaksi, jadwal, dan pengajuan; delapan jenis sampah serta tujuh harga mulai 22 Juni 2026. Minyak Jelantah belum mempunyai tarif per kg.

Migrasi `001_sessions_and_idempotency.sql` menambahkan tabel sesi dan kolom fingerprint permintaan yang boleh NULL untuk transaksi lama. Runner membuat tabel pencatatan migrasi/checksum. Migrasi tidak mengganti fungsi/view, tidak menghapus data, dan tidak memasukkan akun demo ke `public`.

## Menjalankan

Dari root repository:

```powershell
cd backend
npm ci
```

Gunakan `.env` yang sudah ada. Untuk lingkungan baru, salin `.env.example` menjadi `.env`, lalu isi `DATABASE_URL` dari Neon. Jangan menimpa `.env` existing dengan contoh. Nilai contoh tidak bisa dipakai untuk koneksi sungguhan.

```powershell
npm run db:migrate
npm run dev
```

`bootstrap:ketua` memerlukan konfigurasi dua akun pilihan pemilik; ikuti [panduan bootstrap](docs/PERSETUJUAN-PENGELOLA.md). `create:pengelola` meminta input interaktif tersembunyi dan kini menghasilkan pengajuan pending, bukan akun aktif. Pendaftaran publik mendukung peran nasabah/pengelola; pengelola perlu persetujuan ketua.

`npm start` menjalankan server tanpa mode watch. Alamat default: `http://localhost:3000/api`. Cek `GET /api/health`. Migrasi dilakukan lewat perintah terpisah, bukan otomatis setiap server mulai.

| Variabel | Arti |
| --- | --- |
| `DATABASE_URL` | Koneksi PostgreSQL Neon; wajib dan dirahasiakan |
| `PORT` | Port backend, default 3000 |
| `CLIENT_ORIGIN` | Origin frontend, default `http://localhost:5173`; beberapa origin dipisahkan koma |
| `SESSION_HOURS` | Umur sesi, default 24 jam; bilangan bulat 1–720 |
| `TEST_DATABASE_URL` | Wajib untuk tes DB; harus database terpisah, tidak ada fallback produksi |

URL database tidak dicetak. Untuk URL SSL dengan `require`, `prefer`, atau `verify-ca`, koneksi Node menormalkannya menjadi `verify-full`, mempertahankan verifikasi sertifikat/hostname; isi `.env` tidak diubah. Jangan menonaktifkan verifikasi TLS. CORS mengizinkan header Bearer dan `Idempotency-Key`; cookie tidak digunakan.

## Struktur kode

```text
backend/
  index.js                    # Menyalakan server
  src/
    app.js                    # Express, JSON, CORS, error handler
    config.js                 # Membaca .env dengan path tetap
    db.js                     # Pool pg dan transaksi
    migrate.js                # Runner migrasi atomik + checksum
    routes/api.js             # Daftar URL dan middleware hak akses
    controllers/              # Membaca input HTTP, menjalankan kueri, mengirim JSON
    services/                 # Pencatatan setoran dan bootstrap pengelola
    middleware/               # Autentikasi, peran, lingkup pemilik
    utils/                    # Validasi, tanggal, hash, dan error
  migrations/                 # Perubahan skema tambahan
  scripts/                    # Inspeksi, migrasi, bootstrap, cek sintaks
  test/                       # Unit dan integrasi dengan data terisolasi
  docs/                       # Kontrak API, inspeksi awal, hasil verifikasi
```

Urutan sederhana: **route → middleware → controller → database**. Pencatatan setoran ditempatkan di service karena beberapa langkah harus berhasil atau gagal bersama. Semua nilai HTTP dimasukkan melalui parameter `$1`, `$2`, dan seterusnya. Identifier SQL hanya berasal dari kode yang dikendalikan aplikasi.

## Aturan bisnis dan integrasi

- Registrasi nasabah menghasilkan active; pengelola menghasilkan pending tanpa sesi sampai disetujui ketua. Ketua tetap peran pengelola dengan is_ketua=true. Login/profil menyertakan peran, is_ketua, status_akun. Lihat [kontrak persetujuan](docs/PERSETUJUAN-PENGELOLA.md).
- Kata sandi memakai `crypto.scrypt` asynchronous, salt acak, dan pemeriksaan waktu konstan. Token sesi acak 32 byte dikirim sekali saat login; database hanya menyimpan SHA-256 token. Logout menghapus sesi tersebut; sesi login lain tetap berlaku. Akun nonaktif ditolak pada setiap permintaan.
- Saldo adalah seluruh nilai setoran terverifikasi. Belum ada penarikan, biaya, pembatalan transaksi, atau saldo awal manual. Berat utama sepanjang waktu; `kg_tahun_ini` tersedia terpisah. Filter riwayat tidak mengubah saldo.
- Semua tanggal operasional dan filter memakai Asia/Jakarta. DATE dikirim `YYYY-MM-DD`, jam `HH:mm:ss` WIB, timestamp audit berbentuk ISO 8601 UTC. Minggu Senin–Minggu. Angka uang/berat NUMERIC dan ID BIGINT dikirim sebagai string untuk menjaga presisi.
- Berat positif, kurang dari 1 miliar kg, maksimal tiga desimal. Harga integer Rupiah/kg. Subtotal dibulatkan ke Rupiah terdekat **per rincian** oleh PostgreSQL; total adalah jumlah subtotal. Contoh 0,001 kg × Rp10.500 menghasilkan Rp11.
- Harga berlaku terakhir dengan `berlaku_mulai <= tanggal_setoran`. Harga kosong ditampilkan sebagai `belum_ditetapkan`, tetapi tidak boleh ditransaksikan. Harga hasil timbang disalin ke detail; perubahan tabel tarif tidak mengubah transaksi lama.
- Setoran dapat berisi satu atau beberapa jenis. Jenis yang sama harus digabung menjadi satu rincian. Tidak menerima harga, subtotal, total, atau ID pengelola dari formulir. `Idempotency-Key` dibuat sekali saat mulai menyimpan satu transaksi dan dipertahankan saat retry. Mengganti kunci berarti transaksi baru.
- Pengajuan baru `menunggu`, lalu pengelola memutuskan sekali menjadi `disetujui` atau `ditolak`. Persetujuan memerlukan jadwal penjemputan tersedia pada hari ini atau mendatang. Tanggal jadwal boleh berbeda dari tanggal yang diminta; frontend perlu menampilkan keduanya.
- Jadwal yang dipakai pengajuan disetujui tidak dapat ditutup. Tanggal, jenis layanan, dan jam jadwal yang terikat pengajuan disetujui/selesai tidak dapat diubah. Catatan tetap dapat diedit; jadwal selesai boleh ditutup. Ini menjaga janji layanan dan riwayat.
- Pencatatan hasil penjemputan hanya untuk pengajuan disetujui milik nasabah yang dipilih, pada tanggal jadwal tersebut. Simpan header/rincian, tautkan pengajuan, ubah menjadi `selesai` dalam satu transaksi. Satu pengajuan maksimal satu transaksi, termasuk saat beberapa pengelola menyimpan bersamaan. Persetujuan sendiri tidak menambah saldo.
- Jadwal berupa tanggal nyata yang dikelola pengelola, bukan aturan berulang otomatis. `hari_rutin` dari tabel layanan adalah informasi kartu. Slot yang tidak dibuat tidak otomatis dianggap tutup; pengelola membuat/menonaktifkan baris jadwal untuk menampilkan tutup.

## Hal yang perlu dikonfirmasi kelompok

1. Tarif Minyak Jelantah **per kg** dan tanggal berlakunya. Setelah disepakati, pengelola dapat mengirim `POST /api/harga-sampah`. API tidak mengarang tarif atau mengubah satuan menjadi liter.
2. Lokasi, area, hari, dan syarat layanan existing masih perlu persetujuan bisnis: data referensi memuat lokasi setoran, Area A, Jumat, serta tulisan minimal 10 kg. Syarat itu masih teks informasi; validasi otomatis saat pengajuan hanya berat positif. Pengelola menilai minimum/area sebelum menyetujui. Tidak ada aturan angka 10 kg yang disisipkan diam-diam.
3. Apakah tiga bulan terakhir berarti tiga bulan kalender termasuk bulan berjalan (implementasi sekarang) atau rentang bergulir 90 hari.
4. Apakah perlu pembatalan, penjadwalan ulang setelah persetujuan, pembatasan kapasitas penjemputan, penarikan saldo, atau koreksi transaksi. Alur itu belum diminta dan belum mempunyai model bisnis.
5. Kebijakan perubahan tarif yang tanggalnya mundur. Endpoint saat ini menambahkan harga dengan tanggal unik; nilai setoran lama selalu dipertahankan. Harga pada jenis/tanggal yang sudah ada tidak bisa ditimpa lewat API.

## Pengujian dan batas MVP

```powershell
npm run check
npm test
npm run test:integration
npm run test:regression
npm run test:approval
npm run test:postman
```

`npm test` menguji validasi, zona waktu/periode, hash kata sandi, dan pembatas login tanpa koneksi database. Pengujian integrasi menggunakan PostgreSQL sungguhan melalui `TEST_DATABASE_URL` yang wajib diisi dan terpisah dari `DATABASE_URL`. Tidak ada fallback ke database produksi.

Runner integrasi selalu membuat schema baru `bs_test_<waktu>_<acak>`, membuat sequence/tabel/fungsi/view terpisah dari metadata inspeksi awal, dan memasukkan data fiktif. Search path test tidak memiliki fallback ke `public`; fungsi `catat_setoran` versi fixture diarahkan ke schema uji. Foreign key lintas schema diperiksa. Schema uji dihapus pada teardown, termasuk ketika assertion gagal. Tidak ada `TRUNCATE` atau DELETE terhadap data produksi. Jika proses dipaksa mati oleh OS, schema uji dapat tertinggal; jangan menghapus schema selain nama uji yang telah diverifikasi.

Hasil eksekusi dan cakupan akhir dicatat di [docs/VERIFICATION.md](docs/VERIFICATION.md). `test:regression` juga memakai schema terisolasi, menguji retry setelah tarif berubah, kompatibilitas transaksi lama, ekspor setelah pembaruan dependensi, dan penetapan tarif Minyak Jelantah pada data uji. `db:verify` hanya membaca database utama dan memeriksa endpoint publik, migrasi, serta keutuhan fungsi/view existing. `npm run db:inspect` hanya membaca metadata dan data referensi publik. Snapshot awal yang dipakai fixture sengaja tidak ditimpa sesudah migrasi.

Pembatas autentikasi MVP adalah 30 percobaan login/registrasi per IP per 15 menit dalam satu proses. Untuk beberapa instance, penyimpanan rate limit bersama diperlukan. Ekspor memuat seluruh hasil di memori dan menghasilkan dua sheet; untuk volume sangat besar, perlu ekspor streaming/job tersendiri. Token sebaiknya disimpan dalam memori frontend, selalu dihapus saat logout/401, dan semua koneksi memakai HTTPS saat deployment. Tidak ada alur lupa kata sandi atau verifikasi email dalam cakupan ini.

## Dokumentasi resmi yang digunakan

- [Indeks Node.js yang diberikan](https://nodejs.org/docs/latest/api/) mengarah ke seri lebih baru; implementasi dicocokkan ke [Crypto Node 24](https://nodejs.org/docs/latest-v24.x/api/crypto.html) untuk `scrypt`, `randomBytes`, `timingSafeEqual`, dan hashing.
- [Node 24 Test Runner](https://nodejs.org/docs/latest-v24.x/api/test.html): `node:test`, hook, dan subtest.
- [Express 5 error handling](https://expressjs.com/en/guide/error-handling/): error Promise pada handler async diteruskan otomatis ke middleware error.
- [Dokumentasi cors](https://expressjs.com/en/resources/middleware/cors/): origin, header request, dan exposed response headers.
- [node-postgres transactions](https://node-postgres.com/features/transactions): seluruh perintah transaksi memakai client yang sama; [parameterized queries](https://node-postgres.com/features/queries): nilai input terpisah dari SQL.
- [Neon connection guide](https://neon.com/docs/connect/connect-from-any-app): penggunaan connection string aplikasi.
- [PostgreSQL 18 locking](https://www.postgresql.org/docs/18/explicit-locking.html): row lock dan advisory lock; [numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html): presisi dan pembulatan NUMERIC.
- [ExcelJS 4.4.0 README](https://github.com/exceljs/exceljs/blob/v4.4.0/README.md): worksheet, tipe sel, penulisan dan pembacaan buffer XLSX.
- [uuid 11.1.1 README](https://github.com/uuidjs/uuid/blob/v11.1.1/README.md) dan [advisory GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq): memeriksa kompatibilitas CommonJS dan versi perbaikan dependensi.
