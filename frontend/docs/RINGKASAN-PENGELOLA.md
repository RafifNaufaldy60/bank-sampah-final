# Ringkasan pengelola

Implementasi memakai satu `PengelolaLayout` dan satu `RingkasanPage` untuk kedua jenis pengelola. React Router terpasang **7.18.6**, menggunakan **Data Mode**, tanpa SSR. Redux tetap menjadi satu-satunya sumber state autentikasi.

## File implementasi

| File (relatif terhadap frontend) | Perubahan |
| --- | --- |
| `src/main.jsx`, `src/App.jsx` | `createBrowserRouter` / `RouterProvider`, StrictMode tetap aktif |
| `src/router/index.jsx` | Factory route untuk browser dan tes, nested route, Outlet, loader, error boundary, HydrateFallback |
| `src/router/session.js` | Koordinasi sesi, guard pengelola/ketua, loader Ringkasan, pembatalan dan penolakan respons lama |
| `src/layouts/PengelolaLayout.jsx` | Layout, navigasi bersama, header profil, logout, menu mobile berupa dialog |
| `src/components/pengelola/navigation.js` | Konfigurasi menu dan aset |
| `src/components/pengelola/ChairGuard.jsx` | Guard render ketika profil ketua berubah saat halaman sudah terbuka |
| `src/components/pengelola/format.js` | Format rupiah/berat tanpa konversi NUMERIC ke floating point, tanggal Indonesia/WIB |
| `src/components/pengelola/SummarySkeleton.jsx` | Skeleton dan initial fallback |
| `src/components/pengelola/RouteError.jsx` | Error, retry dengan revalidator, dan halaman 403 |
| `src/pages/pengelola/RingkasanPage.jsx` | Ringkasan, SummaryCard, RecentTransactions, TodaySchedule |
| `src/pages/pengelola/PlaceholderPage.jsx` | Satu placeholder dengan prop judul |
| `src/styles/pengelola.css` | Layout desktop/mobile, fokus keyboard, reduced motion |
| `src/assets/dashboard/*.svg` | 15 aset asli dari frame Figma, disimpan lokal |
| `src/features/auth/authSlice.js` | Invalidasi sesi dan generation counter untuk menolak data setelah logout/login baru |
| `src/layouts/RootLayout.jsx` | Bootstrap berpindah ke loader; pemantauan expiry dan dialog login dipertahankan |
| `src/components/GuestRoute.jsx`, `src/pages/Login.jsx` | Pengelola menuju Ringkasan, nasabah tetap `/akun`; menunggu logout selesai |
| `src/pages/AccountHome.jsx` | Tautan Ringkasan dan pemeriksaan boolean ketua yang ketat |
| `src/test/auth.test.jsx` | Tes autentikasi lama diadaptasi ke Data Router dan tujuan login pengelola |
| `src/test/pengelola.test.jsx`, `src/test/summaryFixture.js` | Tes dashboard dan fixture API khusus pengujian |

Di backend hanya ditambahkan **tes** `test/summary-contract.test.js`. Tidak ada perubahan endpoint, schema, migration, database, atau bootstrap ketua. File `CODEX-LANJUTAN.md` yang sudah ada tidak diubah.

## Kontrak API dan definisi metrik

Axios instance tetap `src/services/api.js`; base URL dari `VITE_API_URL`, default pengembangan `http://localhost:3000/api`. Frontend tidak mengakses Neon secara langsung.

| Tampilan / operasi | Endpoint dan field respons |
| --- | --- |
| Profil dan izin | `GET /auth/me` → `data.{id,nama,email,peran,is_ketua,status_akun,aktif}` |
| Nama pada sapaan | `GET /ringkasan` → `data.pengelola.nama` |
| Tanggal operasional | `data.periode.hari`, `data.periode.zona_waktu` |
| Nilai setoran hari ini | `data.metrik.nilai_hari_ini_rp` |
| Jumlah sampah terkumpul | `data.metrik.berat_hari_ini_kg` — **hari ini**, bukan sepanjang waktu |
| Jumlah transaksi hari ini | `data.metrik.transaksi_hari_ini` |
| Nasabah aktif | `data.metrik.nasabah_aktif` — akun `peran='nasabah' AND aktif=true`, bukan nasabah yang bertransaksi; view saat ini tidak menambahkan filter `status_akun` |
| Jadwal tersedia | `data.metrik.hari_tersedia_minggu_ini` — tanggal berbeda dengan minimal satu slot tersedia pada Senin–Minggu berjalan, termasuk hari yang sudah lewat |
| Transaksi terbaru | `data.transaksi_terbaru[]`: `setoran_id`, `nama_nasabah`, `jenis_sampah`, `berat_kg`, `nilai_setoran_rp`; maksimal 5, urut tanggal setoran lalu ID menurun |
| Jadwal hari ini | `data.jadwal_hari_ini[]`: `id`, `nama_layanan`, `jam_mulai`, `jam_selesai`, `tersedia`, `catatan`; termasuk slot tersedia dan tutup |
| Logout | `POST /auth/logout` mencabut sesi di server; token dibuang setelah sukses atau 401 |

