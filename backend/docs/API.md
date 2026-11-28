# Kontrak API Bank Sampah Digital

Base URL lokal: `http://localhost:3000/api`. Semua contoh adalah data fiktif, bukan data akun Neon. Contoh tanggal memakai 18 November 2026; sesuaikan dengan tanggal operasional saat mencoba.

Pembaruan autentikasi 22 November 2026: lihat [kontrak lockout dan integrasi React](AUTH-FRONTEND.md). Kesalahan password kelima mengunci akun selama 15 menit, persisten pada database. Respons HTTP 429 `LOGIN_LOCKED` menyertakan `error.locked_until`, `error.retry_after_seconds`, dan header `Retry-After`. Percobaan selama terkunci tidak memperpanjang deadline. Kode ini berbeda dari rate limit IP `TERLALU_BANYAK_PERMINTAAN`. Login memerlukan migration 003; endpoint/token/sesi existing tetap sama.

## Format umum

Request JSON memakai `Content-Type: application/json`. Endpoint privat memerlukan `Authorization: Bearer <token-dari-login>`. Jangan mengirim identitas pengguna aktif dari formulir: middleware mengambilnya dari sesi yang telah diverifikasi. Nasabah tidak dapat memilih ID pemilik melalui query. Akses rincian milik orang lain mengembalikan 404.

Respons normal `{ "data": ... }`; daftar berpaginasi juga mempunyai `meta`. Endpoint health mempertahankan format awal. Error konsisten:

```json
{
  "error": { "code": "VALIDASI_GAGAL", "message": "Tanggal setoran tidak boleh di masa depan." },
  "request_id": "8dc211ca-ef24-49fa-a01e-868bdcc4312b"
}
```

| HTTP | Makna |
| --- | --- |
| 200 / 201 | Berhasil / data baru dibuat |
| 400 | Input, JSON, format tanggal, atau parameter tidak valid |
| 401 / 403 | Sesi tidak valid / peran atau origin tidak diizinkan |
| 404 | Data tidak ditemukan dalam lingkup pemilik atau endpoint tidak ada |
| 409 | Duplikat, kunci berbeda isi, keputusan sudah diambil, atau konflik jadwal |
| 413 / 422 | JSON melebihi 32 KB / aturan bisnis atau referensi tidak memenuhi syarat |
| 429 | Batas percobaan login/registrasi tercapai; perhatikan `Retry-After` |
| 500 / 503 | Kesalahan internal / koneksi atau operasi database belum tersedia |

ID BIGINT, berat, jumlah uang, harga, dan agregat database dikirim sebagai **string**. ID jenis sampah INTEGER dikirim sebagai number. `meta.total`, `page`, `limit`, dan `total_pages` adalah number. Jangan mengubah ID BIGINT menjadi Number di frontend; gunakan string. Perhitungan finansial final selalu milik backend.

Tanggal: `YYYY-MM-DD`, jam WIB `HH:mm` saat input (output `HH:mm:ss`), waktu audit ISO 8601 dengan `Z`. `page` default 1, maksimal 1.000.000; `limit` default 20, maksimal 100. Urutan data stabil menggunakan tanggal lalu ID. Semua tanggal filter inklusif. Parameter body yang tidak dikenal ditolak.

## Peta endpoint dan menu frontend

`Publik` berarti tidak perlu login. `Login` berarti kedua peran; data nasabah otomatis dibatasi miliknya.

