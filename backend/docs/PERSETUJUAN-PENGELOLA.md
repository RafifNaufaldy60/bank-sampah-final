# Persetujuan pendaftaran pengelola

Implementasi 21 November 2026. Frontend tidak diubah. Nama role pada kontrak proyek tetap **`peran`**, dengan nilai hanya `nasabah` dan `pengelola`. Ketua adalah pengelola dengan `is_ketua=true`.

## Bukti pemeriksaan database aktual

Koneksi dibaca dari konfigurasi proyek (`backend/.env`, tanpa menampilkan rahasia). Pemeriksaan awal sebelum perubahan kode berhasil setelah akses jaringan sandbox `EACCES` diatasi. Semua kueri inspeksi berada dalam transaksi **READ ONLY**. Pemeriksaan ulang disimpan di [account-inspection.json](account-inspection.json), terpisah dari snapshot awal `database-inspection.json` yang digunakan fixture tes.

- Tujuan yang diperiksa: **Neon, database `bank_sampah`, schema `public`**, PostgreSQL 18.7.
- `akun.id`: BIGINT identity; `kode_akun`: generated; role berupa `peran text` dengan constraint dua nilai.
- Status lama: `aktif boolean NOT NULL DEFAULT true`. Tidak ditemukan `status_akun`, `is_ketua`, trigger akun, atau tabel audit umum. Metadata keputusan penjemputan bukan audit akun.
- Saat inspeksi: 1 pengelola aktif, 7 nasabah aktif; tidak ada akun nonaktif pada hasil agregasi.
- `001_sessions_and_idempotency.sql` sudah tercatat dan checksum cocok dengan repository. Migration `002` belum diterapkan pada Neon.
- Tidak ada nama, email, password, token, atau connection string di snapshot ini.

Periksa kembali sebelum deployment karena data dapat berubah:

```powershell
cd backend
npm run db:inspect:accounts
```

## Migration 002

SQL: [002_manager_approval.sql](../migrations/002_manager_approval.sql). Jalankan melalui runner agar advisory lock, transaksi, checksum, dan tabel `schema_migrations` berlaku. Jangan menjalankan SQL mentah lewat pgAdmin tanpa tracking runner.

| Kolom | Aturan dan kegunaan |
| --- | --- |
| `is_ketua` | Boolean NOT NULL default false; CHECK hanya boleh true untuk pengelola |
| `status_akun` | Text NOT NULL; CHECK active/pending/ditolak; default INSERT baru pending |
| `diperiksa_oleh` | BIGINT nullable, FK akun pemeriksa |
| `diputuskan_pada` | TIMESTAMPTZ nullable, waktu keputusan |
| `alasan_penolakan` | Text nullable; penolakan melalui API wajib 1–1000 karakter setelah trim |

Keputusan baru menyimpan tiga metadata tersebut secara atomik. CHECK menjaga pasangan pemeriksa/waktu dan alasan. Akun lama serta bootstrap boleh memiliki metadata NULL karena bukan keputusan pendaftaran melalui endpoint ini. Tidak ada data audit lama yang direkayasa.

Backfill: `aktif=true` → `status_akun=active`; `aktif=false` → `status_akun=ditolak`. **Nilai `aktif` tidak berubah**, sehingga blokir lama tetap berlaku. Semua akun lama mendapat `is_ketua=false`. Untuk akun nonaktif lama, `ditolak` berarti akses tetap ditolak; tidak menyatakan ada keputusan ketua historis. Akun tersebut tidak muncul sebagai pending dan tidak dapat diaktifkan lewat endpoint persetujuan.

Migration menolak schema yang telah memiliki kolom status alternatif (`status`, `status_akun`, `is_active`, `nonaktif`, `is_ketua`) agar operator memeriksa pemetaan terlebih dahulu. Konflik membatalkan seluruh transaksi, termasuk tracking. Tidak ada DROP/recreate, perubahan ID, saldo, setoran, fungsi/view, atau relasi lama. Indeks parsial membantu daftar pengajuan pengelola.

## Urutan deployment dan database tujuan

**Belum ada migration atau bootstrap yang dijalankan pada Neon oleh perubahan ini.** Tes memakai PostgreSQL lokal terpisah `bank_sampah_approval_test` di `127.0.0.1:55439`, dengan schema acak `bs_test_*` yang dihapus setelah tes.