Seluruh statistik memakai agregasi backend/view PostgreSQL yang sudah ada. Hari ditentukan dari `tanggal_setoran` dan `now() AT TIME ZONE 'Asia/Jakarta'`, bukan waktu perangkat atau waktu tombol simpan ditekan. View `v_riwayat_setoran` mencakup setoran tersimpan yang memiliki rincian, memberikan label **Terverifikasi** secara konstan; pengajuan penjemputan yang belum menjadi setoran tidak dihitung. Tidak ada filter status transaksi tambahan yang dibuat di frontend.

ID bigint dan nilai NUMERIC tetap string. Formatter memakai BigInt untuk bagian bilangan bulat dan mempertahankan bagian pecahan. Nilai nol ditampilkan sebagai data valid. Kegagalan API tidak diubah menjadi nol atau data contoh.

## Sesi, loader, dan akses

- Token adalah token opaque, tersimpan per tab bersama `expires_at` dalam sessionStorage; dikirim sebagai Bearer oleh Axios instance yang sudah ada. Tidak ada decoding JWT, refresh-token baru, cookie baru, atau AuthContext.
- Root loader dan loader privat berbagi coordinator. Loader anak menunggu `checkSession().unwrap()` / pemeriksaan sesi yang sedang berjalan; tidak mengandalkan urutan parent-child. Hasil profil tetap berada di Redux.
- Login response `akun` berasal dari backend; profil itu dipakai oleh Redux. Saat aplikasi dibuka ulang dengan token, `GET /auth/me` memverifikasi profil sebelum menu/data privat muncul.
- Akses pengelola mensyaratkan `peran === 'pengelola'`, `status_akun === 'active'`, `aktif === true`. Menu kelima hanya tampil untuk `user.is_ketua === true`; string `"true"` tidak diterima.
- Guard khusus pada loader dan render halaman persetujuan menghasilkan 403 bagi pengelola biasa. Nasabah/pengelola yang tidak memenuhi status juga mendapat 403; tanpa sesi diarahkan ke login.
- Backend tetap memeriksa sesi terkini, masa berlaku, aktif/status akun, dan role pada setiap endpoint privat. API persetujuan tetap memakai middleware ketua yang sudah ada.
- Ringkasan hanya diambil oleh async loader, dibaca dengan `useLoaderData`. Tidak ada fetch Ringkasan di effect atau thunk kedua.
- `HydrateFallback` pada route root menampilkan skeleton saat router pertama kali menunggu loader; tidak menambahkan SSR. `useNavigation` menangani perpindahan halaman, `useRevalidator` menangani refresh/retry, `errorElement` menangani kegagalan route.
- AbortSignal router diteruskan ke Axios. Logout membatalkan request Ringkasan melalui generation counter. Respons terlambat diperiksa terhadap generation dan token sebelum diterima; 401 lama tidak dapat menghapus sesi baru.
- Logout gagal tetap menyimpan token agar pencabutan sesi dapat dicoba lagi, dengan pesan eksplisit. Perilaku login/register, approval backend, lockout 5/15, dan tujuan nasabah dipertahankan.

## Route dan placeholder

`/pengelola` mengarah ke `/pengelola/ringkasan`.

| Route | Label navigasi sesuai Figma | Isi |
| --- | --- | --- |
| `/pengelola/ringkasan` | Ringkasan | Data backend |
| `/pengelola/catatan-setoran` | Catat Setoran | Placeholder berjudul Catatan Setoran |
| `/pengelola/kelola-jadwal` | Kelola Jadwal | Placeholder |
| `/pengelola/riwayat-nasabah` | Riwayat Nasabah | Placeholder |
| `/pengelola/persetujuan-akun` | Kelola Akun Pengelola | Placeholder berjudul Persetujuan Akun Pengelola, khusus ketua |

Keempat placeholder menampilkan “Halaman ini sedang dalam pengembangan.” dan “Kembali ke Ringkasan”. NavLink menandai menu aktif, seluruh navigasi berlangsung tanpa reload. Placeholder tidak meminta API fitur. Tombol Catat setoran, Lihat semua, dan Kelola jadwal pada Ringkasan mengarah ke route terkait.

Saat pemeriksaan awal belum ada UI fitur-fitur tersebut. Endpoint setoran, jadwal, riwayat/ekspor, penjemputan, serta persetujuan pengelola **sudah ada di backend dan dipertahankan**. Tidak dibuat form, tabel fitur lanjutan, atau aksi persetujuan baru.

## Desain dan verifikasi visual