| Metode | Endpoint | Akses | Parameter utama | Menu/pemakai |
| --- | --- | --- | --- | --- |
| GET | `/health` | Publik | — | Pemeriksaan backend |
| POST | `/auth/register` | Publik | nama, email, password, nomor_whatsapp?, peran? | Registrasi |
| POST | `/auth/login` | Publik | email, password, peran? | Login dan pemilihan halaman berdasarkan peran |
| POST | `/auth/logout` | Login | Bearer | Tombol logout |
| GET | `/auth/me` | Login | Bearer | Identitas/header, pemulihan sesi |
| PATCH | `/auth/me` | Login aktif | nama?, nomor_whatsapp? | Update profil tanpa perubahan hak akses |
| GET | `/pengajuan-pengelola` | Ketua aktif | status?, page?, limit? | Daftar pendaftaran pengelola |
| GET | `/pengajuan-pengelola/:id` | Ketua aktif | id | Detail pendaftaran |
| POST | `/pengajuan-pengelola/:id/setujui` | Ketua aktif | Body kosong | Persetujuan sekali |
| POST | `/pengajuan-pengelola/:id/tolak` | Ketua aktif | alasan_penolakan | Penolakan sekali |
| GET | `/jenis-sampah` | Publik | tanggal?, search?, kategori?, jenis_sampah_id? | Info Setoran; Catatan Setoran |
| GET | `/jenis-sampah/:id/harga` | Publik | id; tanggal? | Tarif ketika tanggal/jenis penimbangan berubah |
| POST | `/harga-sampah` | Pengelola | jenis_sampah_id, berlaku_mulai, harga_per_kg | Persiapan tarif, termasuk Minyak Jelantah |
| GET | `/layanan` | Publik | — | Dua kartu pada Jadwal Layanan |
| GET | `/jadwal` | Publik | dari?, sampai?, layanan_kode?, status?, page?, limit? | Jadwal Layanan; Kelola Jadwal |
| GET | `/jadwal/:id` | Publik | ID jadwal | Detail untuk edit langsung/refresh |
| POST | `/jadwal` | Pengelola | layanan_kode, tanggal, jam_mulai, jam_selesai, tersedia?, catatan? | Kelola Jadwal: tambah |
| PATCH | `/jadwal/:id` | Pengelola | id; subset kolom jadwal | Kelola Jadwal: ubah/tutup |
| GET | `/nasabah` | Pengelola | search?, page?, limit? | Catatan Setoran: pilih nasabah aktif |
| GET | `/ringkasan` | Pengelola | — | Ringkasan |
| GET | `/saldo` | Nasabah | — | Saldo & Riwayat; angka dinamis nasabah di Beranda |
| POST | `/setoran` | Pengelola | Idempotency-Key; nasabah_id, tanggal_setoran, rincian, pengajuan_penjemputan_id? | Catatan Setoran: simpan |
| GET | `/setoran` | Login | search?, dari?, sampai?, periode?, page?, limit? | Riwayat Nasabah; Saldo & Riwayat |
| GET | `/setoran/:id` | Login | id | Rincian transaksi/pop-up |
| GET | `/setoran/export.xlsx` | Pengelola | filter sama dengan daftar | Riwayat Nasabah: ekspor semua hasil |
| POST | `/pengajuan-penjemputan` | Nasabah | alamat_penjemputan, nomor_whatsapp, tanggal_diminta, perkiraan_berat_kg, catatan_nasabah? | Jadwal Layanan: formulir pengajuan |
| GET | `/pengajuan-penjemputan` | Login | status?, page?, limit? | Kelola Jadwal: tabel pengajuan; status milik nasabah |
| GET | `/pengajuan-penjemputan/:id` | Login | id | Panel rincian pengajuan |
| POST | `/pengajuan-penjemputan/:id/setujui` | Pengelola | jadwal_layanan_id, catatan_pengelola? | Tindakan Setujui |
| POST | `/pengajuan-penjemputan/:id/tolak` | Pengelola | catatan_pengelola | Tindakan Tolak |

Beranda dan tombol navigasinya tetap konten React. Tidak perlu endpoint untuk mengarahkan Lihat Harga Sampah, Baca Panduan, Cek Jadwal Layanan, atau kartu navigasi.

## Autentikasi

`GET /health` → 200:

```json
{ "status": "ok", "message": "Backend Bank Sampah terhubung ke PostgreSQL." }
```

Health melakukan `SELECT 1`; endpoint ini memeriksa koneksi, bukan menggantikan `npm run db:migrate`.

`POST /auth/register` → 201. Nama 1–100 karakter, email valid maksimal 254, password 10–128 karakter. WhatsApp opsional berupa 8–15 digit, boleh diawali `+`. Email disimpan huruf kecil. `peran` opsional, hanya nasabah (default) atau pengelola. Nasabah active; pengelola pending. Menyertakan `is_ketua`, `status_akun`, `aktif`, atau `id` menghasilkan 400.

```json
{
  "nama": "Nasabah Contoh",
  "email": "nasabah@example.test",
  "password": "Contoh-Sandi-12345",
  "nomor_whatsapp": "081234567890"
}
```

```json
{
  "data": {
    "id": "2", "kode_akun": "NSB-00002", "nama": "Nasabah Contoh",
    "email": "nasabah@example.test", "nomor_whatsapp": "081234567890",
    "peran": "nasabah", "aktif": true, "is_ketua": false, "status_akun": "active"
  }
}
```

