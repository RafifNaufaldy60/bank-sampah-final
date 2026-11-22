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