Kedua frame berhasil dibaca melalui Figma: [ketua 516:1207](https://www.figma.com/design/HxQb1C8O4VfAwiZYC9ITEU/UI-Bank-Sampah-Digital?node-id=516-1207) dan [pengelola 192:2708](https://www.figma.com/design/HxQb1C8O4VfAwiZYC9ITEU/UI-Bank-Sampah-Digital?node-id=192-2708). Layout, palette, Poppins/Open Sans, sidebar, header, kartu, dan panel mengikuti frame. SVG diunduh ke repository; tidak ada URL aset sementara Figma saat runtime.

Perbedaan yang disengaja: data contoh diganti data API; sapaan netral “Selamat datang”; sublabel kenaikan persentase/nasabah bulanan diganti definisi periode karena data pembanding tidak tersedia. Lokasi “Loket utama” tidak di-hardcode karena endpoint jadwal Ringkasan tidak memuat lokasi. Jumlah transaksi mengikuti respons maksimum lima, bukan empat baris contoh Figma. Ditambahkan kontrol refresh dan status error/loading. Tidak ada frame mobile yang diberikan; mobile adalah adaptasi responsif dari dua frame desktop.

Chrome headless memakai intersepsi fixture API, bukan Neon. Diverifikasi pada 1440×1024 (ketua/biasa), 390, dan 320 piksel: tidak ada luapan horizontal; seluruh aset terlihat termuat dengan dimensi asli (logo 48, menu 19/18/17,7083, profil chevron 24, statistik 20, plus 18, panah 15 piksel). Empat placeholder diuji klik: tetap dokumen yang sama, menu aktif benar, **nol request API tambahan**. Dialog mobile membuka fokus di tombol tutup; Escape menutup dan mengembalikan fokus ke tombol buka.

Hasil screenshot lokal di `.tmp-auth/dashboard-chair-1440.png`, `.tmp-auth/dashboard-regular-1440.png`, `.tmp-auth/dashboard-regular-390.png`, dan `.tmp-auth/dashboard-chair-320.png` (artefak diabaikan Git).

Materi dibaca melalui ekstraksi lokal empat PDF yang disebut pengguna, tersedia di `.tmp-auth/*.pdf.txt`. Contoh cookie/endpoint dalam materi tidak mengganti kontrak autentikasi proyek. Referensi Data Router: [dokumentasi React Router 7.18.6](https://reactrouter.com/7.18.6/start/data/route-object).

## Menjalankan dan menguji

Pakai environment proyek yang sudah ada, tanpa membuat ulang database atau menjalankan bootstrap ketua:

```powershell
# Terminal backend
cd backend
npm run dev

# Terminal frontend, dari root repository
cd frontend
npm run dev
```

Buka `http://localhost:5173/login`. Pastikan `frontend/.env` memiliki `VITE_API_URL=http://localhost:3000/api` untuk backend lokal dan CORS backend mengizinkan origin frontend. Rahasia database tetap hanya di backend.

1. Login memakai **akun ketua yang sudah ada**, pilih Pengelola. Setelah menutup dialog sukses, pastikan URL Ringkasan, nama dari backend, dan lima menu. Klik menu kelima: placeholder persetujuan tampil.
2. Logout, lalu login memakai **pengelola biasa yang sudah disetujui dan aktif**. Pastikan Ringkasan yang sama dan empat menu. Buka `/pengelola/persetujuan-akun` langsung: 403.
3. Refresh URL `/pengelola/ringkasan` atau salah satu placeholder. Profil diperiksa lagi satu kali, lalu data/halaman dimuat. Di hosting produksi, konfigurasi SPA fallback semua URL frontend ke `index.html`; route API tetap ke Express.
4. Periksa Network: bootstrap `GET /auth/me`, Ringkasan `GET /ringkasan`; placeholder tidak meminta API fitur. OPTIONS CORS bila ada adalah preflight, bukan fetch data ganda.
5. Uji akun nasabah dan tab tanpa sesi: nasabah tetap menuju `/akun`, dashboard pengelola ditolak; tab tanpa sesi menuju login. Akun pengelola baru berstatus pending harus tetap melalui proses persetujuan yang sudah ada.
6. Gunakan fixture/tes di bawah untuk kasus pending/ditolak/nonaktif, expiry, error/empty/loading, logout/race, dan lockout. Jangan memanipulasi akun atau membuat transaksi produksi untuk pengujian.

```powershell
cd frontend
npm test -- --maxWorkers=1
npm run build

cd ../backend
node --test test/unit.test.js test/lockout-contract.test.js test/postman.test.js
node --test test/summary-contract.test.js
npm run check
```

Tes backend memakai fixture in-memory untuk kontrak HTTP Ringkasan, unit login/lockout, serta validasi koleksi Postman; tidak menjalankan koleksi terhadap server produksi. Tes frontend memakai Vitest + Testing Library, router nyata dan Axios mock, StrictMode tetap aktif.

Belum diverifikasi: sesi/data akun aktual di Neon, SQL integration suite terhadap PostgreSQL terpisah, dan konfigurasi fallback hosting produksi. Database tes lokal lama di port 55439 tidak aktif saat pekerjaan ini; tidak ada fallback ke database produksi. Tidak ada migration/seed/bootstrap atau transaksi uji yang dijalankan pada Neon.
