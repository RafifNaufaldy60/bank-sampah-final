# Lanjutan pengerjaan Codex — Login & Register Bank Sampah

22 November 2026 · proyek React / Redux Toolkit / Express / PostgreSQL Neon

## Kondisi dari ZIP yang diterima

Pekerjaan Codex di dalam ZIP **sudah berisi** halaman login/register, popup berhasil login/register, Redux Toolkit, React Router, Axios Bearer token opaque, profil `/akun`, autentikasi peran, approval pengelola existing, lockout per akun 5 kegagalan/15 menit, migration 003, Postman v3, tes backend/frontend, serta dokumentasi. Perubahan itu **dipertahankan**: tidak dibuat ulang, tidak diganti JWT, tidak ditambah role baru.

File/fitur utama dari Codex:
- `frontend/src/pages/Login.jsx`, `Register.jsx`, `AccountHome.jsx`
- `frontend/src/features/auth/authSlice.js`, `app/store.js`, `services/api.js`
- `frontend/src/router/index.jsx`, `components/{ProtectedRoute,GuestRoute,SessionGate}.jsx`
- `frontend/src/components/auth/*`, `frontend/src/layouts/AuthLayout.jsx`, `styles/auth.css`, `assets/auth/*`
- `backend/src/services/login-service.js` dan `backend/migrations/003_login_lockout.sql`
- `backend/test/lockout.test.js`, `frontend/src/test/auth.test.jsx`, collection Postman, `backend/docs/AUTH-FRONTEND.md`

## Perbaikan tambahan pada lanjutan ini

1. **Pilihan role login sekarang berfungsi**, bukan hanya mengubah label tombol. Frontend mengirim `peran` saat login, backend menerimanya sebagai field opsional demi kompatibilitas klien API lama. Setelah password benar dan status akun diperiksa, peran yang tidak sama dengan database menghasilkan 401 `LOGIN_GAGAL` dan **tidak menerbitkan token**. Kewenangan tetap berasal dari data backend; is_ketua tidak pernah dipilih di frontend.
2. Tambahan skenario integration test PostgreSQL di `backend/test/lockout.test.js` untuk login role salah, role benar, klien lama tanpa role, dan role tidak dikenal.
3. Tes service terisolasi yang dapat dijalankan tanpa PostgreSQL: `backend/test/lockout-contract.test.js` (`npm run test:lockout:unit`). Ini **hanya unit test** dengan mock transaksi, bukan bukti transaksi/lockout persisten pada PostgreSQL asli.
4. Dua request Postman login sukses (nasabah/pengelola) sekarang menyertakan `peran` yang dipilih. Jumlah request tidak bertambah, dan klien API lama yang tidak mengirim `peran` tetap didukung.
5. Kontrak API di `backend/docs/AUTH-FRONTEND.md` dan `backend/docs/API.md` diperbarui.

## Pengujian yang benar-benar dilakukan dalam kelanjutan ini

- `node --test backend/test/lockout-contract.test.js`: **1 tes lulus, 0 gagal**; mencakup 5/15, reset counter, token tidak dibuat selama lockout/role salah, status pending, dan request konkuren pada simulasi transaksi.
- TypeScript parser dijalankan secara statis pada **70 file JS/JSX** (frontend/backend): **0 kesalahan parsing**.
- Audit keberadaan import lokal frontend/backend: **0 import relatif yang hilang**.
- Seluruh **20 SVG auth** tersedia dan tidak kosong.
- **106 file YAML Postman** berhasil diparse, tanpa error format.
- `node --check` untuk berkas backend yang dimodifikasi: **lolos**.

Batas lingkungan pengujian: host pemeriksaan ini Linux memakai **Node 22.16.0**, sedangkan backend meminta Node 24.19.0; `node_modules` dari ZIP berisi instalasi Windows yang sebagian tidak lengkap (contoh `dotenv/dist` dan `vitest/dist` hilang), registry npm tidak dapat diakses, dan PostgreSQL lokal **tidak tersedia**. Karena itu `npm test` backend secara penuh, Vitest frontend, build Vite, Postman CLI, serta tes integrasi PostgreSQL **tidak bisa dijalankan ulang di sini**. Hasil **18 tes frontend, 89 request/267 assertion Postman, dan build Vite berhasil** adalah *klaim dalam output Codex sebelumnya*, bukan hasil verifikasi baru. Screenshot desktop/mobile dalam ZIP adalah artefak Codex, bukan hasil browser baru pada sesi ini.

