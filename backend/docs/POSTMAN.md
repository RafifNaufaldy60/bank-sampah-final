# Pengujian backend melalui Postman

Collection ini mengikuti implementasi aktual di `src/routes/api.js`, controllers, middleware autentikasi/kepemilikan, service setoran, validasi, dan [kontrak API](API.md). Terdapat **55 request berurutan dalam 9 folder**.

File yang diimpor:

- [Bank-Sampah.postman_collection.json](../postman/Bank-Sampah.postman_collection.json) — collection format v2.1.
- [Bank-Sampah-Local.postman_environment.json](../postman/Bank-Sampah-Local.postman_environment.json) — environment dengan placeholder rahasia.

## 1. Tentukan database tujuan

`base_url` berisi **`http://localhost:3000/api`**, sesuai `PORT` backend yang diperiksa. Ini alamat server Express, **bukan alamat database**.

Request tersebut masuk ke database yang dipakai proses backend melalui `DATABASE_URL`, biasanya dari `backend/.env`. Konfigurasi proyek menggunakan PostgreSQL Neon. Nama environment “Local” tidak membuat database lokal atau database uji otomatis. Variabel lingkungan pada terminal juga dapat menentukan `DATABASE_URL`; pastikan terminal server memakai koneksi yang dimaksud.

Untuk pengujian terisolasi, gunakan branch/database Neon khusus uji yang telah memiliki skema Bank Sampah dan data referensi jenis sampah/layanan/harga. Branch hasil salinan setup proyek dapat digunakan. Arahkan `DATABASE_URL` backend ke koneksi uji, lalu restart server. `npm run db:migrate` hanya menjalankan migrasi tambahan; perintah tersebut tidak membuat delapan tabel awal pada database kosong.

**Request penyimpanan benar-benar menambah data ke database tujuan.** Satu putaran lengkap menambahkan:

| Data | Jumlah/perubahan |
| --- | --- |
| Akun nasabah uji | 2 akun baru, A dan B |
| Jadwal | 2 jadwal baru; setoran umum kemudian ditutup, penjemputan tetap tersedia |
| Pengajuan | 2 pengajuan baru; A selesai, B ditolak |
| Setoran | 2 transaksi milik A; langsung dan hasil penjemputan |
| Rincian setoran | 3 baris: dua jenis pada setoran langsung, satu jenis hasil penjemputan |
| Sesi | Login tiga akun; masing-masing dicabut pada tahap logout |

Collection tidak mengubah harga katalog dan tidak menghapus data setelah pengujian. Akun diberi nama `POSTMAN UJI A/B <run_id>`, email `uji-postman-a/b-<run_id>@example.test`, serta catatan jadwal/pengajuan dengan penanda `POSTMAN UJI`. Transaksi dikenali lewat nasabah tersebut, `transaksi_id`, `kode_transaksi`, dan `transaksi_penjemputan_id`; API tidak menyediakan kolom catatan transaksi. Domain `example.test` hanya identitas fiktif; tidak ada pengiriman email.

## 2. Jalankan backend dan siapkan pengelola uji

Dari root repository, buka terminal:

```powershell
cd backend
npm ci
npm run db:migrate
npm run create:pengelola
```

Pada prompt CLI, isi:

| Isian | Nilai |
| --- | --- |
| Nama | `POSTMAN UJI PENGELOLA` |
| Email | `uji-postman-pengelola@example.test` |
| WhatsApp | Boleh kosong |
| Kata sandi | Tentukan sendiri, 10–128 karakter; pengetikan disembunyikan |

Jika akun uji pengelola sudah ada, gunakan email/password akun itu dan lewati pembuatan ulang. CLI menolak email duplikat; tidak mengubah akun nasabah menjadi pengelola. Registrasi HTTP selalu menghasilkan nasabah, sehingga pengelola tidak dibuat melalui request registrasi collection.

Kemudian:

```powershell
npm run dev
```

Biarkan terminal server berjalan. Jika mengubah `PORT`, sesuaikan `base_url` di Postman, tetap diakhiri `/api` dan tanpa slash tambahan.

