# Postman Local Mode — collection v3 YAML

Artefak runnable berada pada direktori [Bank Sampah — Pengujian Backend Lokal](../postman/Bank%20Sampah%20—%20Pengujian%20Backend%20Lokal), dengan setiap request berupa `*.request.yaml` dan metadata folder/collection pada `.resources/definition.yaml`. Environment: [Bank-Sampah-Local.environment.yaml](../postman/Bank-Sampah-Local.environment.yaml). Ini struktur collection v3, bukan JSON yang diganti ekstensi. Tidak perlu upgrade JSON lama yang sebelumnya gagal.

Format mengikuti [schema resmi Postman](https://learning.postman.com/docs/use/use-collections/collections-schemas). [CLI resmi](https://learning.postman.com/docs/postman-cli/postman-cli-collections) menyediakan `collection lint` dan `collection run`; Newman tidak menjalankan collection v3. Artefak ini telah divalidasi dan dijalankan dengan CLI resmi 1.80.0 yang tersedia bersama Postman desktop 12.37.2.

## Database dan persiapan

**Local Mode/localhost bukan jaminan database pengujian.** Backend pada localhost dapat memakai Neon produksi melalui `.env`. Jangan menjalankan collection sebelum memastikan proses backend memakai database terpisah dengan schema proyek dan migration 001/002.

1. Arahkan `DATABASE_URL` proses backend pengujian ke database khusus uji. Jangan menimpa `.env` produksi; gunakan konfigurasi proses terpisah. Terapkan migration pada database uji tersebut.
2. Siapkan tepat dua ketua uji melalui `bootstrap:ketua`; lihat [panduan bootstrap](PERSETUJUAN-PENGELOLA.md). Gunakan identitas/password fiktif khusus tes.
3. Jalankan backend. `base_url` default `http://localhost:3000/api` adalah alamat Express, bukan PostgreSQL.
4. Buka folder lokal `backend/postman` pada Local Mode (folder workspace berisi `.postman/resources.yaml`), atau buka direktori collection v3 dengan fasilitas import/open folder versi Postman Anda. Pilih environment YAML. Jangan mengimpor file JSON lama yang tidak tersedia.
5. Isi nilai lokal berikut; jangan commit environment yang telah berisi kredensial/token.

| Variabel | Isian |
| --- | --- |
| `base_url` | Alamat backend pengujian, berakhiran `/api` |
| `test_database_confirmed` | String `true` setelah memastikan tujuan DB; default false akan melewati request dan memberi error |
| `ketua_1_email`, `ketua_2_email` | Dua email dari bootstrap uji |
| `ketua_1_password`, `ketua_2_password` | Password lokal kedua ketua |
| `pengelola_password` | Password untuk dua akun pengelola yang akan dibuat collection |
| `nasabah_password`, `nasabah_lain_password` | Password untuk nasabah A dan B |
| `berat_1_kg`, `berat_2_kg`, `berat_penjemputan_kg` | Default 2.500, 1.250, 10.000; boleh disesuaikan |

Password 10–128 karakter. Body dibentuk dengan `JSON.stringify`, sehingga karakter kutip/backslash pada password tetap valid. `pengelola_email`, ID, token, tarif, tanggal, dan UUID disimpan otomatis. Token terpisah: `token_ketua_1`, `token_ketua_2`, `token_pengelola`, `token_nasabah`, `token_nasabah_lain`.

## Urutan menjalankan 79 request

Jalankan collection satu iterasi menurut `order` atau kirim manual mengikuti urutan folder berikut. Semua 55 request fitur lama dipertahankan; 24 request tambahan memeriksa persetujuan dan logout ketua.

| Folder | Alur |
| --- | --- |
| 01 | Mulai putaran unik, health, saldo tanpa login 401 |
| 01a | Login dua ketua; daftar dua pengelola pending; login pending 403, salah sandi 401; daftar/detail; ketua 1 menyetujui akun pertama; ketua 2 tidak dapat menimpa (409), menolak akun kedua; login ditolak 403; manipulasi registrasi 400; target absen 404 dan ketua 409 |
| 02 | Daftar dua nasabah aktif; login pengelola yang sudah disetujui; login A/B; pengelola biasa dan nasabah 403 pada persetujuan; manipulasi profil 400; target nasabah 409; profil dan akses fitur pengelola |
| 03 | Katalog, dua tarif pada tanggal uji, layanan, jadwal |
| 04 | Jadwal setoran/penjemputan dan pencarian nasabah |
| 05 | Setoran multijenis, retry idempoten, saldo, kepemilikan dan rincian |
| 06 | Pengajuan penjemputan A disetujui, ditimbang, selesai; saldo berubah sekali |
| 07 | Penjemputan B ditolak, alasan terlihat hanya pemilik |
| 08 | Riwayat berpaginasi, ringkasan, ekspor XLSX dan larangan ekspor nasabah |
| 09 | Logout dan pembuktian token lama tidak berlaku |
| 10 | Logout kedua ketua |

Request 01 selalu mereset token/ID dan membuat email `example.test` unik serta `run_id`; jangan ulangi di tengah putaran. Satu putaran membuat empat akun (dua nasabah dan dua pengelola), dua jadwal, dua pengajuan penjemputan, dan dua transaksi setoran. Dua ketua dibuat sebelumnya oleh bootstrap. Data tidak dihapus oleh collection; gunakan database khusus uji. Tidak ada update harga katalog.

Assertions memeriksa HTTP, struktur JSON, status/peran/is_ketua, metadata keputusan, kode error, saldo, retry, kepemilikan, dan ekspor. Kegagalan yang diharapkan 400/401/403/404/409/422 adalah bagian tes. Hentikan urutan jika assertion gagal. Batas autentikasi tetap 30 percobaan per IP per 15 menit; bila mengulang beberapa putaran cepat, tunggu jendela limit atau restart **backend uji**.

Tes dua keputusan yang benar-benar bersamaan serta pencabutan status/izin melalui DB berada di `test:approval`; collection tidak menyediakan endpoint administratif untuk mengubah status atau izin sesuka hati.

## Validasi dan eksekusi resmi

Dari `backend` pada terminal yang memiliki CLI Postman resmi:

```powershell
postman collection lint 'postman/Bank Sampah — Pengujian Backend Lokal'
postman collection run 'postman/Bank Sampah — Pengujian Backend Lokal' -e 'postman/Bank-Sampah-Local.environment.yaml' --no-report-events --bail
```

Perintah `run` di atas memakai nilai lokal environment yang Anda isi dan backend uji yang sudah berjalan. `--no-report-events` menonaktifkan pengiriman event hasil ke Postman. Jangan memasukkan password lewat argumen command line.

Runner otomatis yang lebih praktis membuat schema sementara, dua ketua, server HTTP sementara, environment sementara dengan password acak, menjalankan CLI, lalu membersihkan schema/environment:

```powershell
# TEST_DATABASE_URL wajib terisi dengan koneksi database terpisah.
# POSTMAN_CLI_PATH menunjuk executable CLI resmi atau postman.bundled.js, bukan GUI Postman.exe.
npm run test:postman:integration
```

Untuk CLI yang dibundel desktop, isi `POSTMAN_CLI_PATH` dengan lokasi `postman.bundled.js` dan `POSTMAN_CLI_BUNDLED_ROOT` dengan direktorinya. Lokasi mengikuti versi instalasi Postman. CLI dalam terminal aplikasi juga dapat dipakai untuk lint/run langsung. Tes lokal `npm run test:postman` hanya parse YAML, mencocokkan route/variabel, dan mengompilasi script; ini tidak menggantikan `collection lint` atau eksekusi HTTP resmi.

Hasil terukur 21 November 2026: lint **79 request, 0 error, 0 warning**; run terhadap PostgreSQL lokal terpisah **79 request dan 239 assertion lulus**. Impor visual pada UI Local Mode belum diuji; validasi schema dan eksekusi CLI v3 telah diuji. Tidak ada collection yang dijalankan pada Neon produksi.