Registrasi tidak otomatis login. `POST /auth/login` menggunakan email dan password; `peran` bersifat opsional demi kompatibilitas dengan klien lama. Bila disertakan (`nasabah` atau `pengelola`), backend memastikan pilihan cocok dengan peran akun **setelah verifikasi kata sandi**, sehingga pilihan yang tidak cocok tidak membuat sesi dan menghasilkan 401 `LOGIN_GAGAL` generik:

```json
{ "email": "nasabah@example.test", "password": "Contoh-Sandi-12345", "peran": "nasabah" }
```

```json
{
  "data": {
    "akun": {
      "id": "2", "kode_akun": "NSB-00002", "nama": "Nasabah Contoh",
      "email": "nasabah@example.test", "nomor_whatsapp": "081234567890",
      "peran": "nasabah", "aktif": true, "is_ketua": false, "status_akun": "active"
    },
    "token": "TOKEN_CONTOH_BUKAN_TOKEN_ASLI",
    "token_type": "Bearer",
    "expires_at": "2026-11-19T02:00:00.000Z"
  }
}
```

Token sungguhan berupa 43 karakter base64url. Gunakan `data.akun.peran` untuk memilih halaman pengelola atau nasabah. `GET /auth/me` tanpa body mengembalikan object akun yang sama seperti response registrasi. Tidak ada hash atau password dalam response.

`POST /auth/logout` tanpa body dengan Bearer → 200:

```json
{ "data": { "message": "Logout berhasil." } }
```

Token tersebut langsung tidak berlaku (permintaan selanjutnya 401); logout kedua memakai token yang telah dicabut juga 401. Login lain pada akun yang sama tidak ikut dicabut. Token kedaluwarsa/nonaktif tidak bisa mengakses endpoint privat.

## Persetujuan akun pengelola

Lihat [kontrak lengkap, contoh request/response, migration dan bootstrap](PERSETUJUAN-PENGELOLA.md). Login memeriksa password dahulu: kredensial salah 401 LOGIN_GAGAL, password benar untuk pending 403 ACCOUNT_PENDING dan ditolak 403 ACCOUNT_REJECTED. Middleware membaca status/peran/is_ketua terbaru dari DB. Semua API privat mensyaratkan aktif=true dan status_akun=active. Ketua tetap peran pengelola, bukan role ketiga.

## Katalog, tarif, dan informasi layanan

`GET /jenis-sampah?search=Botol&kategori=Plastik&tanggal=2026-11-18` → 200:

```json
{
  "data": [{
    "id": 1, "nama": "Botol Plastik PET", "kategori": "Plastik",
    "panduan": "Bersih, kering, tanpa tutup.", "harga_per_kg": "4200",
    "berlaku_mulai": "2026-06-22", "satuan": "kg", "status_tarif": "tersedia"
  }],
  "meta": { "tanggal": "2026-11-18", "zona_waktu": "Asia/Jakarta" }
}
```

Tanpa tanggal memakai hari ini dan view harga terkini. Kategori: `Plastik`, `Kertas`, `Logam`, `Kaca`, `Lainnya`; `search` mencari substring nama, maksimal 100 karakter. `jenis_sampah_id` memfilter ID tertentu. Katalog tidak berpaginasi.

`GET /jenis-sampah/8/harga?tanggal=2026-11-18` → 200, contoh belum ada harga:

```json
{
  "data": {
    "id": 8, "nama": "Minyak Jelantah", "kategori": "Lainnya",
    "panduan": "Simpan dalam botol tertutup.", "harga_per_kg": null,
    "berlaku_mulai": null, "satuan": "kg", "status_tarif": "belum_ditetapkan"
  },
  "meta": { "tanggal": "2026-11-18", "zona_waktu": "Asia/Jakarta" }
}
```

Tampilkan “Tarif belum ditetapkan”, bukan Rp0. Endpoint tarif per ID memakai bentuk object yang sama untuk jenis yang sudah bertarif. Harga awal tujuh jenis sesuai database; daftar kedelapan jenis dapat dibaca langsung dari endpoint.

`POST /harga-sampah` oleh pengelola → 201. Contoh **ilustrasi**, bukan penetapan harga bisnis Minyak Jelantah:

```json
{ "jenis_sampah_id": 1, "berlaku_mulai": "2026-11-19", "harga_per_kg": 4500 }
```

