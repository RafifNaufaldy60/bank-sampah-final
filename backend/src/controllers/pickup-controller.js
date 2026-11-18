import * as v from '../utils/validation.js';
import { todayJakarta } from '../utils/dates.js';
import { ensure } from '../utils/errors.js';

const pickupSelect = `SELECT p.id,p.nasabah_id,n.nama AS nama_nasabah,n.kode_akun AS kode_nasabah,
  p.alamat_penjemputan,p.nomor_whatsapp,p.tanggal_diminta,p.perkiraan_berat_kg,p.catatan_nasabah,p.status,
  p.jadwal_layanan_id,j.tanggal AS tanggal_dijadwalkan,j.jam_mulai,j.jam_selesai,
  p.pengelola_id,a.nama AS nama_pengelola,p.catatan_pengelola,p.diajukan_pada,p.diproses_pada,s.id AS setoran_id
  FROM pengajuan_penjemputan p JOIN akun n ON n.id=p.nasabah_id
  LEFT JOIN akun a ON a.id=p.pengelola_id LEFT JOIN jadwal_layanan j ON j.id=p.jadwal_layanan_id
  LEFT JOIN setoran s ON s.pengajuan_penjemputan_id=p.id`;

async function detail(client, id, scope) {
  const result = (await client.query(`${pickupSelect} WHERE p.id=$1 AND ($2::bigint IS NULL OR p.nasabah_id=$2)`, [id, scope])).rows[0];
  ensure(result, 404, 'TIDAK_DITEMUKAN', 'Pengajuan tidak ditemukan.');
  return result;
}

export function pickupController(db) {
  const decide = approve => async (req, res) => {
    const id = v.id(req.params.id);
    const body = v.fields(req.body, approve ? ['jadwal_layanan_id', 'catatan_pengelola'] : ['catatan_pengelola']);
    const scheduleId = approve ? v.id(body.jadwal_layanan_id, 'jadwal_layanan_id') : null;
    const note = v.text(body.catatan_pengelola, 'catatan_pengelola', { optional: approve, max: 1000 });
    const data = await db.transaction(async client => {
      const current = (await client.query('SELECT id,status FROM pengajuan_penjemputan WHERE id=$1 FOR UPDATE', [id])).rows[0];
      ensure(current, 404, 'TIDAK_DITEMUKAN', 'Pengajuan tidak ditemukan.');
      ensure(current.status === 'menunggu', 409, 'SUDAH_DIPROSES', 'Pengajuan telah diproses oleh pengelola.');
      if (approve) {
        const schedule = (await client.query('SELECT * FROM jadwal_layanan WHERE id=$1 FOR SHARE', [scheduleId])).rows[0];
        ensure(schedule && schedule.layanan_kode === 'penjemputan' && schedule.tersedia && schedule.tanggal >= todayJakarta(),
          422, 'JADWAL_TIDAK_VALID', 'Pilih jadwal penjemputan tersedia pada hari ini atau setelahnya.');
      }
      await client.query(`UPDATE pengajuan_penjemputan SET status=$1,jadwal_layanan_id=$2,pengelola_id=$3,
        catatan_pengelola=$4,diproses_pada=now() WHERE id=$5`, [approve ? 'disetujui' : 'ditolak', scheduleId, req.user.id, note, id]);
      return detail(client, id, null);
    });
    res.json({ data });
  };
  return {
    create: async (req, res) => {
      const body = v.fields(req.body, ['alamat_penjemputan', 'nomor_whatsapp', 'tanggal_diminta', 'perkiraan_berat_kg', 'catatan_nasabah']);
      const address = v.text(body.alamat_penjemputan, 'alamat_penjemputan', { min: 5, max: 1000 });
      const phone = v.whatsapp(body.nomor_whatsapp);
      const date = v.date(body.tanggal_diminta, 'tanggal_diminta');
      ensure(date >= todayJakarta(), 400, 'VALIDASI_GAGAL', 'Tanggal pengajuan tidak boleh sebelum hari ini.');
      const weight = v.weight(body.perkiraan_berat_kg, 'perkiraan_berat_kg');
      const note = v.text(body.catatan_nasabah, 'catatan_nasabah', { optional: true, max: 1000 });
      const data = await db.transaction(async client => {
        const result = await client.query(`INSERT INTO pengajuan_penjemputan(nasabah_id,alamat_penjemputan,nomor_whatsapp,tanggal_diminta,perkiraan_berat_kg,catatan_nasabah)
          VALUES($1,$2,$3,$4,$5,$6) RETURNING id`, [req.user.id, address, phone, date, weight, note]);
        return detail(client, result.rows[0].id, req.user.id);
      });
      res.status(201).json({ data });
    },
    list: async (req, res) => {
      v.fields(req.query, ['status', 'page', 'limit']);
      const { page, limit, offset } = v.pagination(req.query);
      const status = req.query.status === undefined ? null : v.choice(req.query.status, ['menunggu', 'disetujui', 'ditolak', 'selesai'], 'status');
      const params = [req.nasabahScope, status];
      const where = '($1::bigint IS NULL OR p.nasabah_id=$1) AND ($2::text IS NULL OR p.status=$2)';
      const result = await db.transaction(async client => {
        const count = (await client.query(`SELECT count(*) FROM pengajuan_penjemputan p WHERE ${where}`, params)).rows[0].count;
        const rows = (await client.query(`${pickupSelect} WHERE ${where} ORDER BY p.diajukan_pada DESC,p.id DESC LIMIT $3 OFFSET $4`, [...params, limit, offset])).rows;
        return { data: rows, meta: v.pageMeta(count, page, limit) };
      }, { readOnly: true, repeatableRead: true });
      res.json(result);
    },
    detail: async (req, res) => res.json({ data: await detail(db, v.id(req.params.id), req.nasabahScope) }),
    approve: decide(true),
    reject: decide(false),
  };
}
