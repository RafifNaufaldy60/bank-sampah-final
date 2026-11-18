import * as v from '../utils/validation.js';
import { ensure } from '../utils/errors.js';
import { todayJakarta } from '../utils/dates.js';
import { digest } from '../utils/security.js';

export async function transactionDetail(client, id, ownerId = null) {
  const row = (await client.query(`SELECT r.*,s.pengajuan_penjemputan_id FROM v_riwayat_setoran r
    JOIN setoran s ON s.id=r.setoran_id WHERE r.setoran_id=$1 AND ($2::bigint IS NULL OR r.nasabah_id=$2)`, [id, ownerId])).rows[0];
  ensure(row, 404, 'TIDAK_DITEMUKAN', 'Transaksi tidak ditemukan.');
  const rincian = (await client.query(`SELECT d.jenis_sampah_id,j.nama AS jenis_sampah,j.kategori,
    d.berat_kg,d.harga_per_kg::text,d.subtotal_rp FROM detail_setoran d
    JOIN jenis_sampah j ON j.id=d.jenis_sampah_id WHERE d.setoran_id=$1 ORDER BY d.jenis_sampah_id`, [id])).rows;
  return { ...row, rincian };
}

function fingerprint(value) {
  return digest(JSON.stringify({
    pengelola_id: String(value.pengelola_id), nasabah_id: String(value.nasabah_id), tanggal_setoran: value.tanggal_setoran,
    pengajuan_penjemputan_id: value.pengajuan_penjemputan_id == null ? null : String(value.pengajuan_penjemputan_id),
    rincian: value.rincian.map(item => ({ jenis_sampah_id: String(item.jenis_sampah_id), berat_kg: v.weight(item.berat_kg) }))
      .sort((a, b) => Number(a.jenis_sampah_id) - Number(b.jenis_sampah_id)),
  }));
}

export async function saveDeposit(db, body, key, actor) {
  v.fields(body, ['nasabah_id', 'tanggal_setoran', 'pengajuan_penjemputan_id', 'rincian']);
  const value = {
    pengelola_id: actor.id,
    nasabah_id: v.id(body.nasabah_id, 'nasabah_id'),
    tanggal_setoran: v.date(body.tanggal_setoran, 'tanggal_setoran'),
    pengajuan_penjemputan_id: body.pengajuan_penjemputan_id == null ? null : v.id(body.pengajuan_penjemputan_id, 'pengajuan_penjemputan_id'),
  };
  ensure(value.tanggal_setoran <= todayJakarta(), 400, 'VALIDASI_GAGAL', 'Tanggal setoran tidak boleh di masa depan.');
  ensure(Array.isArray(body.rincian) && body.rincian.length >= 1 && body.rincian.length <= 100,
    400, 'VALIDASI_GAGAL', 'rincian harus berisi 1–100 jenis sampah.');
  value.rincian = body.rincian.map(item => {
    v.fields(item, ['jenis_sampah_id', 'berat_kg']);
    return { jenis_sampah_id: v.id(item.jenis_sampah_id, 'jenis_sampah_id', 2147483647n), berat_kg: v.weight(item.berat_kg) };
  });
  ensure(new Set(value.rincian.map(item => item.jenis_sampah_id)).size === value.rincian.length,
    400, 'VALIDASI_GAGAL', 'Gabungkan berat untuk jenis sampah yang sama menjadi satu rincian.');
  const requestKey = v.uuid(key);
  const payloadHash = fingerprint(value);
  return db.transaction(async client => {
    // Retry bersamaan menunggu lock yang sama hingga COMMIT/ROLLBACK.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [requestKey]);
    const existing = (await client.query('SELECT id,payload_hash FROM setoran WHERE kunci_permintaan=$1', [requestKey])).rows[0];
    if (existing) {
      const data = await transactionDetail(client, existing.id);
      ensure((existing.payload_hash || fingerprint(data)) === payloadHash, 409, 'KUNCI_BERBEDA_ISI', 'Idempotency-Key sudah digunakan untuk permintaan berbeda.');
      return { data, replayed: true };
    }
    if (value.pengajuan_penjemputan_id) {
      const pickup = (await client.query('SELECT * FROM pengajuan_penjemputan WHERE id=$1 FOR UPDATE', [value.pengajuan_penjemputan_id])).rows[0];
      ensure(pickup && pickup.nasabah_id === value.nasabah_id, 422, 'PENGAJUAN_TIDAK_VALID', 'Pengajuan harus milik nasabah yang dipilih.');
      ensure(pickup.status === 'disetujui', 409, 'STATUS_PENGAJUAN_TIDAK_VALID', 'Setoran penjemputan memerlukan pengajuan berstatus disetujui dan belum selesai.');
      const schedule = (await client.query('SELECT * FROM jadwal_layanan WHERE id=$1 FOR SHARE', [pickup.jadwal_layanan_id])).rows[0];
      ensure(schedule && schedule.tersedia && schedule.layanan_kode === 'penjemputan' && schedule.tanggal === value.tanggal_setoran,
        422, 'JADWAL_TIDAK_VALID', 'Tanggal setoran penjemputan harus sesuai jadwal penjemputan yang disetujui dan tersedia.');
    }
    // Fungsi existing mengambil tarif historis dan menghitung subtotal NUMERIC.
    const { rows } = await client.query('SELECT catat_setoran($1::bigint,$2::bigint,$3::date,$4::uuid,$5::jsonb) AS id',
      [actor.id, value.nasabah_id, value.tanggal_setoran, requestKey, JSON.stringify(value.rincian)]);
    const id = rows[0].id;
    await client.query('UPDATE setoran SET payload_hash=$1,pengajuan_penjemputan_id=$2 WHERE id=$3', [payloadHash, value.pengajuan_penjemputan_id, id]);
    if (value.pengajuan_penjemputan_id) await client.query("UPDATE pengajuan_penjemputan SET status='selesai' WHERE id=$1", [value.pengajuan_penjemputan_id]);
    return { data: await transactionDetail(client, id), replayed: false };
  });
}