1. Uji pada database terpisah yang memiliki schema dasar proyek dan data referensi. Migration tambahan bukan installer database kosong. Helper tes merekonstruksi schema dasar dari snapshot metadata, tanpa menyalin akun/transaksi produksi.
2. Untuk deployment, hentikan backend lama sementara agar tidak ada registrasi selama peralihan. Pastikan `DATABASE_URL` proses menunjuk tujuan yang diperiksa: Neon `bank_sampah/public`. Variabel terminal mengalahkan `.env`; jangan mencetak nilainya.
3. Jalankan migration, kemudian deploy/mulai backend versi ini. Backend baru memerlukan kolom `002`; jangan memulainya sebelum migration berhasil.
4. Bootstrap dua ketua pilihan pemilik. Akun pengelola lama tetap aktif tetapi bukan ketua sampai dipilih secara eksplisit.
5. Verifikasi login dan akses sesuai peran. Jangan menjalankan collection uji pada database produksi.

Perintah penerapan **untuk dijalankan pemilik setelah meninjau tujuan**:

```powershell
cd backend
npm ci
npm run db:inspect:accounts
npm run db:migrate
npm run bootstrap:ketua
npm start
```

Pada Neon yang diperiksa, runner akan melewati `001` dan menerapkan hanya `002`. Pengulangan tidak mengulang backfill. Tidak ada down migration destruktif; bila deployment aplikasi gagal, pertahankan tambahan schema/data, perbaiki backend, dan jangan menghapus keputusan yang telah tersimpan. Backend lama tidak memeriksa `status_akun`, sehingga **jangan mengembalikan backend lama setelah menerima pengajuan baru**.

## Bootstrap tepat dua ketua

`npm run bootstrap:ketua` membaca dua kelompok variabel `KETUA_1_*` dan `KETUA_2_*`. Semua perubahan berada dalam satu transaksi; dua email harus berbeda. Jika ada ketua di luar dua email pilihan, seluruh bootstrap ditolak. Tidak ada pemilihan berdasarkan urutan akun.

| Variabel per ketua | Nilai |
| --- | --- |
| `KETUA_n_MODE` | `create` atau `existing`, wajib eksplisit |
| `KETUA_n_EMAIL` | Email yang ditentukan pemilik |
| `KETUA_n_NAMA` | Wajib untuk create |
| `KETUA_n_PASSWORD` | Wajib untuk create, 10–128 karakter |
| `KETUA_n_WHATSAPP` | Opsional untuk create |

Contoh input aman PowerShell 7, ulangi untuk kedua akun:

```powershell
$env:KETUA_1_MODE = 'create'
$env:KETUA_1_EMAIL = Read-Host 'Email ketua 1'
$env:KETUA_1_NAMA = Read-Host 'Nama ketua 1'
$env:KETUA_1_PASSWORD = Read-Host 'Password ketua 1' -MaskInput
$env:KETUA_2_MODE = 'create'
$env:KETUA_2_EMAIL = Read-Host 'Email ketua 2'
$env:KETUA_2_NAMA = Read-Host 'Nama ketua 2'
$env:KETUA_2_PASSWORD = Read-Host 'Password ketua 2' -MaskInput
npm run bootstrap:ketua
Remove-Item Env:KETUA_1_PASSWORD,Env:KETUA_2_PASSWORD
```

Untuk memilih pengelola lama yang sudah aktif, gunakan mode `existing` dan email, tanpa variabel nama/password. Kedua mode boleh dicampur. `existing` menolak nasabah, pending, ditolak, nonaktif, dan email yang tidak ditemukan. Mode `create` menolak email existing yang belum ketua; pemilik harus memilih `existing` secara eksplisit. Menjalankan ulang dengan dua ketua yang sama tidak menggandakan akun atau mereset password. Password input mode create pada pengulangan tidak digunakan untuk menimpa password existing.

Advisory lock dan table lock hanya selama bootstrap menserialisasi perubahan akun; jalankan sebagai operasi setup. Tidak ada endpoint HTTP untuk bootstrap/promosi. `create:pengelola` lama kini hanya membuat pengajuan pending yang tetap perlu disetujui ketua.

## Kontrak HTTP

Prefix `/api`. Akun pada respons memakai `peran`, `is_ketua`, `status_akun`, dan `aktif`; ID BIGINT tetap string. Respons tidak menyertakan hash/password.

Registrasi pengelola:

```http
POST /api/auth/register
Content-Type: application/json

{"nama":"Pengelola Uji","email":"pengelola@example.test","password":"Sandi-Contoh-Uji-123","peran":"pengelola"}
```

