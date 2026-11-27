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

## Riwayat Nasabah

Route `/pengelola/riwayat-nasabah` memakai `src/router/history.js`, `src/pages/pengelola/RiwayatNasabahPage.jsx`, dan `src/styles/history.css`. Desain dibaca dari Figma node `192:4443`; tabel mempunyai enam kolom, pencarian, periode, unduh laporan, dan pagination. Frame tidak menyediakan interaksi rincian, sehingga halaman tidak menambahkan modal maupun aksi edit/hapus.

- Ketua dan pengelola biasa yang aktif memakai halaman serta data yang sama. Profil dan bootstrap sesi berasal dari Redux dan backend; loader menolak nasabah. Menu khusus ketua tetap mengikuti `is_ketua === true`.
- `GET /api/setoran?search=...&periode=...&page=1&limit=5` mengambil seluruh nasabah untuk pengelola. Untuk nasabah, endpoint existing tetap membatasi hasil ke akun pemilik; parameter URL tidak dapat memperluas cakupan.
- Nama, `kode_nasabah`, dan `kode_setoran` dicari melalui backend dengan debounce 350 ms. URL menyimpan pencarian/periode/halaman. AbortSignal dan generasi sesi mencegah hasil lama atau hasil setelah logout mengisi halaman.
- `GET /api/setoran/export.xlsx?search=...&periode=...` mengunduh semua hasil filter tanpa pagination. Bearer token hanya di header. XLSX existing menyimpan teks pengguna sebagai string, bukan formula, serta mempunyai sheet Riwayat dan Rincian.
- Transaksi multijenis ditampilkan satu baris dengan total agregat backend. Tanggal DATE diperlakukan sebagai tanggal Asia/Jakarta; nilai NUMERIC diformat tanpa konversi Number yang menghilangkan presisi.
- Loading awal, navigasi, hasil kosong, pencarian kosong, retry error, sesi kedaluwarsa, dan proses unduh mempunyai state masing-masing. Scroll horizontal dibatasi pada tabel.

Percepatan navigasi: bootstrap sesi tetap dibagikan antar-loader; halaman riwayat tidak meminta `/auth/me` tambahan setelah bootstrap. Pada pembacaan Kelola Akun, profil dan daftar diambil paralel, tetapi hasil ditahan sampai profil terbaru lolos. Action keputusan tetap memeriksa profil sebelum POST. Pool backend memakai ulang koneksi idle sampai 60 detik (sebelumnya 10 detik), dengan pemeriksaan autentikasi per request tetap aktif. Ini mengurangi pembukaan koneksi berulang, bukan jaminan latensi Neon atau jaringan.

Uji manual dengan akun dan database pengujian:

1. Login sebagai ketua lalu buka Riwayat Nasabah; ulangi dengan pengelola biasa. Data sama, menu Kelola Akun hanya tampil untuk ketua.
2. Cari nama, kode NSB, dan kode TRX yang benar-benar ada, termasuk transaksi di halaman berikutnya. Ubah periode dan pastikan kembali ke halaman 1; gunakan Hapus filter.
3. Pindah halaman dan buka ulang URL. Ketik pencarian berurutan dengan jaringan lambat; hasil harus mengikuti pencarian terakhir.
4. Unduh laporan dari halaman 2 dengan filter aktif. Buka XLSX dan bandingkan semua hasil filter dengan total backend, bukan hanya lima baris aktif.
5. Uji tanpa data, pencarian yang tidak cocok, jaringan terputus dan retry, sesi kedaluwarsa, serta lebar 320–1440 px. Login sebagai nasabah lalu buka URL pengelola: akses ditolak.

Verifikasi akhir: 87 tes frontend lulus; 29 tes unit/integrasi/regresi backend lulus pada PostgreSQL lokal terisolasi, termasuk XLSX dan formula. Pemeriksaan visual desktop/mobile memakai fixture browser; integrasi HTTP/database diuji terpisah. Tidak menguji beban atau latensi Neon produksi dan tidak menulis transaksi ke Neon operasional. Kontrak API tidak berubah, sehingga collection/environment Postman tidak membutuhkan perubahan.
## Kelola Jadwal pengelola