```json
{ "data": { "jenis_sampah_id": 1, "berlaku_mulai": "2026-11-19", "harga_per_kg": "4500" } }
```

Harga harus integer positif maksimal 2.147.483.647. Tanggal boleh lampau/hari ini/mendatang. Pasangan jenis dan tanggal yang sudah ada ditolak 409; endpoint hanya menambahkan riwayat harga.

`GET /layanan` → 200, mengembalikan ketiga layanan. Contoh bentuk kartu:

```json
{
  "data": [
    { "kode": "penimbangan", "nama": "Penimbangan", "lokasi_atau_area": null, "hari_rutin": null, "syarat": null },
    { "kode": "penjemputan", "nama": "Penjemputan", "lokasi_atau_area": "Area A", "hari_rutin": "Jumat", "syarat": "Minimal setoran 10 kg" },
    { "kode": "setoran_umum", "nama": "Setoran umum", "lokasi_atau_area": "Jl. Melati No. 18, Mojoroto", "hari_rutin": null, "syarat": null }
  ]
}
```

Gunakan `setoran_umum` untuk kartu lokasi dan `penjemputan` untuk kartu hari/area/syarat. Tulisan syarat belum diubah menjadi aturan validasi otomatis.

## Nasabah dan jadwal

`GET /nasabah?search=NSB-00002&page=1&limit=20` → 200:

```json
{
  "data": [{ "id": "2", "kode_akun": "NSB-00002", "nama": "Nasabah Contoh", "email": "nasabah@example.test", "nomor_whatsapp": "081234567890" }],
  "meta": { "page": 1, "limit": 20, "total": 1, "total_pages": 1 }
}
```

Pencarian berdasarkan nama atau kode akun, hanya nasabah aktif. Simpan ID hasil pilihan pada form, bukan nama sebagai identitas transaksi.

`POST /jadwal` → 201:

```json
{
  "layanan_kode": "penjemputan", "tanggal": "2026-11-18",
  "jam_mulai": "08:00", "jam_selesai": "12:00", "tersedia": true,
  "catatan": "Hubungi petugas saat tiba"
}
```

```json
{
  "data": {
    "id": "1", "layanan_kode": "penjemputan", "tanggal": "2026-11-18",
    "jam_mulai": "08:00:00", "jam_selesai": "12:00:00", "tersedia": true,
    "catatan": "Hubungi petugas saat tiba", "pengelola_id": "1", "status": "tersedia"
  }
}
```

`layanan_kode`: `setoran_umum`, `penimbangan`, atau `penjemputan`. Jadwal tersedia memerlukan kedua jam dengan mulai < selesai, pada hari yang sama. `tersedia` default true. Jadwal tutup boleh memiliki kedua jam NULL atau kedua jam valid. Catatan opsional maksimal 1.000 karakter. Pengelola berasal dari sesi.

`PATCH /jadwal/1` mengirim sebagian kolom; untuk menutup:

```json
{ "tersedia": false, "catatan": "Layanan tutup" }
```

Response 200 mempunyai bentuk yang sama dengan response pembuatan, dengan `tersedia:false` dan `status:"tutup"`. Jadwal tidak dihapus. Body kosong ditolak. Jadwal terikat pengajuan dapat menghasilkan 409 sesuai aturan pada README.

`GET /jadwal?dari=2026-11-16&sampai=2026-11-22&layanan_kode=penjemputan` → 200:

```json
{
  "data": [{
    "id": "1", "layanan_kode": "penjemputan", "nama_layanan": "Penjemputan",
    "tanggal": "2026-11-18", "jam_mulai": "08:00:00", "jam_selesai": "12:00:00",
    "tersedia": false, "catatan": "Layanan tutup", "status": "tutup"
  }],
  "meta": {
    "page": 1, "limit": 20, "total": 1, "total_pages": 1,
    "dari": "2026-11-16", "sampai": "2026-11-22", "zona_waktu": "Asia/Jakarta"
  }
}
```

Tanpa `dari`/`sampai` memakai minggu berjalan Senin–Minggu. Salah satu batas boleh digunakan sendiri. Filter opsional `status=tersedia|tutup`; tanpa filter keduanya tampil. Slot yang tidak dibuat tidak menghasilkan baris jadwal.