Respons 201 (contoh fiktif):

```json
{"data":{"id":"12","kode_akun":"PGL-00012","nama":"Pengelola Uji","email":"pengelola@example.test","nomor_whatsapp":null,"peran":"pengelola","aktif":true,"is_ketua":false,"status_akun":"pending"}}
```

Tidak ada token atau sesi. Untuk nasabah, `peran=nasabah` atau tidak dikirim → active; registrasi tetap tidak otomatis login. `aktif=true` sendiri tidak memberi akses: akses mensyaratkan juga `status_akun=active`.

Login selalu memverifikasi password dahulu. Sandi salah, termasuk sandi pendek, memberi 401 `LOGIN_GAGAL`; password benar pada pending memberi 403 `ACCOUNT_PENDING`, pada ditolak memberi 403 `ACCOUNT_REJECTED`. Akun lama dengan `aktif=false` tidak dapat login walaupun statusnya active. Hash scrypt, pembatas 30 percobaan login/registrasi per IP per 15 menit, expiry, dan revocation sesi tetap berlaku.

| Metode dan path | Input / hasil |
| --- | --- |
| GET `/pengajuan-pengelola` | Query `status=pending` default, atau active/ditolak/all; `page=1`, `limit=20` default; `{data:[...],meta:{page,limit,total,total_pages,pending_total}}` |
| GET `/pengajuan-pengelola/:id` | Detail pengelola non-ketua beserta metadata; 404 untuk target di luar lingkup |
| POST `/pengajuan-pengelola/:id/setujui` | Body `{}` atau tanpa body; 200, status active |
| POST `/pengajuan-pengelola/:id/tolak` | Body `{"alasan_penolakan":"Dokumen belum lengkap"}`; 200, status ditolak |
| PATCH `/auth/me` | Login aktif; hanya `nama` dan/atau `nomor_whatsapp`; respons profil terbaru |

`status=all` menampilkan pengelola non-ketua dari semua status, diurutkan pending terlebih dahulu lalu ID terbaru. `pending_total` adalah jumlah pengajuan pending dalam filter di seluruh halaman, bukan hanya halaman yang sedang tampil.

Keempat endpoint pengajuan hanya untuk `peran=pengelola`, `is_ketua=true`, `status_akun=active`, `aktif=true`. Tanpa autentikasi 401; nasabah/pengelola biasa 403. Target keputusan harus pengelola non-ketua pending yang tidak diblokir. Target absen 404; nasabah/ketua/akun yang sudah diputuskan/diblokir 409 `PENGAJUAN_TIDAK_DAPAT_DIPUTUSKAN`.

Contoh respons keputusan 200 (kolom profil lainnya tetap disertakan):

```json
{"data":{"id":"12","kode_akun":"PGL-00012","nama":"Pengelola Uji","email":"pengelola@example.test","nomor_whatsapp":null,"peran":"pengelola","aktif":true,"is_ketua":false,"status_akun":"active","dibuat_pada":"2026-11-21T10:00:00.000Z","diperiksa_oleh":"9","diputuskan_pada":"2026-11-21T10:05:00.000Z","alasan_penolakan":null}}
```

`UPDATE ... WHERE status_akun='pending'` atomik membuat dua keputusan bersamaan menghasilkan satu 200 dan satu 409. Pemeriksa divalidasi lagi dari DB dan dikunci selama transaksi. Setiap request autentikasi JOIN ke akun terbaru; token lama tidak melewati pending/ditolak/blokir, dan ketua yang dicabut langsung mendapat 403 pada request berikutnya. Registrasi/profil menolak `is_ketua`, `status_akun`, `aktif`, dan parameter lain di luar allowlist; profil juga menolak perubahan `peran`.

## Pengujian

Isi `TEST_DATABASE_URL` dengan database PostgreSQL **terpisah** dari `DATABASE_URL`. Tidak ada lagi fallback ke Neon produksi. Helper juga menolak URL direct/pooler yang menunjuk database proyek yang sama.

```powershell
npm test
npm run check
npm run test:approval
npm run test:integration
npm run test:regression
npm run test:postman
```

Hasil yang benar-benar dijalankan tersedia di [VERIFICATION.md](VERIFICATION.md). Untuk pengujian resmi collection v3 dan variabelnya, lihat [POSTMAN.md](POSTMAN.md).