Daftar `/pengelola/kelola-jadwal`, tambah `/pengelola/kelola-jadwal/tambah`, dan edit `/pengelola/kelola-jadwal/:id/edit` memakai satu halaman/form bersama untuk pengelola aktif, baik ketua maupun bukan ketua. Sidebar/header/profil tetap memakai layout yang ada, dengan Kelola Jadwal aktif pada semua subroute. Profil berasal dari bootstrap sesi; backend memeriksa autentikasi dan peran setiap mutasi. Menu Kelola Akun tetap khusus ketua.

Referensi Figma node `595:1122` dan `595:1670` dibaca melalui integrasi Figma, termasuk screenshot. Aset SVG disimpan lokal di `src/assets/schedules`. Isi mengikuti kartu daftar, tile tanggal, jam, switch status, tombol dan tiga field desain. Tambah/edit adalah halaman terpisah sesuai scope; daftar di bawah form hanya pratinjau. Info perubahan yang tidak tersedia dalam API tidak diganti dengan angka dummy. Header/sidebar mengikuti komponen dashboard proyek, sehingga tidak diklaim identik piksel dengan seluruh frame Figma.

File utama: `src/pages/pengelola/KelolaJadwalPage.jsx`, `src/router/schedules.js`, `src/styles/schedules.css`, serta registrasi di `src/router/index.jsx`. Loader mengambil master, daftar, dan detail secara paralel setelah bootstrap sesi; tidak ada initial fetch kedua dalam effect. Data hanya disimpan oleh router, sementara field form lokal. Respons navigasi yang dibatalkan atau berasal dari sesi lama tidak digunakan. Mutasi melalui action/fetcher memakai API client dan token sesi yang sama.

Kontrak:

- `GET /layanan`: dropdown tiga layanan dari database; label `nama`, value `kode`. Kegagalan/daftar kosong menampilkan retry, tanpa fallback dummy.
- `GET /jadwal?dari=...&sampai=...&page=...&limit=20`: minggu berjalan secara default, kedua status, pagination server. Periode sebelumnya/berikutnya bisa ditelusuri berulang; Minggu ini mereset filter. URL menyimpan periode/halaman dan halaman di luar total dikoreksi.
- `GET /jadwal/:id` (baru): detail publik berdasarkan ID BIGINT string, bukan kode layanan. Mendukung edit langsung/refresh, 400 ID invalid dan 404 tidak ditemukan. Bentuk response sama dengan satu baris daftar. Dokumentasi API dan request Postman 17a diperbarui.
- `POST /jadwal` / `PATCH /jadwal/:id`: form memetakan `tanggal`, `layanan_kode`, `jam_mulai`, `jam_selesai`. Rentang tampilan `08.00–15.00` dikirim sebagai `08:00`/`15:00`. PATCH mempertahankan `catatan` dan status tersimpan. Aksi switch hanya mengirim boolean `tersedia` setelah konfirmasi.

Tanggal DATE dan waktu lokal WIB tidak dikonversi menjadi timestamp UTC. Jam harus mulai < selesai pada hari yang sama; jadwal tutup boleh tanpa kedua jam. Tidak ada larangan tambahan terhadap tanggal lampau/tumpang tindih. Status `tersedia`/`tutup` berasal dari boolean, tidak disimpulkan dari tanggal/jam sekarang. Pengajuan disetujui mencegah penutupan, sedangkan pengajuan disetujui/selesai mencegah perubahan tanggal/layanan/jam. Tidak ada DELETE, migrasi schema, pembatalan atau pemindahan pengajuan otomatis.

