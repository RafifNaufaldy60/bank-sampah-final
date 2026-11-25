# Bank Sampah — React frontend

Halaman `/login`, `/register`, `/akun` memakai Redux Toolkit, React Router 7 dan Axios. Beranda existing ada di `/`. Lihat [laporan implementasi, kontrak API, migration dan tes](../backend/docs/AUTH-FRONTEND.md).

Gunakan Node 24.19.x. Dari folder `frontend`:

```powershell
npm ci
npm run dev
```

Buka `http://localhost:5173/login`. Vite memakai port 5173 tetap agar sesuai CORS. Backend default `http://localhost:3000/api`. Opsional salin `.env.example` ke `.env.local` dan sesuaikan `VITE_API_URL`; jangan menaruh DATABASE_URL atau rahasia backend di frontend. Origin frontend harus tercantum di CLIENT_ORIGIN backend.

Backend memerlukan migration `003_login_lockout.sql` sebelum login. Migration belum diterapkan pada Neon oleh pekerjaan ini. Jangan mengulang bootstrap ketua atau membuat ulang database.

```powershell
npm test
npm run build
```

Tes komponen: Vitest + React Testing Library, sesuai Vite/ESM. Tidak ada runner Jest kedua atau framework E2E baru. Preview build: `npm run preview -- --port 5173` setelah dev server dihentikan. Hosting SPA perlu fallback semua route ke `index.html`.

Token opaque + expiry disimpan per tab di `sessionStorage` (`bank-sampah.session`). Refresh memulihkan identitas dari `GET /auth/me` di satu root layout. Tidak ada JWT decoding, cookie auth, atau refresh endpoint. Password hanya berada di form/thunk/API; Redux middleware menyaring argumen kredensial dan DevTools dimatikan. Tidak ada AuthContext kedua.

Logout gagal mempertahankan sesi untuk retry dan menampilkan pesan bahwa server belum mengonfirmasi pencabutan. Respons profil terlambat tidak memulihkan user setelah logout. Gangguan jaringan saat bootstrap memberi retry, bukan langsung menghapus sesi.

Keenam frame Figma dibaca beserta screenshot/aset. SVG lokal ada di `src/assets/auth/`. Desktop mengikuti frame dua kolom 1440×1024; mobile memakai header merek ringkas dan satu kolom. Penyesuaian fungsional: sandi minimal 10 sesuai backend, lihat/sembunyikan password, tombol tutup/lanjut pada popup, pesan persetujuan oleh ketua. Pilihan peran login hanya presentasi; peran final selalu dari backend.

## Kelola Akun Pengelola — 24 November 2026