`GET /jadwal/:id` → 200 `{ "data": { ... } }`, dengan field yang sama seperti satu baris daftar: `id`, `layanan_kode`, `nama_layanan`, `tanggal`, `jam_mulai`, `jam_selesai`, `tersedia`, `catatan`, `status`. ID jadwal berupa string BIGINT, berbeda dari kode master layanan. ID tidak valid menghasilkan 400; ID yang tidak ditemukan 404 `TIDAK_DITEMUKAN`. Endpoint baca tetap publik, termasuk jadwal tutup; tidak mengembalikan identitas internal pengelola. POST/PATCH tetap memerlukan pengelola aktif, baik ketua maupun bukan ketua.

Form pengelola mengambil dropdown dari `GET /layanan`, mengirim `layanan_kode` (bukan nama), `tanggal` sebagai DATE `YYYY-MM-DD`, serta `jam_mulai`/`jam_selesai` sebagai waktu lokal WIB `HH:mm`. Tidak ada konversi UTC. Status `tersedia`/`tutup` hanya mengikuti boolean, bukan tanggal sudah lewat. Backend tidak melarang jadwal lampau atau tumpang tindih antarlayanan; rentang jam wajib selesai setelah mulai pada hari yang sama. PATCH status hanya mengubah `tersedia` dan mempertahankan pengajuan terkait. Tidak ada endpoint hapus atau perubahan schema untuk halaman ini.

POST jadwal belum memiliki kontrak Idempotency-Key. UI mencegah submit bersamaan dan menahan retry jika hasil jaringan tidak pasti; periksa daftar sebelum membuat ulang. Proteksi ini bukan deduplikasi lintas tab/perangkat.

Pengajuan penjemputan baru hanya menyimpan `tanggal_diminta`, belum memilih ID jadwal. Ketersediaan jadwal diperiksa ketika `/pengajuan-penjemputan/:id/setujui` mengaitkan jadwal; jadwal tutup atau lampau ditolak. Halaman Kelola Jadwal mempertahankan kontrak ini dan tidak otomatis membatalkan/memindahkan pengajuan.

## Mencatat setoran dan rincian

`POST /setoran` memerlukan header `Idempotency-Key`, misalnya UUID yang dibuat `crypto.randomUUID()` di browser. Body:

```json
{
  "nasabah_id": "2",
  "tanggal_setoran": "2026-11-18",
  "pengajuan_penjemputan_id": null,
  "rincian": [
    { "jenis_sampah_id": 1, "berat_kg": "1.125" },
    { "jenis_sampah_id": 3, "berat_kg": "2.500" }
  ]
}
```

Untuk form awal satu jenis, kirim array `rincian` dengan satu elemen. Untuk penjemputan, isi `pengajuan_penjemputan_id` yang telah disetujui. Tanggal wajib dan tidak boleh mendatang; harus sama dengan jadwal jika berasal dari penjemputan. Maksimal 100 rincian, tanpa jenis berulang. Harga/subtotal/total dari browser tidak diterima. Berat string atau number positif, maksimal tiga desimal, kurang dari 1 miliar kg.

Response baru 201:

```json
{
  "data": {
    "setoran_id": "1", "kode_setoran": "TRX-181126-001",
    "tanggal_setoran": "2026-11-18", "dicatat_pada": "2026-11-18T02:00:00.000Z",
    "nasabah_id": "2", "kode_nasabah": "NSB-00002", "nama_nasabah": "Nasabah Contoh",
    "pengelola_id": "1", "nama_pengelola": "Pengelola Contoh",
    "jenis_sampah": "Botol Plastik PET, Kardus", "berat_kg": "3.625",
    "nilai_setoran_rp": "11725", "status": "Terverifikasi", "pengajuan_penjemputan_id": null,
    "rincian": [
      { "jenis_sampah_id": 1, "jenis_sampah": "Botol Plastik PET", "kategori": "Plastik", "berat_kg": "1.125", "harga_per_kg": "4200", "subtotal_rp": "4725" },
      { "jenis_sampah_id": 3, "jenis_sampah": "Kardus", "kategori": "Kertas", "berat_kg": "2.500", "harga_per_kg": "2800", "subtotal_rp": "7000" }
    ]
  },
  "meta": { "replayed": false }
}
```