Setelah perubahan, loader daftar direvalidasi; Ringkasan mengambil data baru saat dibuka. API baca publik/nasabah tetap membaca tabel yang sama. Halaman jadwal khusus nasabah belum tersedia di frontend workspace ini, sehingga sinkronisasi UI nasabah belum dapat diuji; perubahan API publik setelah mutasi telah diuji. Pengajuan baru pada backend memakai `tanggal_diminta`, belum ID jadwal: pengecekan ketersediaan berlaku saat persetujuan mengaitkan jadwal. Tombol Pengajuan Penjemputan menuju placeholder yang menjelaskan fitur belum tersedia, sesuai batas scope.

Form menyediakan validasi/fokus error, input tetap tersimpan saat gagal, peringatan navigasi/beforeunload untuk perubahan belum disimpan, serta status pending dan sukses. Klik simpan berulang diblokir selama proses. POST jadwal belum mendukung idempotency key backend: hasil jaringan yang tidak pasti menonaktifkan retry form sampai pengguna memeriksa daftar, bukan menjanjikan deduplikasi lintas tab/perangkat. Toggle yang tidak pasti menyediakan muat ulang sebelum retry.

Verifikasi 27 November 2026:

- Frontend: `npm run lint` selesai dengan satu warning lama `set-state-in-effect` di layout mobile; `npm run build` berhasil dengan warning chunk JS >500 kB; `npm test -- --maxWorkers=1 --reporter=dot` **113 tes lulus**, termasuk 26 tes jadwal.
- Backend: `npm run check` berhasil. Unit, integrasi HTTP/PostgreSQL, regresi, persetujuan, dan validasi Postman **43 tes lulus**; integrasi 19 tes diulang setelah menambahkan pembuktian pembuatan jadwal oleh ketua, seluruhnya lulus. PostgreSQL lokal memakai schema pengujian terisolasi; tidak menulis pada Neon operasional.
- Chrome headless pada lebar 320, 390, 768, 1190, 1440 untuk daftar/tambah/edit: aset termuat, tanpa exception JavaScript dan tanpa overflow horizontal halaman. Screenshot desktop dan ponsel diperiksa. Browser menggunakan fixture API; HTTP/database nyata diuji terpisah. Artefak lokal ada di `.tmp-approval/schedule-*.png` dan `schedule-visual-metrics.jsonl` (diabaikan Git).
- Belum menguji end-to-end browser terhadap Neon, latensi produksi, maupun collection Postman 90 request melalui CLI. Tidak ada library baru.

Uji manual dengan backend/database pengujian:

1. Login ketua dan pengelola biasa; buka daftar, tambah, serta URL edit langsung lalu refresh. Keduanya punya kemampuan sama; menu Kelola Akun hanya untuk ketua.
2. Pilih tiap layanan dari dropdown, tanggal, dan jam valid lalu simpan. Periksa tanggal/layanan/jam pada daftar dan Ringkasan. Coba klik simpan berulang saat jaringan lambat.
3. Ubah jadwal yang dipilih; coba tanggal kosong, jam terbalik, serta Batal/Tutup setelah mengubah input. Konfirmasi meninggalkan form tidak menyimpan.
4. Nonaktifkan/aktifkan jadwal dan muat ulang API publik. Untuk jadwal terkait penjemputan disetujui, pastikan penutupan/perubahan struktur ditolak dan riwayat tidak hilang.
5. Telusuri minggu sebelumnya/berikutnya, pagination jika >20 baris, serta Minggu ini untuk reset. Buka URL periode/halaman langsung.
6. Simulasikan API gagal, layanan master kosong, ID invalid/tidak ditemukan, sesi kedaluwarsa, dan koneksi terputus saat simpan. Input tetap ada dan hasil yang tidak pasti meminta pemeriksaan daftar.
7. Uji keyboard dialog, menu mobile, serta layar 320–1440 px. Sebagai nasabah, pastikan halaman pengelola ditolak dan POST/PATCH jadwal menghasilkan 403; GET publik tetap dapat dibaca.
