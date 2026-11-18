import * as v from '../utils/validation.js';
import { dateRange, weekRange } from '../utils/dates.js';
import { ensure } from '../utils/errors.js';

const editable = ['layanan_kode', 'tanggal', 'jam_mulai', 'jam_selesai', 'tersedia', 'catatan'];
function scheduleInput(body) {
  const result = {
    layanan_kode: v.choice(body.layanan_kode, ['setoran_umum', 'penimbangan', 'penjemputan'], 'layanan_kode'),
    tanggal: v.date(body.tanggal),
    jam_mulai: v.time(body.jam_mulai, 'jam_mulai'),
    jam_selesai: v.time(body.jam_selesai, 'jam_selesai'),
    tersedia: v.boolean(body.tersedia === undefined ? true : body.tersedia, 'tersedia'),
    catatan: v.text(body.catatan, 'catatan', { optional: true, max: 1000 }),
  };
  ensure((result.jam_mulai && result.jam_selesai && result.jam_mulai < result.jam_selesai)
    || (!result.tersedia && !result.jam_mulai && !result.jam_selesai),
  400, 'VALIDASI_GAGAL', 'Jadwal tersedia memerlukan jam mulai < jam selesai; jadwal tutup boleh tanpa kedua jam.');
  return result;
}
const present = row => ({ ...row, status: row.tersedia ? 'tersedia' : 'tutup' });

export function scheduleController(db) {
  return {
    list: async (req, res) => {
      v.fields(req.query, ['dari', 'sampai', 'layanan_kode', 'status', 'page', 'limit']);
      const range = req.query.dari === undefined && req.query.sampai === undefined ? weekRange() : dateRange(req.query);
      const { page, limit, offset } = v.pagination(req.query);
      const service = req.query.layanan_kode === undefined ? null : v.choice(req.query.layanan_kode, ['setoran_umum', 'penimbangan', 'penjemputan'], 'layanan_kode');
      const available = req.query.status === undefined ? null : v.choice(req.query.status, ['tersedia', 'tutup'], 'status') === 'tersedia';
      const params = [range.dari, range.sampai, service, available];
      const where = `($1::date IS NULL OR j.tanggal >= $1) AND ($2::date IS NULL OR j.tanggal <= $2)
        AND ($3::text IS NULL OR j.layanan_kode=$3) AND ($4::boolean IS NULL OR j.tersedia=$4)`;
      const result = await db.transaction(async client => {
        const count = (await client.query(`SELECT count(*) FROM jadwal_layanan j WHERE ${where}`, params)).rows[0].count;
        const rows = (await client.query(`SELECT j.id,j.layanan_kode,l.nama AS nama_layanan,j.tanggal,j.jam_mulai,j.jam_selesai,j.tersedia,j.catatan
          FROM jadwal_layanan j JOIN layanan l ON l.kode=j.layanan_kode WHERE ${where}
          ORDER BY j.tanggal,j.jam_mulai,j.id LIMIT $5 OFFSET $6`, [...params, limit, offset])).rows;
        return { data: rows.map(present), meta: { ...v.pageMeta(count, page, limit), ...range, zona_waktu: 'Asia/Jakarta' } };
      }, { readOnly: true, repeatableRead: true });
      res.json(result);
    },
    create: async (req, res) => {
      const value = scheduleInput(v.fields(req.body, editable));
      const { rows } = await db.query(`INSERT INTO jadwal_layanan(layanan_kode,tanggal,jam_mulai,jam_selesai,tersedia,catatan,pengelola_id)
        VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,layanan_kode,tanggal,jam_mulai,jam_selesai,tersedia,catatan,pengelola_id`,
      [...editable.map(key => value[key]), req.user.id]);
      res.status(201).json({ data: present(rows[0]) });
    },
    update: async (req, res) => {
      const id = v.id(req.params.id);
      const patch = v.fields(req.body, editable);
      ensure(Object.keys(patch).length > 0, 400, 'VALIDASI_GAGAL', 'Isi setidaknya satu perubahan jadwal.');
      const result = await db.transaction(async client => {
        const current = (await client.query('SELECT * FROM jadwal_layanan WHERE id=$1 FOR UPDATE', [id])).rows[0];
        ensure(current, 404, 'TIDAK_DITEMUKAN', 'Jadwal tidak ditemukan.');
        const before = scheduleInput(current);
        const value = scheduleInput({ ...current, ...patch });
        const linked = (await client.query(`SELECT status FROM pengajuan_penjemputan WHERE jadwal_layanan_id=$1 AND status IN ('disetujui','selesai')`, [id])).rows;
        const structureChanged = ['layanan_kode', 'tanggal', 'jam_mulai', 'jam_selesai'].some(key => before[key] !== value[key]);
        ensure(!(linked.length && structureChanged) && !(linked.some(row => row.status === 'disetujui') && !value.tersedia),
          409, 'JADWAL_TERIKAT', 'Jadwal sudah terikat pengajuan. Jadwal yang masih menunggu penjemputan tidak dapat ditutup; tanggal, layanan, dan jam yang terikat harus dipertahankan.');
        const { rows } = await client.query(`UPDATE jadwal_layanan SET layanan_kode=$1,tanggal=$2,jam_mulai=$3,jam_selesai=$4,
          tersedia=$5,catatan=$6,pengelola_id=$7 WHERE id=$8 RETURNING id,layanan_kode,tanggal,jam_mulai,jam_selesai,tersedia,catatan,pengelola_id`,
        [...editable.map(key => value[key]), req.user.id, id]);
        return present(rows[0]);
      });
      res.json({ data: result });
    },
  };
}