## 3. Impor collection dan isi nilai lokal

1. Buka Postman desktop agar request dapat mengakses `localhost`.
2. Pilih **Import**, lalu pilih kedua file JSON dari `backend/postman`.
3. Pilih environment **Bank-Sampah-Local** sebagai environment aktif.
4. Isi variabel berikut pada nilai **lokal** environment. Pada versi Postman yang menyediakan kolom *Current Value*, gunakan kolom itu; pada antarmuka baru gunakan *Value* lokal, tanpa membagikan nilainya.

| Variabel | Yang diisi |
| --- | --- |
| `base_url` | `http://localhost:3000/api` atau port server Anda |
| `pengelola_email` | Email pengelola uji dari CLI |
| `pengelola_password` | Password pengelola tersebut |
| `nasabah_password` | Password baru untuk nasabah A, 10–128 karakter |
| `nasabah_lain_password` | Password baru untuk nasabah B, 10–128 karakter |

Ketiga password di file repository hanya placeholder. Jangan memasukkan password ke file JSON yang akan di-commit. Variabel password dan token diberi tipe `secret`; penandaan ini tidak menggantikan kebutuhan memeriksa file sebelum membagikan/mengekspor ulang. File ekspor yang telah berisi nilai lokal jangan ditimpa ke template repository. Informasi nilai lokal environment dijelaskan dalam [dokumentasi Postman](https://learning.postman.com/docs/use/send-requests/variables/environment-variables/).

Biarkan token dan ID kosong/placeholder. Skrip akan mengisinya. Tidak perlu mengisi email/nama nasabah secara manual: request 01 membuat nama/email unik setiap putaran untuk menghindari registrasi duplikat.

## 4. Variabel otomatis dan autentikasi

Backend memakai **Bearer Token**, tanpa cookie. Setiap request sudah memiliki pengaturan Authorization sendiri:

| Variabel | Penggunaan |
| --- | --- |
| `token_pengelola` | Mencatat setoran, mengelola jadwal/pengajuan, ringkasan, ekspor |
| `token_nasabah` | Saldo/riwayat/pengajuan nasabah A |
| `token_nasabah_lain` | Nasabah B untuk pemeriksaan kepemilikan dan penolakan |
| `token_*_dicabut` | Salinan sementara sesudah logout untuk membuktikan server menolak token; dikosongkan setelah tes 401 |
| `pengelola_id`, `nasabah_id`, `nasabah_lain_id` | ID dari hasil registrasi/login, tetap string |
| `jenis_sampah_id`, `jenis_sampah_kedua_id` | Dua jenis berbeda yang bertarif pada tanggal uji |
| `harga_per_kg`, `harga_kedua_per_kg` | Harga sesuai tanggal, diambil dari backend |
| `jadwal_setoran_id`, `jadwal_id` | Jadwal setoran umum dan jadwal penjemputan |
| `transaksi_id`, `transaksi_penjemputan_id` | Setoran langsung dan hasil penjemputan |
| `pengajuan_id`, `pengajuan_tolak_id` | Pengajuan A yang disetujui dan pengajuan B yang ditolak; harus berbeda |
| `saldo_awal`, `berat_awal` | Snapshot sebelum penyimpanan transaksi |
| `nilai_setoran`, `nilai_setoran_penjemputan` | Nilai dua transaksi unik yang berhasil |
| `kunci_permintaan`, `kunci_permintaan_penjemputan` | UUID berbeda untuk dua transaksi; tidak berubah pada retry |
| `body_setoran`, `body_setoran_penjemputan` | Salinan body setoran agar request ulang konsisten |
| `run_id`, `tanggal_uji` | Penanda putaran dan tanggal operasional Jakarta |
| `jumlah_ekspor_diharapkan` | Total transaksi sesuai filter, sebelum pagination |

Variabel `berat_1_kg=2.500`, `berat_2_kg=1.250`, dan `berat_penjemputan_kg=10.000` merupakan input uji yang dapat diubah **sebelum** menjalankan tahap setoran. Semua satuan kilogram. Jangan mengubah ID, tanggal, atau nilai hasil otomatis di tengah putaran.

Body request JSON menggunakan `{{request_body}}`. Pre-request Script membentuk variabel lokal ini dari template JSON yang dapat dilihat di deskripsi request dan di tab Scripts. Cara ini menjaga password yang mengandung tanda kutip/backslash tetap menjadi JSON valid, dan memastikan request retry benar-benar sama. Tidak perlu membuat `request_body` di environment. Skrip tidak memodifikasi `pm.request.body`, karena objek tersebut immutable menurut [dokumentasi request Postman](https://learning.postman.com/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-request/).

## 5. Jalankan request satu per satu

Buka folder pertama dan request **01 — MULAI PUTARAN BARU dan health**, lalu tekan **Send**. Periksa status HTTP dan hasil tests. Setelah sesuai, lanjut ke nomor berikutnya sampai 55. Tes dapat dibaca pada **Scripts → Post-response** (atau tab Tests pada versi lama).

Request bertanda **NEGATIF** sengaja mengharapkan 400, 401, 403, 404, 409, atau 422. Status tersebut benar apabila test berwarna hijau. Jika sebuah test gagal, hentikan urutan dan periksa respons/pesan variabel yang kurang sebelum melanjutkan.

Request **01 selalu mereset hasil uji dan menghasilkan pasangan nasabah baru**. Jangan menekannya di tengah putaran untuk sekadar mengecek koneksi. Untuk putaran baru, jalankan lagi dari 01; data putaran sebelumnya tetap berada di database. Jika memakai Collection Runner, pilih seluruh collection, environment yang benar, dan **satu iterasi**, dengan urutan bawaan. Tidak menggunakan runner paralel untuk urutan yang saling bergantung ini.

### Hasil yang diharapkan setiap request

| No. | Request | Peran | HTTP | Hasil penting |
| --- | --- | --- | --- | --- |
| 01 | MULAI PUTARAN BARU dan health | Publik | 200 | status=ok. Membuat run_id, tanggal Jakarta, email/nama nasabah, dan UUID permintaan. Jangan ulangi request ini di tengah putaran. |
| 02 | NEGATIF saldo tanpa login | Publik | 401 | Ditolak tanpa Authorization; tidak bergantung token yang tersimpan. |
| 03 | Registrasi nasabah uji A | Publik | 201 | Akun aktif berperan nasabah; simpan nasabah_id dan kode_nasabah. |
| 04 | Registrasi nasabah uji B | Publik | 201 | Akun aktif berperan nasabah; simpan nasabah_lain_id. |
| 05 | Login pengelola | Publik | 200 | data.akun.peran=pengelola; token disimpan hanya pada token_pengelola. |
| 06 | Login nasabah | Publik | 200 | data.akun.peran=nasabah; token disimpan hanya pada token_nasabah. |
| 07 | Login nasabah lain | Publik | 200 | data.akun.peran=nasabah; token disimpan hanya pada token_nasabah_lain. |
| 08 | Informasi akun pengelola | pengelola | 200 | ID, nama, peran sesuai akun pemilik token; tidak mengandung hash password. |
| 09 | Informasi akun nasabah | nasabah | 200 | ID, nama, peran sesuai akun pemilik token; tidak mengandung hash password. |
| 10 | NEGATIF nasabah membuka fitur pengelola | nasabah | 403 | Nasabah tidak dapat membaca ringkasan pengelola. |
| 11 | Katalog dan pilih dua jenis bertarif | Publik | 200 | Daftar jenis/panduan/satuan kg. Pilih dua jenis berbeda yang memiliki tarif; jenis tanpa tarif tetap boleh tampil. |
| 12 | Tarif jenis pertama pada tanggal setoran | Publik | 200 | Tarif positif dalam Rp/kg; simpan harga_per_kg untuk memeriksa subtotal. |
| 13 | Tarif jenis kedua pada tanggal setoran | Publik | 200 | Tarif positif dalam Rp/kg; simpan harga_kedua_per_kg untuk memeriksa subtotal. |
| 14 | Informasi kartu layanan | Publik | 200 | Memuat setoran_umum, penimbangan, penjemputan, beserta lokasi/area/hari/syarat. |
| 15 | Jadwal layanan pada tanggal uji | Publik | 200 | Daftar boleh kosong. Baris tersedia/tutup menggunakan tanggal WIB yang diminta. |
| 16 | Tambah jadwal setoran umum uji | pengelola | 201 | Jadwal setoran_umum tersedia; ID disimpan di jadwal_setoran_id. |
| 17 | Ubah jadwal setoran menjadi tutup | pengelola | 200 | tersedia=false, status=tutup; jadwal tetap tersimpan. |
| 18 | Nasabah dapat melihat jadwal tutup | Publik | 200 | Semua baris hasil filter berstatus tutup; baris uji tampil jika berada pada halaman ini. Total dapat memuat jadwal lain. |
| 19 | Tambah jadwal penjemputan tersedia | pengelola | 201 | Jadwal penjemputan tersedia; ID disimpan di jadwal_id. |
| 20 | Cari nasabah A berdasarkan kode | pengelola | 200 | Nasabah A yang baru dibuat dapat dipilih pada formulir setoran. |
| 21 | Simpan saldo dan berat awal nasabah A | nasabah | 200 | Saldo awal disimpan tanpa asumsi harus nol. Snapshot tidak ditimpa jika request diklik ulang setelah transaksi. |
| 22 | NEGATIF berat nol ditolak | pengelola | 400 | Input berat 0 ditolak sebelum transaksi tercatat. |
| 23 | Simpan setoran langsung multijenis | pengelola | 201 | Transaksi baru; meta.replayed=false. Simpan ID/kode/nilai/berat. Subtotal dihitung menggunakan tarif database dan pembulatan Rupiah per rincian. |
| 24 | Kirim ulang setoran dengan UUID dan body yang sama | pengelola | 200 | meta.replayed=true, ID dan nilai sama; tidak membuat setoran kedua. |
| 25 | NEGATIF UUID sama tetapi isi berubah | pengelola | 409 | Backend menolak kunci yang telah dipakai untuk isi berbeda; body_setoran asli tidak diubah. |
| 26 | Saldo setelah setoran dan retry | nasabah | 200 | Kenaikan tepat satu kali nilai transaksi langsung; retry dan input salah tidak menambah saldo. |
| 27 | Riwayat nasabah A bulan ini | nasabah | 200 | Hanya transaksi milik A; setoran langsung muncul tepat satu kali pada hasil uji. |
| 28 | Rincian transaksi oleh pemilik A | nasabah | 200 | Seluruh jenis, berat, tarif tersimpan, subtotal, total, status dan pengelola tersedia. |
| 29 | NEGATIF B mengakses transaksi milik A | nasabah lain | 404 | Tidak membocorkan rincian transaksi milik nasabah lain. |
| 30 | Riwayat nasabah B tetap terpisah | nasabah lain | 200 | Akun B yang baru diregistrasikan belum memiliki transaksi; total=0. |
| 31 | Buat pengajuan A untuk disetujui | nasabah | 201 | status=menunggu, pemilik berasal dari sesi; simpan pengajuan_id. |
| 32 | Daftar pengajuan menunggu untuk pengelola | pengelola | 200 | Pengajuan uji terlihat dalam daftar terbaru; semua baris berstatus menunggu. |
| 33 | Panel rincian pengajuan oleh pengelola | pengelola | 200 | Alamat, WhatsApp, perkiraan berat, catatan dan identitas A tersedia. |
| 34 | NEGATIF persetujuan dengan jadwal yang salah | pengelola | 422 | Jadwal setoran umum yang tutup ditolak; pengajuan tetap menunggu. |
| 35 | Setujui pengajuan A dengan jadwal penjemputan | pengelola | 200 | status=disetujui; jadwal, pengelola, catatan dan waktu keputusan disimpan. |
| 36 | A melihat persetujuan terbaru | nasabah | 200 | A melihat status disetujui, jadwal, serta catatan pengelola. |
| 37 | Saldo tidak bertambah saat baru disetujui | nasabah | 200 | Tetap saldo_awal + nilai_setoran langsung; belum ada nilai penjemputan. |
| 38 | Catat hasil timbang penjemputan A | pengelola | 201 | Transaksi kedua dibuat, terhubung dengan pengajuan A; simpan ID/nilai/berat hasil penjemputan. |
| 39 | Pengajuan A selesai dan memiliki transaksi | nasabah | 200 | status=selesai, setoran_id sama dengan transaksi hasil timbang. |
| 40 | Saldo akhir A mencakup dua transaksi unik | nasabah | 200 | Saldo awal + nilai setoran langsung + nilai hasil penjemputan; total berat bertambah sesuai dua transaksi. |
| 41 | Buat pengajuan B khusus penolakan | nasabah lain | 201 | status=menunggu, pemilik berasal dari sesi; simpan pengajuan_tolak_id yang harus berbeda dari pengajuan_id. |
| 42 | Tolak pengajuan B dengan alasan | pengelola | 200 | status=ditolak; alasan, ID pengelola, dan diproses_pada terisi; tidak menghasilkan transaksi. |
| 43 | B melihat alasan penolakan miliknya | nasabah lain | 200 | B dapat membaca status dan keterangan keputusan miliknya. |
| 44 | NEGATIF A membaca pengajuan milik B | nasabah | 404 | Pemeriksaan kepemilikan juga berlaku untuk pengajuan. |
| 45 | Riwayat pengelola halaman 1 | pengelola | 200 | Satu baris pada halaman 1; total hasil filter=2, total_pages=2. Simpan jumlah ekspor yang diharapkan. |
| 46 | Riwayat pengelola halaman 2 | pengelola | 200 | Satu baris pada halaman 2; total hasil filter=2, total_pages=2. Simpan jumlah ekspor yang diharapkan. |
| 47 | Ringkasan pengelola setelah transaksi | pengelola | 200 | Identitas pengelola sesuai sesi; metrik hari ini mencakup dua transaksi, tetapi boleh juga memuat data pengguna lain. |
| 48 | Ekspor XLSX seluruh hasil filter | pengelola | 200 | Biner XLSX, bukan JSON. Header unduhan dan signature ZIP valid. Simpan file lalu buka: sheet Riwayat harus memuat 2 transaksi walaupun limit=1; sheet Rincian memuat 3 baris detail. |
| 49 | NEGATIF ekspor oleh nasabah | nasabah | 403 | Ekspor seluruh riwayat hanya untuk pengelola. |
| 50 | Logout nasabah lain | nasabah lain | 200 | Logout berhasil; token aktif dikosongkan setelah disalin sementara untuk uji pencabutan. |
| 51 | NEGATIF token nasabah lain setelah logout | nasabah lain dicabut | 401 | Token lama benar-benar ditolak server. Salinan token dicabut kemudian dikosongkan. |
| 52 | Logout nasabah | nasabah | 200 | Logout berhasil; token aktif dikosongkan setelah disalin sementara untuk uji pencabutan. |
| 53 | NEGATIF token nasabah setelah logout | nasabah dicabut | 401 | Token lama benar-benar ditolak server. Salinan token dicabut kemudian dikosongkan. |
| 54 | Logout pengelola | pengelola | 200 | Logout berhasil; token aktif dikosongkan setelah disalin sementara untuk uji pencabutan. |
| 55 | NEGATIF token pengelola setelah logout | pengelola dicabut | 401 | Token lama benar-benar ditolak server. Salinan token dicabut kemudian dikosongkan. |

## 6. Cara membaca pengujian saldo dan retry

Request 21 menyimpan saldo awal A. Snapshot tidak ditimpa jika request itu diklik ulang setelah transaksi. Pengujian berikut tidak berasumsi saldo awal harus nol:

```text
Sesudah setoran langsung dan retry:
saldo = saldo_awal + nilai_setoran

Sesudah pengajuan disetujui, sebelum ditimbang:
saldo tetap = saldo_awal + nilai_setoran

Sesudah setoran hasil penjemputan:
saldo = saldo_awal + nilai_setoran + nilai_setoran_penjemputan
```

Total berat juga diperiksa dengan pola yang sama. Skrip memakai `BigInt` dan konversi kilogram ke gram integer untuk menghindari hilangnya presisi ID/uang dan kesalahan pecahan JavaScript.

Apabila dua tarif pertama masih PET Rp4.200/kg dan Gelas Plastik Rp3.200/kg, contoh default menghasilkan:

| Transaksi | Perhitungan | Nilai |
| --- | --- | --- |
| Langsung | 2,5 × 4.200 + 1,25 × 3.200 | Rp14.500, berat 3,75 kg |
| Hasil penjemputan | 10 × 4.200 | Rp42.000, berat 10 kg |
| Kenaikan akhir | Nilai kedua transaksi unik | Rp56.500, berat 13,75 kg |

Angka tersebut contoh; skrip memakai harga respons aktual. Subtotal dibulatkan per rincian mengikuti database, baru dijumlahkan. Jangan mengubah harga atau memasukkan transaksi tambahan untuk akun uji selama putaran sedang berjalan.

Request 23 membuat transaksi dengan `kunci_permintaan` dari request 01. Request 24 mengirim body yang telah disalin serta kunci yang sama; seharusnya 200, `meta.replayed=true`, dan ID/nilai sama. Request 25 memakai kunci yang sama tetapi berat berbeda; seharusnya 409. Nilai transaksi tidak dijumlahkan lagi oleh skrip retry. Jika request pertama timeout, jangan mengganti UUID; kirim ulang request penyimpanan dengan body/kunci yang sama untuk memperoleh hasilnya. Respons 200 saat pengulangan request 23 berarti transaksi sudah tersimpan (test 201 pada request pertama akan merah); lanjutkan request 24 setelah variabel transaksi berhasil dipulihkan dari respons dengan mengikuti penjelasan pemulihan di bawah.

Untuk putaran manual normal, gunakan urutan ketika request 23 berhasil 201. Jika terjadi timeout dan token/ID hasil belum tersimpan, jangan memalsukan nilai saldo/ID untuk membuat tests hijau. Salin ID, kode, nilai dan berat dari respons transaksi yang ditemukan saat retry ke variabel terkait, atau mulai putaran uji baru melalui request 01. Putaran baru memakai akun baru; transaksi sebelumnya tetap tersimpan pada akun lama.

## 7. Persetujuan, penolakan, dan ekspor

Pengajuan A pada request 31 disetujui menggunakan jadwal penjemputan tersedia. Jadwal memiliki tanggal hari ini, sehingga setoran hasil penjemputan dapat diuji pada putaran yang sama. Pengajuan selesai hanya setelah request 38 berhasil mencatat berat aktual.

Pengajuan B dibuat **terpisah** pada request 41 dan ditolak pada 42. Alasannya kemudian dibaca memakai token B. Token A digunakan pada request 44 untuk memastikan pengajuan B tidak dapat diakses.

Request 45–46 memakai `limit=1`, sehingga dua transaksi A berada di halaman berbeda. Request 48 mengekspor dengan filter yang sama, `page=2&limit=1`, tetapi hasil XLSX seharusnya tetap memuat seluruh transaksi. Test otomatis memeriksa status, Content-Type, Content-Disposition, dan signature ZIP `PK`; skrip tidak mem-parsing JSON dari respons biner. Simpan respons sebagai berkas `.xlsx` melalui menu unduh/simpan respons Postman, lalu buka berkasnya:

- Sheet **Riwayat**: `jumlah_ekspor_diharapkan` baris transaksi, yaitu 2 pada putaran normal, ditambah satu header.
- Sheet **Rincian**: 3 baris rincian, ditambah satu header.
- Nilai setoran, kode nasabah, dan tanggal cocok dengan respons JSON sebelumnya.

Pemeriksaan jumlah baris isi workbook ini dilakukan manual; test Postman hanya memeriksa format unduhannya. Sesudah logout, untuk mengunduh ulang, login pengelola lagi melalui request 05, jalankan 48, lalu logout 54–55 tanpa mengulang request 01.

## 8. Jika ada masalah

| Gejala | Pemeriksaan |
| --- | --- |
| Tidak tersambung/connection refused | Pastikan `npm run dev` berjalan dan `base_url` memakai port yang sama. |
| 503 pada health | Periksa koneksi Neon dan `DATABASE_URL` proses backend, tanpa mencetaknya. |
| Request dilewati dengan pesan variabel kurang | Pilih environment aktif, isi password lokal, dan jalankan langkah sebelumnya. Skrip memakai `pm.execution.skipRequest()` untuk tidak mengirim input placeholder. |
| Login pengelola 401 | Pastikan akun dibuat melalui CLI pada **database yang sama** dengan server dan password lokal benar. |
| Registrasi 409 | Request registrasi yang sama sudah berhasil. Untuk putaran baru jalankan 01; untuk melanjutkan akun yang sudah dibuat, pertahankan email/password/ID yang sesuai. |
| Tarif tidak tersedia | Katalog harus memiliki minimal dua jenis bertarif pada tanggal uji; collection tidak mengarang harga Minyak Jelantah. |
| Jadwal penjemputan 422 | Pastikan jadwal bertipe penjemputan, tersedia, dan tanggalnya hari ini. Jika sudah lewat tengah malam Jakarta, mulai putaran baru. |
| Keputusan pengajuan 409 saat diklik ulang | Keputusan hanya boleh sekali dari status menunggu. Baca ulang rincian; jangan memakai pengajuan yang sudah selesai untuk penolakan. |
| Login/registrasi 429 | Backend membatasi 30 percobaan per IP per 15 menit. Tunggu intervalnya sebelum mengulang banyak putaran. |
| Test saldo berbeda | Periksa saldo awal, nilai dua transaksi unik, tanggal, dan apakah ada transaksi lain pada akun uji. Jangan mengganti UUID untuk retry. |
| Respons ekspor tampak tidak terbaca | Itu biner XLSX; simpan sebagai file, bukan membaca sebagai JSON. |

## 9. Verifikasi yang dilakukan pada artefak

Jalankan pemeriksaan lokal tanpa database:

```powershell
cd backend
node --test test/postman.test.js
```

Hasil: **5 pemeriksaan lokal lulus**. Pemeriksaan mencakup kecocokan 55 metode/path dengan routes aktual, struktur collection/variabel, sintaks 111 skrip, placeholder rahasia, substitusi password dengan karakter khusus, dan eksekusi skrip 55 tahap memakai fixture respons lokal. Kasus saldo berukuran lebih besar dari presisi Number juga diperiksa, termasuk deteksi kredit ganda dan respons pemilik yang salah.

Pemeriksaan ini **bukan** eksekusi HTTP melalui Postman/Newman dan bukan uji database. Pada pekerjaan pembuatan collection ini tidak ada akun/transaksi/jadwal baru yang ditulis ke Neon. Eksekusi manual di Postman tetap perlu dilakukan dengan kredensial lokal Anda.

Verifikasi Newman belum dijalankan karena tinjauan persetujuan otomatis untuk perintah pemeriksaan runner gagal akibat batas penggunaan layanan. Perintah tidak dieksekusi; pembatasan tersebut tidak dilewati.

Referensi resmi Postman yang digunakan: [Sandbox dan assertions](https://learning.postman.com/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/overview/), [variabel environment lokal](https://learning.postman.com/docs/use/send-requests/variables/environment-variables/), [request body](https://learning.postman.com/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-request/), [response biner dan header](https://learning.postman.com/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-response/), [skipRequest](https://learning.postman.com/docs/tests-and-scripts/write-scripts/postman-sandbox-reference/pm-execution/), dan [Newman untuk collection v2.1](https://learning.postman.com/docs/reference/newman-cli/command-line-integration-with-newman/).