## Penting: migration belum dijalankan ke Neon

File baru dari Codex `backend/migrations/003_login_lockout.sql` menambahkan `login_failed_attempts` dan `login_locked_until`, dengan default aman untuk akun lama. Migration 001/002 tidak diubah. Tidak ada database Neon, akun ketua, akun nyata, atau data transaksi yang dimodifikasi oleh kelanjutan ini.

Di laptop Windows, sebelum migration, **backup database** dan verifikasi `.env` backend menggunakan database yang benar; periksa tabel `schema_migrations` bahwa 001/002 sudah tercatat dan checksum tetap cocok. Kemudian operator dapat menjalankan sendiri:

```powershell
cd backend
npm ci
npm run db:migrate
npm run db:verify
```

**Jangan** jalankan `npm run bootstrap:ketua` lagi; dua ketua existing tetap dipertahankan. Jangan uji 5 kegagalan login terhadap akun ketua asli.

## Instalasi dan verifikasi di laptop pengguna

Perlu Node.js **24.19.x** agar cocok dengan deklarasi `backend/package.json` (sebaiknya node versi 24 sesuai project). ZIP hasil lanjut **tidak menyertakan** `node_modules`, `.env` berisi rahasia, `.git`, atau cache browser. Gunakan `.env` lokal kamu yang sudah berfungsi; frontend dapat memakai `VITE_API_URL=http://localhost:3000/api`, backend `CLIENT_ORIGIN=http://localhost:5173`.

Backend setelah migration:

```powershell
cd backend
npm ci
npm run check
npm run test:lockout:unit
npm run dev
```

Frontend di terminal terpisah:

```powershell
cd frontend
npm ci
npm test
npm run build
npm run dev
```

Tes database **hanya pada database PostgreSQL terpisah dan khusus pengujian** (bukan Neon produksi), setelah mengatur `TEST_DATABASE_URL` dan memeriksa pengaman fixture:

```powershell
cd backend
npm run test:lockout
npm run test:approval
npm run test:integration
npm run test:regression
npm run test:postman
```

Untuk pengujian collection Postman penuh lihat `backend/docs/POSTMAN.md`; CLI resminya harus terinstal dan `TEST_DATABASE_URL` aman. Jangan menjalankan tes mutasi terhadap akun ketua/data produksi.

### Tes browser manual

- Buka `/register`, nasabah menjadi `active` dan mendapat popup sukses tanpa sesi; pengelola menjadi `pending` dan mendapat popup menunggu persetujuan ketua.
- Pilih peran login yang **sesuai** akun: nasabah → login nasabah, pengelola/ketua → login pengelola. Pilihan peran yang salah tidak memperoleh token.
- Akun `pending`/`ditolak` dan `aktif=false` tidak boleh memperoleh sesi; akun ketua tetap `peran=pengelola` dan hanya dibedakan dengan `is_ketua`.
- Di database uji, 4 sandi salah → 401, kesalahan kelima → 429 `LOGIN_LOCKED` (15 menit), sandi benar selama lockout ditolak; user lain tetap dapat login.
- Refresh `/akun` harus memulihkan nama+peran dari GET `/auth/me`; logout mencabut sesi backend dan kembali ke login.
- Uji 1440px desktop dan 320/390px mobile dengan screenshot Figma referensi; periksa pesan error, fokus keyboard, dan popup.

## Kontrak error utama

- `401 LOGIN_GAGAL` — sandi/email salah, akun nonaktif, atau *pilihan peran* salah (setelah sandi terverifikasi); tidak mengungkap role akun.
- `403 ACCOUNT_PENDING` — pengelola masih menunggu persetujuan.
- `403 ACCOUNT_REJECTED` — pengajuan ditolak.
- `429 LOGIN_LOCKED` — lockout **per akun**, dengan `error.locked_until`, `error.retry_after_seconds`, dan header `Retry-After`.
- `429 TERLALU_BANYAK_PERMINTAAN` — rate limit IP terpisah.

Catatan keamanan: session token frontend disimpan di `sessionStorage` agar sesi per-tab dipulihkan setelah refresh, sehingga perlindungan terhadap XSS wajib diperhatikan. Rate limit IP yang ada masih per-proses (in-memory); untuk multi-instance produksi sebaiknya gunakan shared rate-limit store.

Jika menyalin hasil ke repository Git yang sudah ada, **jangan menimpa folder `.git` atau `.env` milikmu**. Tinjau `git status`/`git diff` sebelum commit dan push.