Retry dengan kunci, pengelola, dan isi setara mengembalikan **200**, transaksi yang sama, `meta.replayed:true`. Urutan rincian dan penulisan berat `1` vs `1.000` tidak mengubah kesetaraan. Kunci sama dengan isi/pengelola berbeda → 409 `KUNCI_BERBEDA_ISI`. Kunci hanya diganti ketika pengguna memang membuat transaksi baru; tidak diganti akibat timeout. Kunci tidak kedaluwarsa selama transaksi tersimpan. Bila status hasil simpan belum diketahui, kirim ulang body dan kunci yang sama.

`GET /setoran/1` tanpa body → 200 dengan object `data` berbentuk rincian transaksi di atas, tanpa `meta.replayed`. Pengelola dapat membaca semua transaksi; nasabah hanya miliknya. ID milik pihak lain/tidak ada → 404. Total tersimpan tidak dihitung ulang memakai tarif terbaru. Sesudah simpan, refetch `/saldo`, `/setoran`, `/ringkasan`, serta pengajuan terkait sesuai peran.

## Saldo, riwayat, dan ekspor

`GET /saldo` oleh nasabah tanpa query/body → 200:

```json
{
  "data": {
    "nasabah_id": "2", "kode_nasabah": "NSB-00002", "nama": "Nasabah Contoh",
    "saldo_rp": "11725", "total_kg": "3.625", "kg_tahun_ini": "3.625"
  },
  "meta": { "periode_saldo": "sepanjang_waktu", "periode_total_kg": "sepanjang_waktu", "zona_waktu": "Asia/Jakarta" }
}
```

Tanpa setoran, nilai saldo/berat adalah string `"0"`. Tidak menerima `nasabah_id` atau periode pada endpoint ini.

`GET /setoran?periode=bulan_ini&page=1&limit=20` → 200:

```json
{
  "data": [{
    "setoran_id": "1", "kode_setoran": "TRX-181126-001", "tanggal_setoran": "2026-11-18",
    "dicatat_pada": "2026-11-18T02:00:00.000Z", "nasabah_id": "2", "kode_nasabah": "NSB-00002",
    "nama_nasabah": "Nasabah Contoh", "pengelola_id": "1", "nama_pengelola": "Pengelola Contoh",
    "jenis_sampah": "Botol Plastik PET, Kardus", "berat_kg": "3.625", "nilai_setoran_rp": "11725", "status": "Terverifikasi"
  }],
  "meta": { "page": 1, "limit": 20, "total": 1, "total_pages": 1, "dari": "2026-11-01", "sampai": "2026-11-18", "zona_waktu": "Asia/Jakarta" }
}
```

Contoh di atas adalah respons pengelola. Untuk nasabah, daftar dan rincian hanya mengirim kolom transaksi publik, tanpa `pengelola_id`, `nama_pengelola`, atau `pengajuan_penjemputan_id`. Rincian menambahkan `rincian[]` dengan harga saat transaksi dicatat. Halaman nasabah memakai `total_kg` sepanjang waktu dan periode awal `tiga_bulan`. Semua batas tanggal bersifat inklusif menurut Asia/Jakarta.

Pengelola melihat semua nasabah. Nasabah memakai endpoint yang sama dengan pembatasan otomatis miliknya. Pencarian `search` berdasarkan nama nasabah, kode nasabah, atau kode transaksi. `%` dan `_` dalam teks pencarian diperlakukan sebagai karakter biasa. Pagination di luar halaman terakhir mengembalikan `data:[]` dan total sebenarnya.

| Filter | Rentang pada contoh 18 November 2026 |
| --- | --- |
| `periode=tiga_bulan` | 1 September–18 November: bulan berjalan dan dua bulan kalender sebelumnya |
| `periode=bulan_ini` | 1–18 November |
| `periode=tahun_ini` | 1 Januari–18 November |
| `dari=2026-10-01&sampai=2026-10-31` | 1–31 Oktober; batas inklusif |
| Tanpa periode/batas | Sepanjang waktu |

Jangan gabungkan `periode` dengan `dari`/`sampai` (400). Filter ini hanya memengaruhi riwayat, bukan kartu saldo utama.

`GET /setoran/export.xlsx?search=NSB-00002&dari=2026-11-01&sampai=2026-11-30&page=2&limit=1` oleh pengelola → 200 berisi **biner XLSX**, bukan JSON. Semua transaksi yang cocok ikut diekspor; `page`/`limit` tidak membatasi hasil. Response header:

```text
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="riwayat-setoran-2026-11-18.xlsx"
```

