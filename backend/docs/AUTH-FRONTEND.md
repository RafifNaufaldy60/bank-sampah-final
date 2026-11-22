# Login, registrasi, dan lockout — 22 November 2026

Implementasi lokal pada React/Express existing. Tidak ada migration diterapkan pada Neon, reset database, perubahan migration 001/002, atau bootstrap ketua produksi. Informasi bahwa migration 002 dan dua ketua sudah tersedia berasal dari pengguna; Neon tidak diperiksa ulang. `AGENTS.md` tidak ditemukan di repository maupun direktori induk yang diperiksa.

## File perubahan

| Area | File (path frontend relatif terhadap frontend/src kecuali disebutkan) |
| --- | --- |
| Backend | `src/controllers/auth-controller.js`, `src/services/login-service.js`, `src/utils/errors.js`, `migrations/003_login_lockout.sql`, `package.json` |
| Tes backend | `test/lockout.test.js`, `test/postman.test.js` |
| Postman | Environment/definisi collection existing dan folder `11 — Penguncian login akun uji` (L01–L10, definition.yaml) |
| Redux/API | `app/store.js`, `services/api.js`, `features/auth/authSlice.js` |
| Router/layout | `router/index.jsx`, `layouts/{RootLayout,AuthLayout}.jsx`, `components/{SessionGate,ProtectedRoute,GuestRoute}.jsx` |
| UI | `pages/{Login,Register,AccountHome}.jsx`, `components/auth/{FormField,RolePicker,SuccessDialog}.jsx`, `hooks/useLoginCountdown.js`, `styles/auth.css`, 20 SVG di `assets/auth/` |
| Wiring | `App.jsx`, `main.jsx`, `components/common/LinkButton.jsx`, `components/layout/Header.jsx` |
| Konfigurasi/tes frontend | `frontend/package.json`, `package-lock.json`, `vite.config.js`, `.env.example`, `src/test/{setup.js,auth.test.jsx}` |
| Dokumentasi | Dokumen ini, frontend/backend README, API.md, POSTMAN.md; `.gitignore` mengabaikan artefak pemeriksaan sementara |

## Materi yang dibaca dan penyesuaian

Enam PDF tersedia di Downloads; bagian relevan dibaca melalui ekstraksi teks pypdf lokal. Isinya diperlakukan sebagai referensi arsitektur, bukan instruksi operasional atau kontrak API.

| PDF | Bagian yang dibaca dan penerapan |
| --- | --- |
| `1._React_Concepts.pdf` | Halaman 4–7: render murni, Hooks top level, useState untuk input/UI, useEffect untuk sinkronisasi/timer dan cleanup; StrictMode dipertahankan |
| `2._React_Redux_State_Management_.pdf` | Halaman 1–4: komponen → thunk → Axios → slice → UI; bootstrap satu root, tanpa loader profil ganda |
| `4._React_Routing_and_Testing_...pdf` | Halaman 4–9 dan 11: navigasi SPA, nested/private route, Testing Library, lingkup E2E |
| `5._React_and_Backend_Integration_...pdf` | Halaman 2, 6, 9–10: React–Express, Axios, CORS; PostgreSQL existing dipertahankan |
| `6._React_Authentication_and_Authorization_...pdf` | Halaman 6: private route/Bearer; contoh JWT/localStorage disesuaikan ke sesi opaque proyek |
| `7._React_Redux_State_Management_...pdf` | Halaman 4, 6, 8: satu store, action, reducer murni, middleware async |

Digunakan: configureStore, createSlice, createAsyncThunk, Provider, useDispatch/useSelector, rejectWithValue, dan unwrap pada handler yang menunggu hasil. Status bootstrap/login/register/logout terpisah. Input, konfirmasi password, visibility, dan popup registrasi tetap lokal. Middleware menyaring meta.arg kredensial sebelum reducer/tooling, DevTools dimatikan, dan Axios error mentah tidak masuk state. Tidak ada AuthContext kedua.