Placeholder diganti pada URL existing `/pengelola/persetujuan-akun`. Frame [Figma 539:1089](https://www.figma.com/design/HxQb1C8O4VfAwiZYC9ITEU/UI-Bank-Sampah-Digital?node-id=539-1089) dibaca melalui design context dan screenshot. Tabel, panel detail, tipografi, warna, baris terpilih, dan tombol mengikuti frame. Sidebar bersama tetap dipertahankan sesuai lingkup pekerjaan: warnanya hijau gelap dan lebarnya berbeda dari sidebar terang pada frame. Tidak ada aset baru pada area tabel/detail. SVG layout bersama tetap digunakan.

Desain menampilkan contoh status campuran, tetapi implementasi mengambil **pending saja**, sesuai alur yang diminta. Tidak ada filter atau pencarian pada frame, sehingga tidak ditambahkan. Pagination dan tombol muat ulang adalah tambahan fungsional; formulir alasan muncul dalam panel setelah tombol Tolak diklik. Tidak ada frame mobile atau formulir penolakan terpisah pada referensi yang diberikan. Mobile memakai panel bertumpuk dan tabel yang dapat digeser di dalam panel.

### File dan kontrak

- `src/router/index.jsx`, `src/router/approvals.js`: async loader daftar/detail dan action keputusan pada route existing.
- `src/pages/pengelola/KelolaAkunPage.jsx`: `useLoaderData`, `useFetcher`, pemilihan via query URL, indikator navigasi/detail/keputusan/revalidasi.
- `src/components/pengelola/ApprovalTable.jsx`, `ApprovalDetail.jsx`, `ApprovalStatus.jsx`, `approvalFormat.js`: tabel, detail, alasan penolakan, pesan hasil, format tanggal/status.
- `src/styles/approvals.css`: tampilan desktop/mobile.
- `src/components/pengelola/ChairGuard.jsx`, `navigation.js`, `SummarySkeleton.jsx`, `src/layouts/PengelolaLayout.jsx`, `src/features/auth/authSlice.js`: izin ketua, menu, judul, HydrateFallback, dan penerimaan profil backend yang terikat generasi sesi.
- `src/test/approvals.test.jsx`, `src/test/pengelola.test.jsx`: pengujian halaman dan penyesuaian tes placeholder.
- `../backend/src/controllers/approval-controller.js`: filter `status=all` dan jumlah pengajuan menunggu lintas halaman; kontrak default `status=pending` tetap tersedia.

Axios bersama memakai token ketua yang sedang login. Kontrak aktual:

| Aksi | Endpoint dengan prefix `/api` | Payload/respons |
| --- | --- | --- |
| Daftar | `GET /pengajuan-pengelola?status=all&page=1&limit=20` | `{ data: [...], meta: { page, limit, total, total_pages, pending_total } }` |
| Detail | `GET /pengajuan-pengelola/:id` | `{ data: akun }` |
| Setujui | `POST /pengajuan-pengelola/:id/setujui` | `{}` → `{ data: akun }` |
| Tolak | `POST /pengajuan-pengelola/:id/tolak` | `{ alasan_penolakan }`, trim 1–1.000 karakter → `{ data: akun }` |

ID tetap string, termasuk nilai di atas batas integer aman JavaScript. Tidak ada pembuatan sesi target, perubahan password, atau pengiriman `is_ketua` pada keputusan.

### Proteksi dan pemilik data

Root loader menyelesaikan pemeriksaan sesi sebelum konten ditampilkan. Kunjungan pertama memakai profil bootstrap dari `/auth/me`; navigasi berikutnya, retry, revalidasi, dan action memeriksa profil terbaru lagi. Izin diberikan hanya jika `peran === 'pengelola'`, `is_ketua === true`, `status_akun === 'active'`, dan `aktif === true`. Nama, email, dan ID tidak menentukan izin. Sinyal penolakan API 403 hanya mencabut akses/menu, tidak pernah memberikan izin. Pengguna tanpa sesi menuju login; akun lain mendapat 403.

Router menjadi satu pemilik daftar/detail. Tidak ada pengambilan data halaman melalui effect atau thunk tambahan. Pergantian pilihan membatalkan request sebelumnya. AbortSignal dan generasi sesi mencegah respons terlambat setelah logout mengisi data kembali. Tombol keputusan memerlukan detail target yang valid dan pending. Guard submit pada komponen dan action mencegah POST ganda; target ditangkap saat submit.

Daftar menampilkan status menunggu, disetujui, dan ditolak, dengan pengajuan pending diurutkan lebih dahulu. `pending_total` menghitung seluruh pengajuan menunggu, termasuk yang berada di halaman lain. Klik jumlah menunggu untuk memuat ulang daftar. Nomor pada panel detail mengikuti nomor baris; ID backend tetap digunakan untuk request.

Sesudah action, revalidasi otomatis router mengambil ulang daftar dan status target. Tidak ada pemanggilan revalidasi tambahan setelah action. Akun yang sudah diputuskan tetap muncul dengan status terbaru dan tombol keputusan nonaktif; pilihan tetap ada jika target masih berada di halaman yang sama. Jika halaman terakhir kosong, loader mengambil halaman terakhir yang masih valid berdasarkan metadata backend. Query URL adalah permintaan halaman; metadata respons menentukan halaman aktif yang ditampilkan.

401 menghapus sesi sesuai pola proyek; 403 melepas halaman beserta data privat dan menyembunyikan menu. 404, 409, validasi, dan gangguan server mempunyai pesan tersendiri. Jika respons POST hilang/5xx, hasil disebut belum diketahui, tidak diklaim gagal dan tidak dikirim ulang otomatis. GET saat revalidasi memverifikasi status; jika GET juga gagal, keputusan tetap diblokir sampai retry GET berhasil. 409 memuat ulang keadaan tanpa menimpa keputusan ketua lain.

### Verifikasi

- `npm test` di frontend: **71 tes lulus**, mencakup auth, Ringkasan, halaman baru, bigint, akses, keyboard, race detail, submit ganda, 401/403/404/409, alasan penolakan, hasil tidak pasti, retry, pagination, dan logout.
- `npm run build`: berhasil; Vite memberi peringatan chunk utama sekitar 502 kB sebelum gzip.
- `npm run lint`: exit 0; satu warning existing `react(set-state-in-effect)` pada penutupan navigasi mobile di layout bersama.
- `node --test test/unit.test.js test/lockout-contract.test.js test/summary-contract.test.js` di backend: **12 tes lulus**.
- `node --test test/approval.test.js test/lockout.test.js test/integration.test.js test/regression.test.js` dengan `TEST_DATABASE_URL` lokal terpisah: **46 tes lulus**. Tidak mengakses/mengubah Neon.
- Chrome headless + React + Express + PostgreSQL uji sungguhan: registrasi pending, penolakan login sebelum persetujuan, klik Setujui, status/database/audit, `is_ketua=false`, login password semula, sesi ketua tetap, klik Tolak beserta alasan, dan logout berhasil. Tidak ada exception JavaScript browser.
- Screenshot 1440×1024, 390×1024, 320×1024 diperiksa. Tidak ada overflow halaman; tabel mobile memiliki scroll internal. Semua aset layout yang terlihat termuat. Artefak lokal sementara: `.tmp-approval/approval-1440.png`, `approval-390.png`, `approval-320.png` dari root proyek.

Pengujian runtime produksi/Neon dan kesesuaian dengan frame mobile yang belum diberikan tidak diklaim terverifikasi. Fixture membuat schema/akun fiktif di database lokal khusus tes dan membersihkannya setelah selesai.

### Uji manual dengan akun/database pengujian

1. Jalankan frontend dan backend yang menunjuk database uji terpisah. Pakai ketua uji yang sudah tersedia; jangan bootstrap ulang ketua produksi.
2. Daftar akun baru melalui `/register`, pilih Pengelola. Catat email/password. Login sebelum persetujuan harus ditolak sebagai pending.
3. Pada browser/profil terpisah, login sebagai ketua uji dan buka **Kelola Akun Pengelola**. Pastikan identitas header tetap ketua.
4. Pilih baris akun uji dengan klik atau Tab lalu Enter. Cocokkan nama/email/detail. Klik **Setujui** satu kali dan tunggu pesan berhasil.
5. Akun tetap berada di daftar dengan status Disetujui; jumlah menunggu berkurang dan tombol keputusan nonaktif. Periksa akun target melalui API: status active, is_ketua false, diperiksa_oleh ketua, diputuskan_pada terisi.
6. Di browser pertama, login dengan email/password pendaftaran semula. Akun masuk sebagai pengelola biasa dan tidak mempunyai menu Kelola Akun; akses langsung URL mendapat 403. Browser ketua tetap login sebagai ketua.
7. Daftar akun uji kedua. Pilih **Tolak**, isi alasan, kirim. Periksa status ditolak dan alasan tersimpan; akun tersebut tidak dapat login.
8. Refresh URL ketua, periksa Ringkasan, lalu logout. URL privat harus kembali ke login. Uji juga lebar desktop/mobile, halaman kosong, retry jaringan, dan dua ketua memutuskan target sama (keputusan kedua mendapat 409).