Sheet **Riwayat** berisi satu baris per transaksi; **Rincian** satu baris per jenis dalam transaksi. Tanggal berupa teks WIB. Nilai numerik yang melebihi presisi 15 digit Excel tetap teks. Nama/catatan yang menyerupai formula tidak dijadikan formula. Ekspor kosong tetap berisi header.

## Ringkasan pengelola

`GET /ringkasan` tanpa query/body → 200. Contoh dengan satu transaksi:

```json
{
  "data": {
    "pengelola": { "id": "1", "nama": "Pengelola Contoh", "peran": "pengelola" },
    "metrik": {
      "hari_ini": "2026-11-18", "nilai_hari_ini_rp": "11725", "berat_hari_ini_kg": "3.625",
      "transaksi_hari_ini": "1", "nasabah_aktif": "1", "hari_tersedia_minggu_ini": "1"
    },
    "transaksi_terbaru": [{
      "setoran_id": "1", "kode_setoran": "TRX-181126-001", "tanggal_setoran": "2026-11-18",
      "dicatat_pada": "2026-11-18T02:00:00.000Z", "nasabah_id": "2", "kode_nasabah": "NSB-00002",
      "nama_nasabah": "Nasabah Contoh", "pengelola_id": "1", "nama_pengelola": "Pengelola Contoh",
      "jenis_sampah": "Botol Plastik PET, Kardus", "berat_kg": "3.625", "nilai_setoran_rp": "11725", "status": "Terverifikasi"
    }],
    "jadwal_hari_ini": [{
      "id": "1", "layanan_kode": "penjemputan", "nama_layanan": "Penjemputan", "tanggal": "2026-11-18",
      "jam_mulai": "08:00:00", "jam_selesai": "12:00:00", "tersedia": true, "catatan": null, "status": "tersedia"
    }],
    "periode": { "hari": "2026-11-18", "minggu": { "dari": "2026-11-16", "sampai": "2026-11-22" }, "zona_waktu": "Asia/Jakarta" }
  }
}
```

`nilai_hari_ini_rp`, `berat_hari_ini_kg`, dan `transaksi_hari_ini` memakai **tanggal setoran hari ini di Jakarta**, bukan waktu tombol simpan ditekan. `nasabah_aktif` menghitung akun peran nasabah dengan `aktif=true`, tanpa melihat aktivitas transaksi. `hari_tersedia_minggu_ini` menghitung **tanggal berbeda** dengan minimal satu jadwal tersedia pada Senin–Minggu berjalan; beberapa slot pada tanggal sama dihitung satu hari, termasuk hari yang sudah lewat dalam minggu tersebut. `transaksi_terbaru` maksimal lima, diurutkan tanggal setoran lalu ID menurun. `jadwal_hari_ini` memuat tersedia maupun tutup.

## Pengajuan penjemputan

`POST /pengajuan-penjemputan` oleh nasabah → 201:

```json
{
  "alamat_penjemputan": "Alamat contoh untuk penjemputan",
  "nomor_whatsapp": "081234567890", "tanggal_diminta": "2026-11-20",
  "perkiraan_berat_kg": "10.500", "catatan_nasabah": "Hubungi sebelum datang"
}
```

Alamat 5–1.000 karakter, WhatsApp 8–15 digit opsional awalan `+`, tanggal hari ini atau mendatang, perkiraan berat wajib positif maksimal tiga desimal, catatan opsional maksimal 1.000 karakter. Jangan mengirim `nasabah_id`/`status`/`pengelola_id`.

```json
{
  "data": {
    "id": "1", "nasabah_id": "2", "nama_nasabah": "Nasabah Contoh", "kode_nasabah": "NSB-00002",
    "alamat_penjemputan": "Alamat contoh untuk penjemputan", "nomor_whatsapp": "081234567890",
    "tanggal_diminta": "2026-11-20", "perkiraan_berat_kg": "10.500", "catatan_nasabah": "Hubungi sebelum datang",
    "status": "menunggu", "jadwal_layanan_id": null, "tanggal_dijadwalkan": null,
    "jam_mulai": null, "jam_selesai": null, "pengelola_id": null, "nama_pengelola": null,
    "catatan_pengelola": null, "diajukan_pada": "2026-11-18T02:00:00.000Z", "diproses_pada": null, "setoran_id": null
  }
}
```