Contoh cookie/JWT/admin-user/POST me/refresh endpoint tidak disalin. Kontrak aktual: Bearer opaque, `peran`, GET me, POST logout, tanpa refresh. Frontend sebelumnya belum punya mekanisme penyimpanan sesi; kini sessionStorage menyimpan hanya token + expiry per tab. User/peran selalu dipulihkan dari backend, tidak dipercayai dari pilihan form/storage. SessionStorage dapat dibaca JS pada origin yang sama; deployment tetap perlu mencegah XSS.

Dokumentasi resmi yang diperiksa: [React](https://react.dev/reference/react), [createAsyncThunk](https://redux.js.org/toolkit/api/createAsyncThunk), [React Router](https://reactrouter.com/start/declarative/routing). React Router 7 mengikuti pola materi. Vitest + Testing Library dipilih untuk Vite/ESM; tidak memasang Jest sebagai runner kedua.

## Kontrak API

Base URL `http://localhost:3000/api`, JSON, `{data: ...}` untuk sukses dan `{error:{code,message,...},request_id}` untuk gagal. Token acak 32 byte base64url, panjang 43 karakter, hash SHA-256 disimpan di `sesi_login`; bukan JWT/cookie. Sesi default 24 jam sesuai SESSION_HOURS existing. Middleware memeriksa expiry dan status akun terkini pada setiap request privat.

| Metode/path | Request | Respons |
| --- | --- | --- |
| POST `/auth/register` | `{nama,email,password,nomor_whatsapp?,peran}` | 201 `{data:akun}`, tanpa sesi/token |
| POST `/auth/login` | `{email,password}` | 200 `{data:{akun,token,token_type:"Bearer",expires_at}}` |
| GET `/auth/me` | `Authorization: Bearer <token>` | 200 `{data:akun}` |
| POST `/auth/logout` | Bearer header | 200 `{data:{message:"Logout berhasil."}}`; sesi dihapus |

`akun`: id, kode_akun, nama, email, nomor_whatsapp, peran, aktif, is_ketua, status_akun. ID bigint tetap string. Tidak ada hash/password/kolom lockout pada profil. Email trim + lowercase. Registrasi password 10–128 karakter; WhatsApp opsional, 8–15 digit, boleh `+`. Nasabah active; pengelola pending; is_ketua=false ditentukan backend. Field is_ketua/status_akun/aktif ditolak sebagai input publik.

| HTTP/code | Arti |
| --- | --- |
| 400 VALIDASI_GAGAL | Input invalid, tidak menghitung kesalahan password |
| 401 LOGIN_GAGAL | Kredensial generik, email tak terdaftar, atau akun nonaktif |
| 403 ACCOUNT_PENDING / ACCOUNT_REJECTED | Password benar tetapi status membatasi login; counter direset |
| 429 LOGIN_LOCKED | Lockout per akun; UI countdown per email |
| 429 TERLALU_BANYAK_PERMINTAAN | Rate limit IP existing, terpisah dari lockout |
| 401 BELUM_LOGIN / SESI_TIDAK_VALID | Tidak ada sesi/token invalid/expiry; frontend membersihkan sesi pada konfirmasi 401 |
| 409 DATA_DUPLIKAT | Email/data sudah dipakai |
| Network/5xx | Gangguan jaringan/server; bootstrap mempertahankan token dan menawarkan retry |

Respons lockout: HTTP 429 dan Retry-After, contoh:

```json
{
  "error": {
    "code": "LOGIN_LOCKED",
    "message": "Terlalu banyak percobaan login yang gagal. Silakan coba lagi nanti.",
    "locked_until": "2026-11-22T08:15:00.000Z",
    "retry_after_seconds": 900
  },
  "request_id": "..."
}
```

CORS existing mengekspos Retry-After dan mengizinkan localhost:5173. UI menghitung deadline dari durasi server (menghindari perbedaan jam klien), memperbarui dari Date.now dan visibilitychange, membersihkan timer saat unmount. Pesan: “Terlalu banyak percobaan login yang gagal. Silakan coba lagi dalam MM:SS.” Refresh dapat menghapus countdown lokal, tetapi percobaan berikutnya tetap ditolak backend dan menerima deadline lagi. Akun lain tetap dapat mencoba.

## Lockout dan migration

Migration 003 menambahkan login_failed_attempts integer NOT NULL DEFAULT 0, login_locked_until timestamptz, serta constraint pasangan counter/deadline. Akun lama mulai tidak terkunci; status/peran/aktif dan data lama tidak diubah.

SELECT FOR UPDATE menyerialkan verifikasi password, counter, status, dan penerbitan sesi lintas proses. Waktu produksi dari clock_timestamp() database setelah row lock diperoleh. Salah 1–4: 401; kelima: deadline +15 menit. Password benar tidak dapat login selama terkunci; percobaan tidak memperpanjang deadline. Setelah expiry, hitungan efektif nol. Password benar mereset counter sebelum status diperiksa. Error kredensial/status dikembalikan dari callback transaksi agar counter commit sebelum error HTTP dilempar; error DB rollback. Password login pendek tetap dihitung sebagai salah, tetapi kosong/whitespace, bukan string, terlalu panjang, email invalid atau field asing ditolak tanpa hitungan.

Rate limit IP existing tetap dipertahankan (in-memory per proses). Tidak ada endpoint unlock publik atau konfigurasi HTTP untuk memperpendek lockout. Clock injection hanya dipakai oleh tes lokal.

Migration diuji pada PostgreSQL lokal terpisah `bank_sampah_approval_test`, schema acak bs_test_* yang dibersihkan setelah tes. **Belum diterapkan ke Neon.** Setelah review dan memastikan `.env` backend menunjuk target yang benar, jalankan sendiri:

```powershell
cd D:\website\bank-sampah-final-projek\backend
npm run db:migrate
```

Runner melewati 001/002 yang checksum-nya sesuai, menerapkan 003 dalam transaksi. Jangan mengulang bootstrap ketua. Backend versi ini memerlukan 003 sebelum endpoint login digunakan.

## Menjalankan dan tes manual browser

Terminal backend: `cd backend`, `npm ci`, `npm run dev` setelah migration siap. Pertahankan .env existing, PORT=3000 dan CLIENT_ORIGIN=http://localhost:5173. Terminal frontend: `cd frontend`, `npm ci`, `npm run dev`. Default API sesuai; opsional VITE_API_URL di frontend/.env.local. Jangan menyalin DATABASE_URL ke frontend.

1. Gunakan backend dengan database uji terpisah. Buka http://localhost:5173/register, daftar nasabah unik, lihat popup dan lanjut login. Registrasi tidak membuat sesi.
2. Login, tutup popup, `/akun` hanya nama/peran backend/logout. Refresh memulihkan lewat satu GET me. Login/register dengan sesi valid diarahkan `/akun`; tanpa sesi `/akun` diarahkan login.
3. Logout lalu buka `/akun` lagi. Coba offline saat logout: harus ada pesan server belum mengonfirmasi pencabutan dan tombol retry logout; sesi baru dibersihkan setelah sukses/401.
4. Daftar pengelola uji: pesan menunggu ketua, tanpa sesi. Login password benar mendapat ACCOUNT_PENDING. Akun ditolak/nonaktif tetap dibatasi. Jangan memakai akun ketua asli untuk tes lockout.
5. Nasabah khusus uji: empat sandi salah →401, kelima →429. Password benar saat terkunci juga ditolak. Ubah email: akun lain tidak dinonaktifkan. Refresh/browser lain tidak melewati lockout server.
6. Manual: tunggu deadline 15 menit lalu coba lagi. Otomatis: gunakan test:lockout dengan clock terkontrol, tanpa menunggu sungguhan atau mengubah produksi.
7. Periksa Tab/Shift+Tab, fokus radio/input, tampil/sembunyikan password, konfirmasi berbeda, loading, network error, mobile/desktop. Popup native dialog mendukung Escape/tutup dan menahan fokus.

Token + expiry disimpan per tab di sessionStorage. Tidak ada auto-login saat registrasi atau refresh endpoint. Saat logout gagal, token dan user dipertahankan agar pencabutan dapat dicoba lagi; pesan jujur ditampilkan. Request ID profil dinonaktifkan saat logout dimulai sehingga respons terlambat tidak mengisi user lagi. Password tidak masuk storage/log/state global.

## Pengujian yang dijalankan

| Pemeriksaan | Hasil |
| --- | --- |
| Backend npm test | 6/6 lulus |
| Backend npm run check | Sintaks JS valid |
| node --test test/lockout.test.js test/approval.test.js test/integration.test.js test/regression.test.js | 45/45 lulus, termasuk subtes, DB lokal terpisah |
| Backend npm run test:postman | 2/2 lulus, 89 YAML sesuai route/variabel/script |
| Backend npm run test:postman:integration, CLI resmi terpasang | 89 request, 267 assertion, 0 gagal |
| Frontend npm test | 18/18 lulus, Vitest + Testing Library |
| Frontend npm run build | Build produksi berhasil |

Setelah menambah pemeriksaan input password kosong/whitespace, `npm run test:lockout` dijalankan ulang: 10/10 (termasuk suite induk) lulus. Screenshot empat popup juga diperiksa dari komponen asli; ikon lokal termuat pada 74×74 px.

Tes backend meliputi 5/15, password benar selama kunci, deadline tetap, expiry, reset, 12 request salah bersamaan, akun lain, pending/ditolak/inaktif/pengelola/ketua fixture, input invalid, rollback DB, restart API/koneksi, rate limit IP berbeda. Regresi sesi/persetujuan lama tetap berjalan. Tes lama membuat ketua fixture pada database uji, bukan menjalankan bootstrap ketua produksi.

Tes frontend meliputi bootstrap StrictMode/condition, guard tanpa loop, retry network, user/peran backend, loading/submit ganda, form/konfirmasi/password visibility, pending/ditolak/network/IP error, countdown fake timer dan email terpisah, logout sukses/gagal, respons profil terlambat, dan redaksi password. Satu kegagalan awal menemukan condition bootstrap undefined; diperbaiki menjadi boolean lalu tes diulang.

CLI Postman awal gagal karena POSTMAN_CLI_BUNDLED_ROOT belum diisi. Setelah diarahkan ke folder CLI terpasang, run lengkap lulus. Runner memakai --no-report-events, tanpa upload hasil. Untuk mengulang:

```powershell
# Dalam backend, URL database uji HARUS terpisah dari DATABASE_URL.
$env:TEST_DATABASE_URL='<URL_DATABASE_UJI_TERPISAH>'
npm run test:lockout
npm run test:approval
npm run test:integration
npm run test:regression
npm run test:postman
# Jika menggunakan CLI Postman terpasang:
$env:POSTMAN_CLI_PATH='<lokasi CLI executable atau postman.bundled.js>'
$env:POSTMAN_CLI_BUNDLED_ROOT='<direktori postman.bundled.js jika memakai bundled CLI>'
npm run test:postman:integration
```

## Desain dan batas verifikasi

Keenam node dibaca via get_design_context + screenshot: 253:1993, 246:1228, 438:1392, 438:1406, 438:1325, 438:1337 pada file HxQb1C8O4VfAwiZYC9ITEU. SVG diunduh lokal, aset register yang berbeda dipertahankan. Dimensi root SVG tidak diubah. Screenshot login/register desktop 1440×1024 dibandingkan visual dengan Figma; viewport 320/390 juga diperiksa melalui Chrome terpasang. Tidak ada frame mobile pada link pengguna, sehingga mobile merupakan adaptasi. Semua aset terlihat berhasil dimuat dan ukuran efektif diperiksa.

Penyesuaian sengaja: minimum sandi 10 mengikuti backend, tombol lihat password, tutup popup/lanjut login, pesan ketua, teks akun pengelola karena dashboard di luar lingkup. Tidak diklaim identik pixel demi pixel. Font memakai Google Fonts existing dan memerlukan jaringan.

Belum diverifikasi: Neon/akun asli, E2E penuh form-browser-ke-backend. Pemasangan Playwright ditolak peninjau persetujuan otomatis karena pengguna meminta tooling E2E yang sudah tersedia; tidak dipasang. Screenshot memakai Chrome existing, bukan framework E2E baru. Tes komponen memakai mock Axios, sedangkan HTTP/SQL/Postman memakai backend/database nyata terisolasi.