`GET /pengajuan-penjemputan/1` → 200 dengan bentuk `data` di atas dan nilai terbaru. `GET /pengajuan-penjemputan?status=menunggu&page=1&limit=20` → 200 dengan `data` **array** object yang sama, serta `meta:{"page":1,"limit":20,"total":1,"total_pages":1}`. Status filter: `menunggu`, `disetujui`, `ditolak`, `selesai`. Tanpa filter menampilkan semua status. Urutan pengajuan terbaru lebih dahulu. Pengelola melihat semua; nasabah hanya miliknya. Tidak ada paginasi yang membocorkan total milik orang lain.

`POST /pengajuan-penjemputan/1/setujui` oleh pengelola:

```json
{ "jadwal_layanan_id": "5", "catatan_pengelola": "Dijemput pagi; mohon siapkan sampah" }
```

Response 200 mengembalikan object rincian pengajuan lengkap, dengan perubahan berikut (cuplikan `data`):

```json
{
  "id": "1", "status": "disetujui", "jadwal_layanan_id": "5",
  "tanggal_dijadwalkan": "2026-11-20", "jam_mulai": "08:00:00", "jam_selesai": "12:00:00",
  "pengelola_id": "1", "nama_pengelola": "Pengelola Contoh",
  "catatan_pengelola": "Dijemput pagi; mohon siapkan sampah", "diproses_pada": "2026-11-18T03:00:00.000Z", "setoran_id": null
}
```

Hanya jadwal layanan `penjemputan` tersedia pada hari ini atau mendatang yang diterima. Jadwal boleh berbeda dari tanggal diminta. Catatan keputusan opsional, maksimal 1.000 karakter. Saldo belum berubah.

`POST /pengajuan-penjemputan/1/tolak` oleh pengelola, untuk pengajuan lain yang masih menunggu:

```json
{ "catatan_pengelola": "Alamat berada di luar area penjemputan" }
```

Response 200 berisi rincian lengkap dengan `status:"ditolak"`, `jadwal_layanan_id:null`, ID/nama pengelola, alasan, dan `diproses_pada` terisi. Alasan wajib 1–1.000 karakter. Kedua tindakan hanya valid dari `menunggu`. Keputusan kedua, termasuk klik ulang, menghasilkan 409 `SUDAH_DIPROSES`; frontend mengambil ulang rincian.

Setelah penimbangan, pengelola mengirim `/setoran` dengan `pengajuan_penjemputan_id` yang benar. Pembuatan transaksi dan perubahan menjadi `selesai` atomik; `setoran_id` pada pengajuan kemudian berisi ID transaksi. `diproses_pada` tetap waktu keputusan, bukan waktu penyelesaian; waktu pencatatan selesai tersedia pada `dicatat_pada` transaksi.

## Contoh penggunaan React/Axios

Contoh penggalan integrasi berikut belum dipasang ke frontend template. Simpan token dalam state/context aplikasi, bukan pada kode sumber:

```js
import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:3000/api' });
const login = await api.post('/auth/login', { email, password });
const { token, akun } = login.data.data;
api.defaults.headers.common.Authorization = `Bearer ${token}`;
// arahkan frontend berdasarkan akun.peran; simpan akun.id dan akun.nama untuk header.

// Buat sekali untuk satu upaya transaksi, misalnya disimpan di useRef.
const key = crypto.randomUUID();
const body = {
  nasabah_id: selectedNasabah.id,
  tanggal_setoran: tanggal,
  rincian: [{ jenis_sampah_id: jenisId, berat_kg: berat }],
};
const hasil = await api.post('/setoran', body, { headers: { 'Idempotency-Key': key } });
// Jika timeout, ulangi body dan key yang sama. Setelah berhasil, kosongkan form dan refetch.

const ekspor = await api.get('/setoran/export.xlsx', {
  params: { search, dari, sampai }, responseType: 'blob',
});
const url = URL.createObjectURL(ekspor.data);
const link = document.createElement('a');
link.href = url;
link.download = 'riwayat-setoran.xlsx';
link.click();
URL.revokeObjectURL(url);

await api.post('/auth/logout');
delete api.defaults.headers.common.Authorization;
// Hapus token/akun dari state. Pada error 401 lakukan hal yang sama dan buka halaman login.
```

Permintaan saldo hanya untuk nasabah. Sesudah pengelola mencatat setoran, nasabah melihat saldo baru saat mengambil ulang `/saldo` dan `/setoran`; backend ini tidak menggunakan WebSocket atau push notification.
